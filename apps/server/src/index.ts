import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
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
import { startSelfDestructCleanup } from './lib/selfDestructCleanup';
import { localStorage } from './lib/localStorage';

// Redirect old /uploads/files/ paths to new API
app.get('/uploads/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  console.log(`[FILES] Redirecting old path /uploads/files/${fileId} to /api/files/${fileId}/download`);
  res.redirect(301, `/api/files/${fileId}/download`);
});

app.get('/api/files/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log(`[FILES] Download request: ${fileId}`);

    // CORS for media
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (!fileId) {
      console.warn(`[FILES] Invalid fileId: ${fileId}`);
      res.status(400).json({ error: 'Неверный ID файла' });
      return;
    }

    // Try local storage first (new system)
    if (fileId.startsWith('local_')) {
      const localFile = await prisma.localFile.findUnique({
        where: { fileId },
        include: { chunks: { orderBy: { chunkIndex: 'asc' } } }
      });

      if (!localFile) {
        console.warn(`[FILES] File ${fileId} not found in DB`);
        res.status(404).json({ error: 'Файл не найден' });
        return;
      }

      if (!localFile.chunks || localFile.chunks.length === 0) {
        console.warn(`[FILES] File ${fileId} has no chunks`);
        res.status(404).json({ error: 'Файл повреждён (нет чанков)' });
        return;
      }

      console.log(`[FILES] File found: ${localFile.originalName} (${localFile.mimeType}, ${localFile.totalSize}b, ${localFile.chunks.length} chunks)`);

      let fileBuffer: Buffer;
      try {
        fileBuffer = await localStorage.downloadFile(localFile.fileId, localFile.chunks);
      } catch (downloadError: any) {
        console.error(`[FILES] Download error:`, downloadError.message);
        res.status(503).json({ error: 'Файл временно недоступен' });
        return;
      }

      console.log(`[FILES] File downloaded: ${fileBuffer.length}b`);

      await prisma.localFile.update({
        where: { fileId },
        data: { lastAccessed: new Date(), accessCount: { increment: 1 } }
      }).catch(() => {}); // ignore update errors

      const isInline = localFile.mimeType.startsWith('image/') ||
                       localFile.mimeType.startsWith('video/') ||
                       localFile.mimeType.startsWith('audio/');

      if (isInline) {
        res.setHeader('Content-Type', localFile.mimeType);
        res.setHeader('Content-Length', fileBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;

          if (start >= fileBuffer.length) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileBuffer.length}` });
            res.end();
            return;
          }

          const chunk = fileBuffer.slice(start, Math.min(end + 1, fileBuffer.length));
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${Math.min(end, fileBuffer.length - 1)}/${fileBuffer.length}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunk.length,
            'Content-Type': localFile.mimeType,
          });
          res.end(chunk);
        } else {
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(localFile.originalName)}"`);
          res.end(fileBuffer);
        }
      } else {
        res.setHeader('Content-Type', localFile.mimeType);
        res.setHeader('Content-Length', fileBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(localFile.originalName)}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.end(fileBuffer);
      }
      return;
    }

    res.status(400).json({ error: 'Неподдерживаемый тип файла' });

  } catch (error: any) {
    console.error('[FILES] Download error:', error.message, error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка скачивания: ' + error.message });
    }
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

// Start self-destruct message cleanup
startSelfDestructCleanup();

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
