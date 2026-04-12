// NEXO Server - Tunnel Module
// Обрабатывает WebSocket подключения от smtp-client (ноутбук)

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

interface TunnelTask {
  taskId: string;
  type: 'send-email';
  data: { to: string; subject: string; html: string; from?: string; fromName?: string };
  createdAt: number;
}

interface TunnelClient {
  ws: WebSocket;
  connectedAt: Date;
  lastPing: Date;
}

let tunnelClient: TunnelClient | null = null;
const taskQueue: TunnelTask[] = [];
let taskTimeouts = new Map<string, NodeJS.Timeout>();

export function setupTunnel(server: any, tunnelSecret: string) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Buffer, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/tunnel') {
      const token = request.headers['x-tunnel-token'] as string;
      if (!token || token !== tunnelSecret) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔗 Туннель: новое подключение');

    // Если уже есть клиент — отключаем старого
    if (tunnelClient) {
      tunnelClient.ws.close(1000, 'Новое подключение');
    }

    tunnelClient = {
      ws,
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        handleTunnelMessage(msg, ws);
      } catch {
        console.error('❌ Туннель: ошибка парсинга');
      }
    });

    ws.on('close', () => {
      console.log('🔌 Туннель: клиент отключён');
      if (tunnelClient?.ws === ws) {
        tunnelClient = null;
      }
    });

    ws.on('error', (err: Error) => {
      console.error('❌ Туннель: ошибка:', err.message);
    });
  });

  console.log('📡 Туннель инициализирован (/tunnel)');
}

function handleTunnelMessage(msg: any, ws: WebSocket) {
  switch (msg.type) {
    case 'auth':
      ws.send(JSON.stringify({ type: 'authenticated' }));
      console.log('🔑 Туннель: аутентификация успешна');
      break;

    case 'ready':
      console.log('✅ Туннель: клиент готов');
      // Отправляем накопившиеся задания
      flushQueue(ws);
      break;

    case 'ping':
      if (tunnelClient) tunnelClient.lastPing = new Date();
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'result':
      // Результат выполнения задачи
      if (msg.taskId && taskTimeouts.has(msg.taskId)) {
        clearTimeout(taskTimeouts.get(msg.taskId)!);
        taskTimeouts.delete(msg.taskId);
      }
      console.log(`📨 Туннель: результат ${msg.taskId}:`, msg.result?.success ? 'OK' : msg.result?.error);
      break;
  }
}

function flushQueue(ws: WebSocket) {
  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    ws.send(JSON.stringify(task));

    // Таймаут 30 секунд
    const timeout = setTimeout(() => {
      console.warn(`⏰ Туннель: таймаут задачи ${task.taskId}`);
      taskQueue.push(task); // Вернуть в очередь
    }, 30000);
    taskTimeouts.set(task.taskId, timeout);
  }
}

/**
 * Отправить задание на отправку письма через туннель
 */
export function sendEmailTask(data: { to: string; subject: string; html: string; from?: string; fromName?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return new Promise((resolve) => {
    const taskId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task: TunnelTask = { taskId, type: 'send-email', data, createdAt: Date.now() };

    if (!tunnelClient || tunnelClient.ws.readyState !== WebSocket.OPEN) {
      // Ноутбук офлайн — ставим в очередь
      taskQueue.push(task);
      console.log(`📋 Туннель: задача ${taskId} добавлена в очередь (клиент офлайн)`);
      resolve({ success: false, error: 'Клиент туннеля офлайн, задание в очереди' });
      return;
    }

    // Таймаут
    const timeout = setTimeout(() => {
      taskTimeouts.delete(taskId);
      taskQueue.push(task);
      resolve({ success: false, error: 'Таймаут отправки' });
    }, 30000);
    taskTimeouts.set(taskId, timeout);

    // Слушаем результат
    const onMessage = (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.taskId === taskId) {
          clearTimeout(timeout);
          taskTimeouts.delete(taskId);
          tunnelClient?.ws.removeListener('message', onMessage);
          resolve({ success: msg.result?.success, messageId: msg.result?.messageId, error: msg.result?.error });
        }
      } catch {}
    };
    tunnelClient.ws.on('message', onMessage);

    // Отправляем
    tunnelClient.ws.send(JSON.stringify(task));
    console.log(`📧 Туннель: задача ${taskId} → ${data.to}`);
  });
}

/**
 * Статус туннеля
 */
export function getTunnelInfo() {
  return {
    connected: tunnelClient !== null,
    connectedAt: tunnelClient?.connectedAt?.toISOString() || null,
    lastPing: tunnelClient?.lastPing?.toISOString() || null,
    queueSize: taskQueue.length,
  };
}
