// Telegram Bot API configuration — loaded from environment variables
function loadTelegramBots() {
  const bots = [];
  let i = 1;
  while (process.env[`TG_BOT${i}`]) {
    bots.push({
      id: i,
      name: `bot_${i}`,
      token: process.env[`TG_BOT${i}`]!,
    });
    i++;
  }
  return bots;
}

function loadTelegramChannels() {
  const channels = [];
  let i = 1;
  while (process.env[`TG_CHANEL${i}`] || process.env[`TG_CHANNEL${i}`]) {
    // Support both TG_CHANEL (typo) and TG_CHANNEL
    const chatId = process.env[`TG_CHANEL${i}`] || process.env[`TG_CHANNEL${i}`];
    channels.push({
      id: i,
      chatId: chatId!,
      name: `Storage ${i}`,
    });
    i++;
  }
  return channels;
}

export const TELEGRAM_BOTS = loadTelegramBots();
export const TELEGRAM_CHANNELS = loadTelegramChannels();

// If no env vars found, fall back to empty arrays (will be caught at startup)
if (TELEGRAM_BOTS.length === 0) {
  console.warn('[Telegram] ⚠️  TG_BOT1, TG_BOT2... не найдены в ENV!');
}
if (TELEGRAM_CHANNELS.length === 0) {
  console.warn('[Telegram] ⚠️  TG_CHANEL1, TG_CHANEL2... не найдены в ENV!');
}

// Redis instances for caching
export const REDIS_INSTANCES = [
  { id: 1, url: process.env.REDIS_URL || 'redis://localhost:6379' },
  { id: 2, url: process.env.REDIS_SESSION_URL || 'redis://localhost:6380' },
];

// File chunking configuration
export const CHUNK_SIZE = 19 * 1024 * 1024; // 19 MB — below Telegram's 20MB limit

// Encryption levels
export const ENCRYPTION_LEVELS = {
  NONE: 0,
  BASIC: 1,    // AES-128
  STANDARD: 2, // AES-256
  MAX: 3,      // AES-256 + ChaCha20
};
