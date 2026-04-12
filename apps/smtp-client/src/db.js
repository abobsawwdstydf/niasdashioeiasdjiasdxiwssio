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

  // Настройки
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // SMTP-аккаунты
  db.exec(`
    CREATE TABLE IF NOT EXISTS smtp_accounts (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      secure INTEGER DEFAULT 1,
      user TEXT NOT NULL,
      password TEXT NOT NULL,
      from_name TEXT,
      from_email TEXT,
      daily_limit INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      sent_today INTEGER DEFAULT 0,
      sent_total INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Логи отправки
  db.exec(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      task_id TEXT,
      to_email TEXT,
      subject TEXT,
      smtp_account_id TEXT,
      status TEXT,
      error TEXT,
      message_id TEXT
    )
  `);

  // Статистика (ежедневная)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      total_sent INTEGER DEFAULT 0,
      total_failed INTEGER DEFAULT 0
    )
  `);

  console.log('  ✅ SQLite инициализирована');
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { getDB, initDB };
