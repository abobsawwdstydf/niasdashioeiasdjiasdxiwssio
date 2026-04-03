import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mime from 'mime-types';
import { config } from './config';
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

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10mb' }));

// Serve uploads — decrypts encrypted files on the fly
app.use('/uploads', (req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('Cache-Control', 'private, max-age=86400');

  // Resolve file path safely
  const urlPath = decodeURIComponent(req.path);
  if (urlPath.includes('..')) {
    res.status(400).end();
    return;
  }

  const filePath = path.resolve(UPLOADS_ROOT, urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(UPLOADS_ROOT) || !fs.existsSync(filePath)) {
    res.status(404).end();
    return;
  }

  // Set Content-Type from extension
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  // If encryption is enabled, try to decrypt
  if (isEncryptionEnabled()) {
    const decrypted = decryptFileToBuffer(filePath);
    if (decrypted) {
      res.setHeader('Content-Length', decrypted.length);
      res.end(decrypted);
      return;
    }
    // Decryption failed — file is likely unencrypted (legacy), fall through to static
  }

  // Serve unencrypted file as-is
  next();
}, express.static(UPLOADS_ROOT));

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
app.use('/api/admin', adminRoutes);

// Проверка здоровья
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Nexo Server' });
});

// Админ панель
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel.html'));
});

// Serve static files from web dist (../web/dist relative to src/)
const webDistPath = path.resolve(__dirname, '..', 'web', 'dist');
console.log('Serving web from:', webDistPath);
app.use(express.static(webDistPath));

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
