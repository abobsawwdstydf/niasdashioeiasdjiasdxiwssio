const WebSocket = require('ws');
const { sendEmailViaSMTP, getActiveAccounts } = require('./smtp-engine');
const { getDB } = require('./db');
const { saveSettings } = require('./settings');

let ws = null;
let isConnected = false;
let reconnectTimer = null;
let pingTimer = null;
let heartbeatTimeout = null;

// Глобальный статус для панели
global.tunnelStatus = {
  connected: false,
  lastActivity: null,
  pendingTasks: 0,
  error: null,
};

// Очередь заданий (in-memory, восстанавливается при переподключении)
let pendingTasks = [];

function startTunnel(settings) {
  connect(settings);
}

function connect(settings) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const url = settings.serverUrl.replace('http', 'ws').replace('https', 'wss');
  const tunnelPath = url.includes('/tunnel') ? url : `${url}/tunnel`;

  console.log(`🔗 Подключение к туннелю: ${tunnelPath}`);

  try {
    ws = new WebSocket(tunnelPath, {
      headers: {
        'X-Tunnel-Token': settings.tunnelToken,
      },
    });
  } catch (err) {
    console.error('❌ Ошибка создания WebSocket:', err.message);
    scheduleReconnect(settings);
    return;
  }

  ws.on('open', () => {
    console.log('✅ Туннель подключён');
    isConnected = true;
    global.tunnelStatus = {
      connected: true,
      lastActivity: new Date().toISOString(),
      pendingTasks: pendingTasks.length,
      error: null,
    };

    // Аутентификация
    ws.send(JSON.stringify({ type: 'auth', token: settings.tunnelToken }));

    // Heartbeat каждые 30 сек
    startHeartbeat(settings);
  });

  ws.on('message', (data) => {
    global.tunnelStatus.lastActivity = new Date().toISOString();

    try {
      const msg = JSON.parse(data.toString());
      handleMessage(msg, settings);
    } catch (err) {
      console.error('❌ Ошибка парсинга сообщения:', err.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 Туннель отключён (код: ${code})`);
    isConnected = false;
    global.tunnelStatus = {
      connected: false,
      lastActivity: global.tunnelStatus.lastActivity,
      pendingTasks: pendingTasks.length,
      error: `Отключено (код: ${code})`,
    };
    stopHeartbeat();
    scheduleReconnect(settings);
  });

  ws.on('error', (err) => {
    console.error('❌ Ошибка туннеля:', err.message);
    global.tunnelStatus.error = err.message;
  });
}

function handleMessage(msg, settings) {
  switch (msg.type) {
    case 'authenticated':
      console.log('🔑 Аутентификация успешна');
      ws.send(JSON.stringify({ type: 'ready' }));
      // Отправляем накопившиеся задания
      flushPendingTasks();
      break;

    case 'pong':
      // Heartbeat ответ получен
      if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
      }
      break;

    case 'send-email':
      handleSendEmailTask(msg, settings);
      break;

    default:
      console.log('📨 Неизвестный тип:', msg.type);
  }
}

async function handleSendEmailTask(msg, settings) {
  const { taskId, data } = msg;
  console.log(`📧 Обработка задачи ${taskId}: ${data?.to || 'без адреса'}`);

  try {
    const result = await sendEmailViaSMTP(data);

    // Ответ серверу
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        taskId,
        result: { success: true, messageId: result.messageId },
      }));
    }

    // Лог
    logSend(taskId, data?.to, data?.subject, 'success', null, result.messageId);

    console.log(`✅ ${taskId}: отправлено`);
  } catch (err) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        taskId,
        result: { success: false, error: err.message },
      }));
    }

    logSend(taskId, data?.to, data?.subject, 'failed', err.message, null);
    console.error(`❌ ${taskId}: ${err.message}`);
  }
}

function flushPendingTasks() {
  // При переподключении сервер сам отправит накопившиеся задания
  // Эта функция просто сигнализирует готовность
  console.log('📤 Готов принимать задания');
}

function startHeartbeat(settings) {
  stopHeartbeat();
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));

      // Таймаут на pong
      heartbeatTimeout = setTimeout(() => {
        console.warn('⚠️ Heartbeat timeout — переподключение');
        ws.close();
      }, 10000);
    }
  }, 30000);
}

function stopHeartbeat() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (heartbeatTimeout) { clearTimeout(heartbeatTimeout); heartbeatTimeout = null; }
}

function scheduleReconnect(settings) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    console.log('🔄 Переподключение через 5 сек...');
    connect(settings);
  }, 5000);
}

function logSend(taskId, to, subject, status, error, messageId) {
  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO send_logs (task_id, to_email, subject, status, error, message_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId || null, to || null, subject || null, status, error || null, messageId || null);

    // Обновляем дневную статистику
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today);
    if (existing) {
      if (status === 'success') {
        db.prepare('UPDATE daily_stats SET total_sent = total_sent + 1 WHERE date = ?').run(today);
      } else {
        db.prepare('UPDATE daily_stats SET total_failed = total_failed + 1 WHERE date = ?').run(today);
      }
    } else {
      db.prepare('INSERT INTO daily_stats (date, total_sent, total_failed) VALUES (?, ?, ?)')
        .run(today, status === 'success' ? 1 : 0, status === 'failed' ? 1 : 0);
    }
  } catch (err) {
    console.error('Ошибка записи лога:', err.message);
  }
}

function getTunnelStatus() {
  return { ...global.tunnelStatus };
}

function restartTunnel(settings) {
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }
  isConnected = false;
  stopHeartbeat();
  connect(settings);
}

module.exports = { startTunnel, getTunnelStatus, restartTunnel };
