const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { getDB } = require('./db');
const { loadSettings, saveSettings } = require('./settings');
const { getTunnelStatus, restartTunnel } = require('./tunnel');
const { testSMTPAccount, resetDailyCounters } = require('./smtp-engine');
const crypto = require('crypto');

function startWebPanel(settings) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  }));

  // ─── Middleware авторизации ───
  function requireAuth(req, res, next) {
    if (!settings.setupComplete) return next(); // Первый запуск
    if (req.session.authenticated) return next();
    res.status(401).json({ error: 'Не авторизован' });
  }

  // ─── Auth ───
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === settings.adminUsername && bcrypt.compareSync(password, settings.adminPasswordHash)) {
      req.session.authenticated = true;
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: 'Неверный логин или пароль' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
  });

  app.get('/api/auth/status', (req, res) => {
    res.json({
      setupComplete: settings.setupComplete,
      authenticated: !!req.session.authenticated,
    });
  });

  // ─── Первый запуск ───
  app.post('/api/setup', (req, res) => {
    if (settings.setupComplete) {
      res.status(400).json({ error: 'Уже настроено' });
      return;
    }
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) {
      res.status(400).json({ error: 'Минимум 4 символа' });
      return;
    }
    saveSettings({
      adminUsername: username,
      adminPasswordHash: bcrypt.hashSync(password, 10),
      setupComplete: '1',
    });
    req.session.authenticated = true;
    // Перезагрузка настроек
    Object.assign(settings, loadSettings());
    res.json({ ok: true });
  });

  // ─── Защищённые маршруты ───
  app.use(requireAuth);

  // Статистика
  app.get('/api/stats', (req, res) => {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today) || { total_sent: 0, total_failed: 0 };
    const totalStats = db.prepare('SELECT COALESCE(SUM(total_sent),0) as total_sent, COALESCE(SUM(total_failed),0) as total_failed FROM daily_stats').get();
    const queueSize = db.prepare('SELECT COUNT(*) as count FROM send_logs WHERE status = ?').get('pending') || { count: 0 };

    res.json({
      today: todayStats,
      total: totalStats,
      queue: queueSize.count,
    });
  });

  // Логи
  app.get('/api/logs', (req, res) => {
    const db = getDB();
    const { status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM send_logs';
    let params = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const logs = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM send_logs').get().count;
    res.json({ logs, total });
  });

  // SMTP-аккаунты
  app.get('/api/smtp-accounts', (req, res) => {
    const db = getDB();
    const accounts = db.prepare('SELECT id, host, port, secure, user, from_name, from_email, daily_limit, priority, active, sent_today, sent_total, last_error, created_at FROM smtp_accounts ORDER BY priority ASC').all();
    res.json(accounts);
  });

  app.post('/api/smtp-accounts', (req, res) => {
    const db = getDB();
    const { host, port, secure, user, password, from_name, from_email, daily_limit, priority } = req.body;
    if (!host || !port || !user || !password) {
      res.status(400).json({ error: 'host, port, user, password обязательны' });
      return;
    }
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO smtp_accounts (id, host, port, secure, user, password, from_name, from_email, daily_limit, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, host, parseInt(port), secure ? 1 : 0, user, password, from_name || '', from_email || user, parseInt(daily_limit) || 0, parseInt(priority) || 1);
    res.json({ ok: true, id });
  });

  app.put('/api/smtp-accounts/:id', (req, res) => {
    const db = getDB();
    const { active, priority, daily_limit } = req.body;
    const updates = [];
    const params = [];
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(parseInt(priority)); }
    if (daily_limit !== undefined) { updates.push('daily_limit = ?'); params.push(parseInt(daily_limit)); }
    if (updates.length === 0) { res.status(400).json({ error: 'Нет полей' }); return; }
    params.push(req.params.id);
    db.prepare(`UPDATE smtp_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ ok: true });
  });

  app.delete('/api/smtp-accounts/:id', (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM smtp_accounts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/smtp-accounts/:id/test', async (req, res) => {
    const db = getDB();
    const account = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(req.params.id);
    if (!account) { res.status(404).json({ error: 'Не найден' }); return; }
    const result = await testSMTPAccount(account);
    res.json(result);
  });

  // Туннель
  app.get('/api/tunnel', (req, res) => {
    res.json(getTunnelStatus());
  });

  app.post('/api/tunnel/restart', (req, res) => {
    const s = loadSettings();
    restartTunnel(s);
    res.json({ ok: true });
  });

  app.post('/api/tunnel/test', (req, res) => {
    const status = getTunnelStatus();
    res.json({
      ok: status.connected,
      message: status.connected ? 'Подключён' : 'Не подключён',
      status,
    });
  });

  // Настройки
  app.get('/api/settings', (req, res) => {
    const s = loadSettings();
    res.json({
      panelPort: s.panelPort,
      serverUrl: s.serverUrl,
      tunnelToken: s.tunnelToken ? '****' + s.tunnelToken.slice(-4) : '',
      theme: s.theme,
      language: s.language,
      autoStart: s.autoStart,
      adminUsername: s.adminUsername,
    });
  });

  app.post('/api/settings', (req, res) => {
    const updates = {};
    const { serverUrl, tunnelToken, theme, language, adminUsername, adminPassword, autoStart } = req.body;
    if (serverUrl !== undefined) updates.serverUrl = serverUrl;
    if (tunnelToken !== undefined && tunnelToken !== '****') updates.tunnelToken = tunnelToken;
    if (theme !== undefined) updates.theme = theme;
    if (language !== undefined) updates.language = language;
    if (adminUsername !== undefined) updates.adminUsername = adminUsername;
    if (adminPassword && adminPassword.length >= 4) updates.adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
    if (autoStart !== undefined) updates.autoStart = autoStart ? '1' : '0';
    saveSettings(updates);
    Object.assign(settings, loadSettings());
    res.json({ ok: true });
  });

  // Диагностика — системная информация
  app.get('/api/diagnostics', (req, res) => {
    const os = require('os');
    const db = getDB();
    const fs = require('fs');
    res.json({
      os: os.type() + ' ' + os.release(),
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      cpuUsage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      diskFree: fs.existsSync(DATA_DIR()) ? fs.statfsSync?.(DATA_DIR())?.bfree : null,
      smtpAccounts: db.prepare('SELECT COUNT(*) as count FROM smtp_accounts').get().count,
      activeSMTP: db.prepare('SELECT COUNT(*) as count FROM smtp_accounts WHERE active = 1').get().count,
      tunnelStatus: getTunnelStatus(),
    });
  });

  const DATA_DIR = () => path.join(__dirname, '..', 'data');

  app.listen(settings.panelPort, '0.0.0.0', () => {
    console.log(`🌐 Панель управления: http://0.0.0.0:${settings.panelPort}`);
    console.log(`   Локально: http://localhost:${settings.panelPort}`);
  });
}

module.exports = { startWebPanel };
