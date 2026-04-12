import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mime from 'mime-types';
import { config, TELEGRAM_BOTS, TELEGRAM_AUTH_BOT } from './config';
import { prisma } from './db';
import authRoutes from './routes/auth';

// Initialize database connection
prisma.$connect().then(() => {
  console.log('  ✓ БД подключена');
}).catch(err => {
  console.error('Failed to connect DB:', err);
  process.exit(1);
});
import userRoutes from './routes/users';
import chatRoutes from './routes/chats';
import messageRoutes from './routes/messages';
import storyRoutes from './routes/stories';
import friendRoutes from './routes/friends';
import callLogRoutes from './routes/callLogs';
import messageViewRoutes from './routes/messageViews';
import adminRoutes from './routes/admin';
import { setupSocket } from './socket';
import { authenticateToken, AuthRequest } from './middleware/auth';
import { decryptFileToBuffer, isEncryptionEnabled } from './encrypt';
import { UPLOADS_ROOT } from './shared';
import { setupTunnel, sendEmailTask, getTunnelInfo } from './tunnel';

// Disable all console logs for performance
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  // Keep console.error for debugging
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Trust first proxy (Nginx) so req.ip returns real client IP from X-Forwarded-For
app.set('trust proxy', 1);

// ─── Инициализация туннеля ───
const tunnelSecret = process.env.TUNNEL_SECRET || 'nexo-tunnel-dev-fallback';
setupTunnel(server, tunnelSecret);

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10mb' }));

// Файлы больше не хранятся локально - всё в Telegram!
// Serve uploads удален - файлы скачиваются из Telegram по запросу

// Rate limiting for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 attempts per window for development
  message: { error: 'Слишком много попыток, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter (1000 req/min per IP for development)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API маршруты
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, authenticateToken, userRoutes);
app.use('/api/chats', apiLimiter, authenticateToken, chatRoutes);
app.use('/api/stories', apiLimiter, authenticateToken, storyRoutes);
app.use('/api/friends', apiLimiter, authenticateToken, friendRoutes);
app.use('/api/call-logs', apiLimiter, authenticateToken, callLogRoutes);
app.use('/api/messages', apiLimiter, authenticateToken, messageViewRoutes);
app.use('/api/messages', apiLimiter, authenticateToken, messageRoutes);
app.use('/api/threads', apiLimiter, authenticateToken, require('./routes/threads').default);
app.use('/api/ai', apiLimiter, authenticateToken, require('./routes/ai').default);
app.use('/api/admin', adminRoutes);

