const nodemailer = require('nodemailer');
const { getDB } = require('./db');
const crypto = require('crypto');

// Кэш транспортеров (чтобы не создавать каждый раз)
const transporters = new Map();

/**
 * Получить SMTP транспорнер для аккаунта
 */
function getTransporter(account) {
  if (transporters.has(account.id)) {
    return transporters.get(account.id);
  }

  const transporter = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure === 1, // SSL
    auth: {
      user: account.user,
      pass: account.password,
    },
    tls: {
      rejectUnauthorized: false, // Для самоподписанных сертификатов
    },
  });

  transporters.set(account.id, transporter);
  return transporter;
}

/**
 * Отправить письмо через лучший доступный SMTP-аккаунт
 */
async function sendEmailViaSMTP(data) {
  const db = getDB();
  const { to, subject, html, from, fromName } = data;

  // Получить активные аккаунты, отсортированные по приоритету
  const accounts = db.prepare(`
    SELECT * FROM smtp_accounts
    WHERE active = 1
    ORDER BY priority ASC, sent_today ASC
  `).all();

  if (accounts.length === 0) {
    throw new Error('Нет активных SMTP-аккаунтов');
  }

  let lastError = null;

  for (const account of accounts) {
    // Проверка лимита
    if (account.daily_limit > 0 && account.sent_today >= account.daily_limit) {
      continue; // Пропускаем — лимит исчерпан
    }

    try {
      const transporter = getTransporter(account);

      const result = await transporter.sendMail({
        from: fromName ? `"${fromName}" <${account.from_email || account.user}>` : (account.from_email || account.user),
        to,
        subject,
        html,
        text: html ? html.replace(/<[^>]*>/g, '').substring(0, 200) : '',
      });

      // Обновить счётчики
      db.prepare(`
        UPDATE smtp_accounts
        SET sent_today = sent_today + 1, sent_total = sent_total + 1, last_error = NULL
        WHERE id = ?
      `).run(account.id);

      return { success: true, messageId: result.messageId, accountId: account.id };
    } catch (err) {
      lastError = err.message;
      console.error(`SMTP ${account.host}:${account.port} ошибка:`, err.message);

      // Записать ошибку
      db.prepare(`
        UPDATE smtp_accounts SET last_error = ? WHERE id = ?
      `).run(err.message.substring(0, 500), account.id);

      // Удалить транспорнер — возможно нужно пересоздать
      transporters.delete(account.id);
    }
  }

  throw new Error(`Все SMTP-аккаунты отказали. Последняя ошибка: ${lastError}`);
}

/**
 * Протестировать SMTP-аккаунт
 */
async function testSMTPAccount(accountData) {
  const transporter = nodemailer.createTransport({
    host: accountData.host,
    port: accountData.port,
    secure: accountData.secure === 1 || accountData.port === 465,
    auth: {
      user: accountData.user,
      pass: accountData.password,
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    return { success: true, message: 'Подключение успешно' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Сбросить дневные счётчики (вызывать в полночь)
 */
function resetDailyCounters() {
  const db = getDB();
  db.prepare('UPDATE smtp_accounts SET sent_today = 0').run();
  console.log('📊 Дневные счётчики SMTP сброшены');
}

// Автосброс в полночь
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    resetDailyCounters();
  }
}, 60000); // Проверка каждую минуту

module.exports = { sendEmailViaSMTP, testSMTPAccount, resetDailyCounters, getTransporter };
