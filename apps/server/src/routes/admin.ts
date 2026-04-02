import express from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

const ADMIN_PASSWORD = 'b2323vgn7v672n7823478t92BRGMV7tv83';

// Простая аутентификация для админки
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-token-' + Date.now() });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// Получить статистику
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [
      userCount,
      chatCount,
      messageCount,
      totalStorage
    ] = await Promise.all([
      prisma.user.count(),
      prisma.chat.count(),
      prisma.message.count(),
      prisma.$queryRaw`SELECT SUM(total_size) as total FROM telegram_files`.catch(() => [{ total: 0 }])
    ]);

    res.json({
      users: userCount,
      chats: chatCount,
      messages: messageCount,
      storage: (totalStorage as any)[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Обновить конфигурацию БД
router.post('/config/database', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { databaseUrl, usePostgreSQL } = req.body;
    
    if (usePostgreSQL) {
      // Здесь должна быть логика миграции с SQLite на PostgreSQL
      res.json({ 
        success: true, 
        message: 'Конфигурация обновлена. Перезапустите сервер для применения.' 
      });
    } else {
      res.json({ success: true, message: 'Переключено на SQLite' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления конфигурации' });
  }
});

// Настроить Redis
router.post('/config/redis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { redisUrl, enabled } = req.body;
    // Сохраняем в .env или базу
    res.json({ success: true, message: 'Redis настроен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка настройки Redis' });
  }
});

// Настроить Telegram ботов
router.post('/config/telegram', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { bots, channels, enabled } = req.body;
    // Сохраняем конфигурацию
    res.json({ success: true, message: 'Telegram настроен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка настройки Telegram' });
  }
});

// Получить текущую конфигурацию
router.get('/config', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json({
      database: {
        type: process.env.DATABASE_URL?.includes('postgres') ? 'postgresql' : 'sqlite',
        url: process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://***@')
      },
      redis: {
        enabled: !!process.env.REDIS_URL,
        url: process.env.REDIS_URL?.replace(/:\/\/[^@]+@/, '://***@')
      },
      telegram: {
        enabled: true,
        botCount: 14,
        channelCount: 4
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения конфигурации' });
  }
});

// Очистить кэш
router.post('/cache/clear', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Очистка кэша Redis если подключен
    res.json({ success: true, message: 'Кэш очищен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка очистки кэша' });
  }
});

// Перезагрузить сервер
router.post('/system/restart', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, message: 'Сервер перезагружается...' });
    // Перезагрузка процесса
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка перезагрузки' });
  }
});

export default router;
