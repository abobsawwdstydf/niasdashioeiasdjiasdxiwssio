#!/bin/bash
# Скрипт для РАЗВЁРТЫВАНИЯ файлов smtp-client на сервере
# Запускать С ЛОКАЛЬНОГО ПК после подключения по SSH
# Или скопировать содержимое и вставить на сервере

set -e
PROJECT_DIR="$HOME/nexo-smtp-client"

echo "📂 Создание структуры..."
mkdir -p "$PROJECT_DIR/src" "$PROJECT_DIR/public" "$PROJECT_DIR/data" "$PROJECT_DIR/logs"

echo "📝 Создание файлов..."

# ─── src/db.js ───
cat > "$PROJECT_DIR/src/db.js" << 'DBEOF'
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'smtp-client.db');
let db;
function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS smtp_accounts (id TEXT PRIMARY KEY, host TEXT NOT NULL, port INTEGER NOT NULL, secure INTEGER DEFAULT 1, user TEXT NOT NULL, password TEXT NOT NULL, from_name TEXT, from_email TEXT, daily_limit INTEGER DEFAULT 0, priority INTEGER DEFAULT 1, active INTEGER DEFAULT 1, sent_today INTEGER DEFAULT 0, sent_total INTEGER DEFAULT 0, last_error TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS send_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, task_id TEXT, to_email TEXT, subject TEXT, smtp_account_id TEXT, status TEXT, error TEXT, message_id TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS daily_stats (date TEXT PRIMARY KEY, total_sent INTEGER DEFAULT 0, total_failed INTEGER DEFAULT 0)`);
  console.log('  ✅ SQLite инициализирована');
}
function getDB() { if (!db) initDB(); return db; }
module.exports = { getDB, initDB };
DBEOF

# ─── src/settings.js ───
cat > "$PROJECT_DIR/src/settings.js" << 'SETEOF'
const { getDB } = require('./db');
const DEFAULTS = { panelPort: '3000', adminUsername: '', adminPasswordHash: '', serverUrl: '', tunnelToken: '', theme: 'dark', language: 'ru', autoStart: '0', setupComplete: '0' };
function loadSettings() {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULTS };
  for (const r of rows) s[r.key] = r.value;
  s.panelPort = parseInt(s.panelPort) || 3000;
  s.autoStart = s.autoStart === '1';
  s.setupComplete = s.setupComplete === '1';
  return s;
}
function saveSettings(updates) {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((entries) => { for (const [k, v] of entries) stmt.run(k, String(v)); });
  tx(Object.entries(updates));
}
module.exports = { loadSettings, saveSettings };
SETEOF

# ─── src/tunnel.js ───
cat > "$PROJECT_DIR/src/tunnel.js" << 'TNEOF'
const WebSocket = require('ws');
const { sendEmailViaSMTP } = require('./smtp-engine');
const { getDB } = require('./db');
let ws = null, isConnected = false, reconnectTimer = null, pingTimer = null, heartbeatTimeout = null;
global.tunnelStatus = { connected: false, lastActivity: null, pendingTasks: 0, error: null };
let pendingTasks = [];

function connect(settings) {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  const url = settings.serverUrl.replace('http', 'ws').replace('https', 'wss');
  const tunnelPath = url.includes('/tunnel') ? url : url + '/tunnel';
  console.log('🔗 Подключение: ' + tunnelPath);
  try {
    ws = new WebSocket(tunnelPath, { headers: { 'X-Tunnel-Token': settings.tunnelToken } });
  } catch (e) { console.error('❌ WebSocket ошибка:', e.message); scheduleReconnect(settings); return; }

  ws.on('open', () => {
    console.log('✅ Туннель подключён');
    isConnected = true;
    global.tunnelStatus = { connected: true, lastActivity: new Date().toISOString(), pendingTasks: pendingTasks.length, error: null };
    ws.send(JSON.stringify({ type: 'auth', token: settings.tunnelToken }));
    startHeartbeat(settings);
  });

  ws.on('message', (data) => {
    global.tunnelStatus.lastActivity = new Date().toISOString();
    try { handleMessage(JSON.parse(data.toString()), settings); } catch (e) {}
  });

  ws.on('close', () => {
    console.log('🔌 Туннель отключён');
    isConnected = false;
    global.tunnelStatus = { connected: false, lastActivity: global.tunnelStatus.lastActivity, pendingTasks: pendingTasks.length, error: 'Отключено' };
    stopHeartbeat();
    scheduleReconnect(settings);
  });

  ws.on('error', (e) => { global.tunnelStatus.error = e.message; });
}

function handleMessage(msg, settings) {
  if (msg.type === 'authenticated') {
    console.log('🔑 Аутентификация OK');
    ws.send(JSON.stringify({ type: 'ready' }));
  } else if (msg.type === 'pong') {
    if (heartbeatTimeout) { clearTimeout(heartbeatTimeout); heartbeatTimeout = null; }
  } else if (msg.type === 'send-email') {
    handleSendEmail(msg);
  }
}

async function handleSendEmail(msg) {
  const { taskId, data } = msg;
  console.log('📧 Задача ' + taskId + ': ' + (data?.to || '?'));
  try {
    const result = await sendEmailViaSMTP(data);
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ taskId, result: { success: true, messageId: result.messageId } }));
    logSend(taskId, data?.to, data?.subject, 'success', null, result.messageId);
  } catch (e) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ taskId, result: { success: false, error: e.message } }));
    logSend(taskId, data?.to, data?.subject, 'failed', e.message, null);
  }
}

function startHeartbeat(settings) {
  stopHeartbeat();
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
      heartbeatTimeout = setTimeout(() => { console.warn('⚠️ Heartbeat timeout'); ws.close(); }, 10000);
    }
  }, 30000);
}

function stopHeartbeat() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (heartbeatTimeout) { clearTimeout(heartbeatTimeout); heartbeatTimeout = null; }
}

function scheduleReconnect(settings) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { console.log('🔄 Переподключение...'); connect(settings); }, 5000);
}

function logSend(taskId, to, subject, status, error, messageId) {
  try {
    const db = getDB();
    db.prepare('INSERT INTO send_logs (task_id, to_email, subject, status, error, message_id) VALUES (?,?,?,?,?,?)').run(taskId||null, to||null, subject||null, status, error||null, messageId||null);
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today);
    if (existing) {
      db.prepare('UPDATE daily_stats SET total_' + (status==='success'?'sent':'failed') + ' = total_' + (status==='success'?'sent':'failed') + ' + 1 WHERE date = ?').run(today);
    } else {
      db.prepare('INSERT INTO daily_stats (date, total_sent, total_failed) VALUES (?,?,?)').run(today, status==='success'?1:0, status==='failed'?1:0);
    }
  } catch(e) {}
}

function startTunnel(settings) { connect(settings); }
function getTunnelStatus() { return { ...global.tunnelStatus }; }
function restartTunnel(settings) { if (ws) { ws.removeAllListeners(); ws.close(); ws = null; } isConnected = false; stopHeartbeat(); connect(settings); }
module.exports = { startTunnel, getTunnelStatus, restartTunnel };
TNEOF

# ─── src/smtp-engine.js ───
cat > "$PROJECT_DIR/src/smtp-engine.js" << 'SMTPEOF'
const nodemailer = require('nodemailer');
const { getDB } = require('./db');
const transporters = new Map();

async function sendEmailViaSMTP(data) {
  const db = getDB();
  const { to, subject, html, fromName } = data;
  const accounts = db.prepare('SELECT * FROM smtp_accounts WHERE active = 1 ORDER BY priority ASC, sent_today ASC').all();
  if (accounts.length === 0) throw new Error('Нет активных SMTP-аккаунтов');
  let lastError;
  for (const acc of accounts) {
    if (acc.daily_limit > 0 && acc.sent_today >= acc.daily_limit) continue;
    try {
      let tr = transporters.get(acc.id);
      if (!tr) {
        tr = nodemailer.createTransport({ host: acc.host, port: acc.port, secure: acc.secure === 1, auth: { user: acc.user, pass: acc.password }, tls: { rejectUnauthorized: false } });
        transporters.set(acc.id, tr);
      }
      const result = await tr.sendMail({ from: fromName ? '"' + fromName + '" <' + (acc.from_email || acc.user) + '>' : (acc.from_email || acc.user), to, subject, html: html || '', text: html ? html.replace(/<[^>]*>/g, '').substring(0, 200) : '' });
      db.prepare('UPDATE smtp_accounts SET sent_today = sent_today + 1, sent_total = sent_total + 1, last_error = NULL WHERE id = ?').run(acc.id);
      return { success: true, messageId: result.messageId, accountId: acc.id };
    } catch (e) {
      lastError = e.message;
      db.prepare('UPDATE smtp_accounts SET last_error = ? WHERE id = ?').run(e.message.substring(0, 500), acc.id);
      transporters.delete(acc.id);
    }
  }
  throw new Error('Все SMTP отказали: ' + lastError);
}

async function testSMTPAccount(acc) {
  const tr = nodemailer.createTransport({ host: acc.host, port: acc.port, secure: acc.secure === 1 || acc.port === 465, auth: { user: acc.user, pass: acc.password }, tls: { rejectUnauthorized: false } });
  try { await tr.verify(); return { success: true, message: 'OK' }; } catch (e) { return { success: false, message: e.message }; }
}

setInterval(() => { const n = new Date(); if (n.getHours() === 0 && n.getMinutes() === 0) { getDB().prepare('UPDATE smtp_accounts SET sent_today = 0').run(); console.log('📊 Счётчики сброшены'); } }, 60000);
module.exports = { sendEmailViaSMTP, testSMTPAccount };
SMTPEOF

# ─── src/web-panel.js ───
cat > "$PROJECT_DIR/src/web-panel.js" << 'WPEOF'
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { getDB } = require('./db');
const { loadSettings, saveSettings } = require('./settings');
const { getTunnelStatus, restartTunnel } = require('./tunnel');
const { testSMTPAccount } = require('./smtp-engine');
const crypto = require('crypto');

function startWebPanel(settings) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(session({ secret: crypto.randomBytes(32).toString('hex'), resave: false, saveUninitialized: false, cookie: { maxAge: 86400000 } }));

  function requireAuth(req, res, next) { if (!settings.setupComplete) return next(); if (req.session.authenticated) return next(); res.status(401).json({ error: 'Не авторизован' }); }

  app.post('/api/auth/login', (req, res) => { const { username, password } = req.body; if (username === settings.adminUsername && bcrypt.compareSync(password, settings.adminPasswordHash)) { req.session.authenticated = true; res.json({ ok: true }); } else res.status(401).json({ error: 'Неверно' }); });
  app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
  app.get('/api/auth/status', (req, res) => res.json({ setupComplete: settings.setupComplete, authenticated: !!req.session.authenticated }));

  app.post('/api/setup', (req, res) => {
    if (settings.setupComplete) { res.status(400).json({ error: 'Уже настроено' }); return; }
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) { res.status(400).json({ error: 'Минимум 4 символа' }); return; }
    saveSettings({ adminUsername: username, adminPasswordHash: bcrypt.hashSync(password, 10), setupComplete: '1' });
    req.session.authenticated = true;
    Object.assign(settings, loadSettings());
    res.json({ ok: true });
  });

  app.use(requireAuth);

  app.get('/api/stats', (req, res) => {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    const ts = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today) || { total_sent: 0, total_failed: 0 };
    const total = db.prepare('SELECT COALESCE(SUM(total_sent),0) as total_sent, COALESCE(SUM(total_failed),0) as total_failed FROM daily_stats').get();
    res.json({ today: ts, total, queue: 0 });
  });

  app.get('/api/logs', (req, res) => {
    const db = getDB();
    const { status, limit = 50, offset = 0 } = req.query;
    let q = 'SELECT * FROM send_logs', p = [];
    if (status) { q += ' WHERE status = ?'; p.push(status); }
    q += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    p.push(parseInt(limit), parseInt(offset));
    const logs = db.prepare(q).all(...p);
    res.json({ logs, total: db.prepare('SELECT COUNT(*) as count FROM send_logs').get().count });
  });

  app.get('/api/smtp-accounts', (req, res) => { const db = getDB(); res.json(db.prepare('SELECT id, host, port, secure, user, from_name, from_email, daily_limit, priority, active, sent_today, sent_total, last_error, created_at FROM smtp_accounts ORDER BY priority ASC').all()); });

  app.post('/api/smtp-accounts', (req, res) => {
    const db = getDB();
    const { host, port, secure, user, password, from_name, from_email, daily_limit, priority } = req.body;
    if (!host || !port || !user || !password) { res.status(400).json({ error: 'host,port,user,password обязательны' }); return; }
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO smtp_accounts (id, host, port, secure, user, password, from_name, from_email, daily_limit, priority) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, host, parseInt(port), secure ? 1 : 0, user, password, from_name||'', from_email||user, parseInt(daily_limit)||0, parseInt(priority)||1);
    res.json({ ok: true, id });
  });

  app.put('/api/smtp-accounts/:id', (req, res) => {
    const db = getDB();
    const u = [], p = [];
    if (req.body.active !== undefined) { u.push('active = ?'); p.push(req.body.active ? 1 : 0); }
    if (req.body.priority !== undefined) { u.push('priority = ?'); p.push(parseInt(req.body.priority)); }
    if (req.body.daily_limit !== undefined) { u.push('daily_limit = ?'); p.push(parseInt(req.body.daily_limit)); }
    if (u.length === 0) { res.status(400).json({ error: 'Нет полей' }); return; }
    p.push(req.params.id);
    db.prepare('UPDATE smtp_accounts SET ' + u.join(', ') + ' WHERE id = ?').run(...p);
    res.json({ ok: true });
  });

  app.delete('/api/smtp-accounts/:id', (req, res) => { const db = getDB(); db.prepare('DELETE FROM smtp_accounts WHERE id = ?').run(req.params.id); res.json({ ok: true }); });

  app.post('/api/smtp-accounts/:id/test', async (req, res) => {
    const db = getDB();
    const acc = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(req.params.id);
    if (!acc) { res.status(404).json({ error: 'Не найден' }); return; }
    res.json(await testSMTPAccount(acc));
  });

  app.get('/api/tunnel', (req, res) => res.json(getTunnelStatus()));
  app.post('/api/tunnel/restart', (req, res) => { const s = loadSettings(); restartTunnel(s); res.json({ ok: true }); });
  app.post('/api/tunnel/test', (req, res) => { const s = getTunnelStatus(); res.json({ ok: s.connected, message: s.connected ? 'Подключён' : 'Не подключён', status: s }); });

  app.get('/api/settings', (req, res) => { const s = loadSettings(); res.json({ panelPort: s.panelPort, serverUrl: s.serverUrl, tunnelToken: s.tunnelToken ? '****' + s.tunnelToken.slice(-4) : '', theme: s.theme, language: s.language, autoStart: s.autoStart, adminUsername: s.adminUsername }); });

  app.post('/api/settings', (req, res) => {
    const u = {};
    if (req.body.serverUrl !== undefined) u.serverUrl = req.body.serverUrl;
    if (req.body.tunnelToken !== undefined && req.body.tunnelToken !== '****') u.tunnelToken = req.body.tunnelToken;
    if (req.body.theme !== undefined) u.theme = req.body.theme;
    if (req.body.adminUsername !== undefined) u.adminUsername = req.body.adminUsername;
    if (req.body.adminPassword && req.body.adminPassword.length >= 4) u.adminPasswordHash = bcrypt.hashSync(req.body.adminPassword, 10);
    saveSettings(u);
    Object.assign(settings, loadSettings());
    res.json({ ok: true });
  });

  app.get('/api/diagnostics', (req, res) => {
    const os = require('os');
    const db = getDB();
    res.json({ os: os.type() + ' ' + os.release(), nodeVersion: process.version, uptime: Math.floor(process.uptime()), cpuUsage: os.loadavg(), freeMemory: os.freemem(), totalMemory: os.totalmem(), smtpAccounts: db.prepare('SELECT COUNT(*) as count FROM smtp_accounts').get().count, activeSMTP: db.prepare('SELECT COUNT(*) as count FROM smtp_accounts WHERE active = 1').get().count, tunnelStatus: getTunnelStatus() });
  });

  app.listen(settings.panelPort, '0.0.0.0', () => {
    console.log('🌐 Панель: http://0.0.0.0:' + settings.panelPort);
    console.log('   Локально: http://localhost:' + settings.panelPort);
  });
}

module.exports = { startWebPanel };
WPEOF

# ─── src/index.js ───
cat > "$PROJECT_DIR/src/index.js" << 'IDXEOF'
const { startWebPanel } = require('./web-panel');
const { startTunnel } = require('./tunnel');
const { initDB } = require('./db');
const { loadSettings } = require('./settings');
require('dotenv').config({ path: '.env' });

async function main() {
  console.log('🚀 NEXO SMTP Client v1.0');
  console.log('─────────────────────────');
  initDB();
  console.log('✅ База данных готова');
  const settings = loadSettings();

  // Переопределяем из .env
  if (process.env.PANEL_PORT) settings.panelPort = parseInt(process.env.PANEL_PORT);
  if (process.env.SERVER_URL) settings.serverUrl = process.env.SERVER_URL;
  if (process.env.TUNNEL_TOKEN) settings.tunnelToken = process.env.TUNNEL_TOKEN;

  console.log('📡 Панель: http://0.0.0.0:' + settings.panelPort);
  startWebPanel(settings);
  if (settings.serverUrl && settings.tunnelToken) {
    startTunnel(settings);
  } else {
    console.log('⏳ Туннель не настроен');
  }
}
main().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
IDXEOF

echo "✅ Все файлы созданы!"
echo "📂 Структура:"
find "$PROJECT_DIR" -type f | head -20
