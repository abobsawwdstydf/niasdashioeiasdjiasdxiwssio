import express from 'express';
import multer from 'multer';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { telegramStorage } from '../lib/telegramStorage';
import { redisCache } from '../lib/redisCache';
import { encryptFile, decryptFile } from '../lib/fileEncryption';
import { ENCRYPTION_LEVELS } from '../lib/fileEncryption';
import { prisma } from '../db';

const router = express.Router();

// Configure multer for memory storage (we'll handle chunking ourselves)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max (will be chunked)
  },
});

/**
 * Upload file to Telegram storage
 * POST /api/files/upload
 * Query: encryptionLevel (0-3)
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не предоставлен' });
      return;
    }

    const userId = req.userId!;
    const encryptionLevel = parseInt(String(req.query.encryptionLevel)) || ENCRYPTION_LEVELS.STANDARD;
    
    console.log(`\n📤 Загрузка файла: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  🔐 Уровень шифрования: ${encryptionLevel}`);

    // Encrypt file before uploading
    let fileBuffer = req.file.buffer;
    if (encryptionLevel > 0) {
      console.log(`  🔒 Шифрование файла...`);
      const encrypted = encryptFile(fileBuffer, encryptionLevel);
      fileBuffer = encrypted.data;
      console.log(`  ✓ Файл зашифрован (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Upload to Telegram
    const storedFile = await telegramStorage.uploadFile(
      fileBuffer,
      String(req.file.originalname),
      String(req.file.mimetype),
      userId,
      encryptionLevel
    );

    // Save metadata to database
    const telegramFile = await prisma.telegramFile.create({
      data: {
        fileId: storedFile.fileId,
        userId,
        originalName: storedFile.originalName,
        mimeType: storedFile.mimeType,
        totalSize: storedFile.totalSize,
        encryptionLevel: storedFile.encryptionLevel,
        chunks: {
          create: storedFile.chunks.map(chunk => ({
            fileId: storedFile.fileId,
            chunkIndex: chunk.chunkIndex,
            channelId: chunk.channelId,
            messageId: chunk.messageId,
            botId: chunk.botId,
            size: chunk.size,
          })),
        },
      },
      include: {
        chunks: true,
      },
    });

    console.log(`  ✓ Файл загружен в Telegram (ID: ${telegramFile.id})`);

    res.json({
      success: true,
      fileId: telegramFile.id,
      dbId: telegramFile.id,
      originalName: telegramFile.originalName,
      mimeType: telegramFile.mimeType,
      totalSize: telegramFile.totalSize,
      encryptionLevel: telegramFile.encryptionLevel,
      chunkCount: telegramFile.chunks.length,
      createdAt: telegramFile.createdAt,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Ошибка загрузки файла' });
  }
});

/**
 * Download file from Telegram storage
 * GET /api/files/download/:fileId
 */
router.get('/download/:fileId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const fileId = String(req.params.fileId);

    console.log(`\n📥 Скачивание файла: ${fileId}`);

    // Get file metadata from database
    const telegramFile: any = await prisma.telegramFile.findUnique({
      where: { id: fileId },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!telegramFile) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }

    // Check ownership
    if (telegramFile.userId !== userId) {
      res.status(403).json({ error: 'Нет доступа к файлу' });
      return;
    }

    // Try to get from Redis cache first
    const cached = await redisCache.getCachedFile(fileId);
    if (cached) {
      console.log(`  💾 Отправка из кэша...`);
      
      // Update access stats
      await prisma.telegramFile.update({
        where: { id: fileId },
        data: {
          lastAccessed: new Date(),
          accessCount: telegramFile.accessCount + 1,
        },
      });

      res.setHeader('Content-Type', telegramFile.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${telegramFile.originalName}"`);
      res.setHeader('Content-Length', cached.length);
      res.send(cached);
      return;
    }

    // Download from Telegram
    console.log(`  ⬇️ Скачивание ${telegramFile.chunks.length} чанков из Telegram...`);
    let fileBuffer = await telegramStorage.downloadFile(
      telegramFile.fileId,
      telegramFile.chunks.map(c => ({
        channelId: c.channelId,
        messageId: c.messageId,
        botId: c.botId,
        chunkIndex: c.chunkIndex,
        size: c.size,
      }))
    );

    // Decrypt if needed
    if (telegramFile.encryptionLevel > 0) {
      console.log(`  🔓 Расшифровка файла...`);
      const encrypted = {
        data: fileBuffer,
        iv: '', // IV is embedded in the data for MAX encryption
        authTag: '',
        level: telegramFile.encryptionLevel,
      };
      const decrypted = decryptFile(encrypted);
      fileBuffer = decrypted.data;
      console.log(`  ✓ Файл расшифрован (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Cache in Redis for 1 hour
    await redisCache.cacheFile(fileId, fileBuffer, 3600);

    // Update access stats
    await prisma.telegramFile.update({
      where: { id: fileId },
      data: {
        lastAccessed: new Date(),
        accessCount: telegramFile.accessCount + 1,
      },
    });

    console.log(`  ✓ Файл отправлен пользователю`);

    res.setHeader('Content-Type', telegramFile.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${telegramFile.originalName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message || 'Ошибка скачивания файла' });
  }
});

/**
 * Delete file from Telegram storage
 * DELETE /api/files/delete/:fileId
 */
router.delete('/delete/:fileId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const fileId = req.params.fileId;

    console.log(`\n🗑️ Удаление файла: ${fileId}`);

    // Get file metadata
    const telegramFile = await prisma.telegramFile.findUnique({
      where: { id: fileId },
      include: {
        chunks: true,
      },
    });

    if (!telegramFile) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }

    // Check ownership
    if (telegramFile.userId !== userId) {
      res.status(403).json({ error: 'Нет доступа к файлу' });
      return;
    }

    // Delete from Telegram
    await telegramStorage.deleteFile(
      telegramFile.chunks.map(c => ({
        channelId: c.channelId,
        messageId: c.messageId,
        botId: c.botId,
        chunkIndex: c.chunkIndex,
        size: c.size,
      }))
    );

    // Delete from Redis cache
    await redisCache.invalidateFile(fileId);

    // Delete from database
    await prisma.telegramFile.delete({
      where: { id: fileId },
    });

    console.log(`  ✓ Файл удалён`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message || 'Ошибка удаления файла' });
  }
});

/**
 * Get user's uploaded files
 * GET /api/files/list
 */
router.get('/list', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const files = await prisma.telegramFile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileId: true,
        originalName: true,
        mimeType: true,
        totalSize: true,
        encryptionLevel: true,
        createdAt: true,
        lastAccessed: true,
        accessCount: true,
        _count: {
          select: { chunks: true },
        },
      },
    });

    res.json({
      files: files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        totalSize: f.totalSize,
        encryptionLevel: f.encryptionLevel,
        chunkCount: f._count.chunks,
        createdAt: f.createdAt,
        lastAccessed: f.lastAccessed,
        accessCount: f.accessCount,
      })),
    });
  } catch (error: any) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения списка файлов' });
  }
});

/**
 * Get storage stats
 * GET /api/files/stats
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const [files, telegramStats, redisStats] = await Promise.all([
      prisma.telegramFile.aggregate({
        where: { userId },
        _count: { id: true },
        _sum: { totalSize: true },
      }),
      telegramStorage.getStats(),
      redisCache.getStats(),
    ]);

    res.json({
      userFiles: {
        count: files._count.id,
        totalSize: files._sum.totalSize || 0,
      },
      telegram: telegramStats,
      redis: redisStats,
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения статистики' });
  }
});

export default router;
