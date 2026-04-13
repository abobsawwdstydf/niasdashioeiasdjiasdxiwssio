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
  token: process.env.TELEGRAM_BOT_TOKEN || '8661523111:AAHc7stzcAhW6COBNwiyrHMHZsOvOvYfXTg',
  username: process.env.TELEGRAM_BOT_USERNAME || 'nexo_auth_bot',
};

export const TELEGRAM_BOTS = [
  { id: 1, token: '8661523111:AAHc7stzcAhW6COBNwiyrHMHZsOvOvYfXTg' },
  { id: 2, token: '8674460757:AAFm7WVkDx4ISkx22toTQyrQUeGQfLdF8QM' },
  { id: 3, token: '8733182475:AAFBitv4g4LVRuvGnssyqHQpttBydeAda9Y' },
  { id: 4, token: '8774720953:AAGvExABKj4Z-DYfKdqF-OMEdoeySeOeOoY' },
  { id: 5, token: '8141008503:AAEaCM1RrN2ppbZmUzhpW4EeLUgT1qQ2QS0' },
  { id: 6, token: '8687986079:AAGPYjnq4gdXCkf2wT81f0l2tQalKCIIyds' },
  { id: 7, token: '8758985233:AAF7QfRApnccaByBYa1qjGs7u-erQ47OZcQ' },
  { id: 8, token: '8554202189:AAGN0wLfcgkqK3KJ9XOJFl40rp2kjkIcm1Y' },
  { id: 9, token: '8748554768:AAEnJcHklmilbjih9glo3GITnQXSx4YmM_8' },
  { id: 10, token: '8744960493:AAHB5bn3VxlZWKJjCr70yLYJnVTyXp2zHIs' },
  { id: 11, token: '8734408678:AAH7eTD97tepfwqdYKieNOoxsGZaEdPYWhI' },
  { id: 12, token: '8141208214:AAFOOel84oRN3Uj8rEOWI_6H3LaAa6Z76Q0' },
  { id: 13, token: '8758209438:AAEnaXcJ7ke88fjjHNPwQVTt_u9LYrSzPFk' },
  { id: 14, token: '8680953724:AAFbz6yKdLC0ANkwTbLsZ0GSN78zVbTWUb8' },
  { id: 15, token: '8743205528:AAF2V2Z8UU5A3aJiSd5JveswVen_immyp9E' },
];

// Telegram storage channels
export const TELEGRAM_CHANNELS = [
  { id: 1, chatId: '-1003850596987' },
  { id: 2, chatId: '-1003878106202' },
  { id: 3, chatId: '-1003868880877' },
  { id: 4, chatId: '-1003738083520' },
];

// Redis instances
export const REDIS_INSTANCES = [
  { id: 'redis1', url: 'redis://default:MGch5HFdB5uSNjyqgLQs20qyg02CmJMx@redis-10339.c11.us-east-1-3.ec2.cloud.redislabs.com:10339' },
  { id: 'redis2', url: 'redis://default:XD4qOpGD62LlT6xtCjB7DJyJzZuuBLVq@redis-17550.c266.us-east-1-3.ec2.cloud.redislabs.com:17550' },
  { id: 'redis3', url: 'redis://default:YmDlMjlsmXYjoFH13l0SWHPf0C23tXau@redis-18158.c14.us-east-1-2.ec2.cloud.redislabs.com:18158' },
  { id: 'redis4', url: 'redis://default:x69uHtIDnVVRf371e3HYOb4BZNfBjNHS@redis-13102.c17.us-east-1-4.ec2.cloud.redislabs.com:13102' },
];

// Chunk size for Telegram uploads (19MB)
export const TELEGRAM_CHUNK_SIZE = 19 * 1024 * 1024;

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'nexo-dev-fallback-not-for-production',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:6023', 'http://localhost:3000', 'http://192.168.0.136:6023', true],
  uploadsDir: 'uploads',
  minPasswordLength: 6,
  maxRegistrationsPerIp: Number(process.env.MAX_REGISTRATIONS_PER_IP) || 10,
  turnUrl: process.env.TURN_URL || '',
  turnSecret: process.env.TURN_SECRET || '',
  stunUrls: (process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',').map(s => s.trim()).filter(Boolean),
  // Storage mode: 'local' or 'telegram'
  storageMode: (process.env.STORAGE_MODE || 'telegram') as 'local' | 'telegram',
  // Database URL - Neon PostgreSQL (с fallback на вторую базу)
  databaseUrl: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_mHu8QNo4czxK@ep-divine-smoke-aintwcj6-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  databaseUrlBackup: process.env.DATABASE_URL_BACKUP || '',
  // Redis - primary instance
  redisUrl: process.env.REDIS_URL || 'redis://default:MGch5HFdB5uSNjyqgLQs20qyg02CmJMx@redis-10339.c11.us-east-1-3.ec2.cloud.redislabs.com:10339',
  // Redis - secondary instance (for sessions/cache)
  redisSessionUrl: process.env.REDIS_SESSION_URL || 'redis://default:XD4qOpGD62LlT6xtCjB7DJyJzZuuBLVq@redis-17550.c266.us-east-1-3.ec2.cloud.redislabs.com:17550',
};
