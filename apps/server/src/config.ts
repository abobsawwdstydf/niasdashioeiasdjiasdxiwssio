import dotenv from 'dotenv';
import path from 'path';
import { initEncryption } from './encrypt';

dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET не задан в .env');
}

if (process.env.ENCRYPTION_KEY) {
  initEncryption(process.env.ENCRYPTION_KEY);
}

// Telegram bots configuration
// Telegram auth bot
export const TELEGRAM_AUTH_BOT = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  username: process.env.TELEGRAM_BOT_USERNAME || 'nexo_auth_bot',
};

// Parse bot tokens from environment variable (comma-separated)
const botTokensEnv = process.env.TELEGRAM_BOT_TOKENS || '';
export const TELEGRAM_BOTS = botTokensEnv
  ? botTokensEnv.split(',').map((token, i) => ({ id: `bot${i + 1}`, token: token.trim() }))
  : [];

// Telegram storage channels (comma-separated chat IDs)
const channelsEnv = process.env.TELEGRAM_CHANNELS || '';
export const TELEGRAM_CHANNELS = channelsEnv
  ? channelsEnv.split(',').map((chatId, i) => ({ id: `ch${i + 1}`, chatId: chatId.trim() }))
  : [];

// Redis instances (comma-separated URLs)
const redisUrlsEnv = process.env.REDIS_URLS || '';
export const REDIS_INSTANCES = redisUrlsEnv
  ? redisUrlsEnv.split(',').map((url, i) => ({ id: `redis${i + 1}`, url: url.trim() }))
  : [];

// Chunk size for Telegram uploads (19MB)
export const TELEGRAM_CHUNK_SIZE = 19 * 1024 * 1024;

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'nexo-dev-fallback-not-for-production',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:6023', 'http://localhost:3000', 'http://192.168.0.136:6023'],
  uploadsDir: 'uploads',
  minPasswordLength: 6,
  maxRegistrationsPerIp: Number(process.env.MAX_REGISTRATIONS_PER_IP) || 10,
  turnUrl: process.env.TURN_URL || '',
  turnSecret: process.env.TURN_SECRET || '',
  stunUrls: (process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',').map(s => s.trim()).filter(Boolean),
  // Storage mode: 'local' or 'telegram'
  storageMode: (process.env.STORAGE_MODE || 'telegram') as 'local' | 'telegram',
  // Database URL - Neon PostgreSQL
  databaseUrl: process.env.DATABASE_URL || '',
  databaseUrlBackup: process.env.DATABASE_URL_BACKUP || '',
  // Redis - primary instance
  redisUrl: process.env.REDIS_URL || '',
  // Redis - secondary instance (for sessions/cache)
  redisSessionUrl: process.env.REDIS_SESSION_URL || '',
};