// ─── Telegram Auth Bot (Long Polling — без webhook!) ───
async function startTelegramBot() {
  const botToken = TELEGRAM_AUTH_BOT.token;
  let offset = 0;

  console.log(`🤖 Telegram бот запущен (@${TELEGRAM_AUTH_BOT.username})`);

  // Удаляем webhook если был установлен
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
  } catch {}

  async function getUpdates() {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=30`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (!data.ok || !data.result) return;

      for (const update of data.result) {
        offset = update.update_id + 1;
        const message = update.message;
        if (!message?.text) continue;

        const chatId = message.chat.id;
        const text = message.text;

        console.log(`[TG] Сообщение: ${text}`);

        // /start verify_TOKEN
        const match = text.match(/^\/start verify_([a-zA-Z0-9]+)/i);
        if (match) {
          const token = match[1];
          console.log(`[TG] Верификация: ${token}`);

          const pending = (global as any).__pendingRegistrations?.get(token);

          if (!pending) {
            console.log(`[TG] Токен НЕ НАЙДЕН. Всего pending: ${(global as any).__pendingRegistrations?.size || 0}`);
            await tgSend(chatId, botToken,
              `⏰ Ссылка устарела или не найдена.\n\n` +
              `Начните регистрацию заново на сайте.`
            );
            continue;
          }

          console.log(`[TG] Токен найден! ${pending.username} / ${pending.phone}`);

          // Генерируем код если ещё нет
          if (!pending.verifyCode) {
            pending.verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
            pending.verifyExpiresAt = Date.now() + 5 * 60 * 1000;
            console.log(`[TG] Код сгенерирован: ${pending.verifyCode}`);
          }

          const minsLeft = Math.max(0, Math.floor((pending.verifyExpiresAt - Date.now()) / 60000));
          await tgSend(chatId, botToken,
            `🎉 Добро пожаловать в Nexo!\n\n` +
            `🔐 Ваш код: ${pending.verifyCode}\n\n` +
            `⏱ Код действует ещё ${minsLeft} мин.\n\n` +
            `Введите этот код на сайте.`
          );
          console.log(`[TG] Код отправлен в чат ${chatId}`);
          continue;
        }

        if (text === '/start') {
          await tgSend(chatId, botToken,
            `👋 Привет! Я бот Nexo.\n\n` +
            `Для подтверждения номера перейдите по ссылке с сайта.`
          );
        }
      }
    } catch (err) {
      console.error('[TG] Ошибка getUpdates:', err.message);
    }
  }

  // Poll каждые 2 секунды
  setInterval(getUpdates, 2000);
  getUpdates();
}

async function tgSend(chatId: number | string, token: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    console.error(`[TG] Ошибка отправки:`, body);
  }
}

// Проверка здоровья
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Nexo Server' });
});

// ─── Tunnel Status ───
app.get('/api/tunnel-status', (_req, res) => {
  res.json(getTunnelInfo());
});

// ─── Send Email (вызывается мессенджером) ───
app.post('/api/send-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { to, subject, html, from, fromName } = req.body;
    if (!to || !subject) {
      res.status(400).json({ error: 'to и subject обязательны' });
      return;
    }
    const result = await sendEmailTask({ to, subject, html: html || subject, from, fromName });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка отправки' });
  }
});

// Админ панель
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel.html'));
});

// Serve static files from web dist (../web/dist relative to src/)
const webDistPath = path.resolve(__dirname, '..', 'web', 'dist');
console.log('Serving web from:', webDistPath);
app.use(express.static(webDistPath));

// Serve public files (badges, etc.)
const publicPath = path.resolve(__dirname, '..', 'web', 'public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for all other routes
app.get('*', (_req, res) => {
  const indexPath = path.join(webDistPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath);
});

// ICE серверы для WebRTC звонков
app.get('/api/ice-servers', authenticateToken, (_req: AuthRequest, res) => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];

  // STUN серверы
  if (config.stunUrls.length > 0) {
    iceServers.push({ urls: config.stunUrls });
  }

  // TURN сервер с временными credentials (coturn --use-auth-secret)
  if (config.turnUrl && config.turnSecret) {
    const ttl = 24 * 3600; // 24 часа
    const timestamp = Math.floor(Date.now() / 1000) + ttl;
    const username = `${timestamp}:nexo`;
    const credential = crypto
      .createHmac('sha1', config.turnSecret)
      .update(username)
      .digest('base64');

    iceServers.push({
      urls: config.turnUrl,
      username,
      credential,
    });
  }

  res.json({ iceServers });
});

// Socket.io
setupSocket(io);

// Endpoint для скачивания файлов из Telegram
import { telegramStorage } from './lib/telegramStorage';

app.get('/api/files/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId || !fileId.startsWith('tg_')) {
      res.status(400).json({ error: 'Неверный ID файла' });
      return;
    }

    const telegramFile = await prisma.telegramFile.findUnique({
      where: { fileId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } }
    });

    if (!telegramFile) {
      res.status(404).json({ error: 'Файл не найден в БД' });
      return;
    }

    const fileBuffer = await telegramStorage.downloadFile(
      telegramFile.fileId,
      telegramFile.chunks
    );

    // Обновляем статистику
    await prisma.telegramFile.update({
      where: { fileId },
      data: {
        lastAccessed: new Date(),
        accessCount: { increment: 1 }
      }
    });

    // Отправляем файл клиенту
    // Для изображений, видео и аудио используем inline (браузер показывает/воспроизводит)
    // Для остальных файлов - attachment (скачивание)
    const isInline = telegramFile.mimeType.startsWith('image/') ||
                     telegramFile.mimeType.startsWith('video/') ||
                     telegramFile.mimeType.startsWith('audio/');

    if (isInline) {
      res.setHeader('Content-Type', telegramFile.mimeType);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Accept-Ranges', 'bytes');
      // Support range requests for audio/video seeking
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;
        const chunk = fileBuffer.slice(start, end + 1);
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileBuffer.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunk.length,
          'Content-Type': telegramFile.mimeType,
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(chunk);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(telegramFile.originalName)}"`);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.end(fileBuffer);
      }
    } else {
      res.setHeader('Content-Type', telegramFile.mimeType);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(telegramFile.originalName)}"`);
      res.end(fileBuffer);
    }

  } catch (error: any) {
    console.error('❌ ОШИБКА СКАЧИВАНИЯ:', error.message);
    res.status(500).json({ error: 'Ошибка скачивания: ' + error.message });
  }
});

// При старте сервера сбросить всех в offline
prisma.user.updateMany({ data: { isOnline: false, lastSeen: new Date() } })
  .then(() => console.log('  ✔ Все пользователи сброшены в offline'))
  .catch((e: unknown) => console.error('Ошибка сброса онлайн-статусов:', e));

// Cleanup expired stories (every 10 minutes)
import { deleteUploadedFile } from './shared';

async function cleanupExpiredStories() {
  try {
    const expired = await prisma.story.findMany({
      where: { expiresAt: { lte: new Date() } },
      select: { id: true, mediaUrl: true },
    });

    if (expired.length === 0) return;

    for (const story of expired) {
      if (story.mediaUrl) deleteUploadedFile(story.mediaUrl);
    }

    const ids = expired.map(s => s.id);
    // Cascade handles StoryView deletion via schema onDelete: Cascade
    await prisma.story.deleteMany({ where: { id: { in: ids } } });
  } catch (e) {
    // Silent cleanup
  }
}

cleanupExpiredStories();
setInterval(cleanupExpiredStories, 10 * 60 * 1000);

// Start server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n  ⚡ Nexo Server запущен на порту ${config.port}\n`);
  console.log(`  📡 Локально: http://localhost:${config.port}`);
  console.log(`  🌐 В сети: http://<ваш-IP>:${config.port}\n`);
});

// Graceful shutdown
const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
