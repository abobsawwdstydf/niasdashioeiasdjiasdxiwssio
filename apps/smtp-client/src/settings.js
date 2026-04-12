const { getDB } = require('./db');

const DEFAULTS = {
  panelPort: '3000',
  adminUsername: '',
  adminPasswordHash: '',
  serverUrl: '',
  tunnelToken: '',
  theme: 'dark',
  language: 'ru',
  autoStart: '0',
  setupComplete: '0',
};

function loadSettings() {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = { ...DEFAULTS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  // Числовые поля
  settings.panelPort = parseInt(settings.panelPort) || 3000;
  settings.autoStart = settings.autoStart === '1';
  settings.setupComplete = settings.setupComplete === '1';
  return settings;
}

function saveSettings(updates) {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) {
      stmt.run(key, String(value));
    }
  });
  tx(Object.entries(updates));
}

function getSetting(key) {
  const db = getDB();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

module.exports = { loadSettings, saveSettings, getSetting };
