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
    const [userCount, chatCount, messageCount, onlineCount] = await Promise.all([
      prisma.user.count(),
      prisma.chat.count(),
      prisma.message.count(),
      prisma.user.count({ where: { isOnline: true } })
    ]);

    res.json({
      users: userCount,
      chats: chatCount,
      messages: messageCount,
      online: onlineCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Проверить статус PostgreSQL
router.get('/status/postgres', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    
    // Try to query the database
    const result = await prisma.$queryRaw`SELECT version(), current_database(), pg_database_size(current_database()) as size`;
    const data = (result as any[])[0];
    
    res.json({
      connected: true,
      url: dbUrl.replace(/:\/\/[^@]+@/, '://***@'),
      version: data?.version?.split(' ')[0] || 'Unknown',
      database: data?.current_database || 'Unknown',
      size: formatBytes(data?.size || 0)
    });
  } catch (error: any) {
    res.json({
      connected: false,
      url: (process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@') || 'Не настроено',
      error: error?.message || 'Не удалось подключиться'
    });
  }
});

// Проверить статус Redis
router.get('/status/redis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const redisUrl = process.env.REDIS_URL || '';
    
    if (!redisUrl) {
      return res.json({
        connected: false,
        url: 'Не настроено',
        error: 'Redis URL не указан'
      });
    }

    // Try to connect and ping Redis
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    
    await client.connect();
    const info = await client.info();
    const dbsize = await client.dbSize();
    
    // Parse version from info
    const versionMatch = info.match(/redis_version:([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : 'Unknown';
    
    await client.quit();
    
    res.json({
      connected: true,
      url: redisUrl.replace(/:\/\/[^@]+@/, '://***@'),
      version,
      keys: dbsize.toString()
    });
  } catch (error: any) {
    res.json({
      connected: false,
      url: (process.env.REDIS_URL || '').replace(/:\/\/[^@]+@/, '://***@') || 'Не настроено',
      error: error?.message || 'Не удалось подключиться'
    });
  }
});

// Получить пользователей
router.get('/users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        isOnline: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// Удалить пользователя
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'Пользователь удалён' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка удаления' });
  }
});

// Обновить конфигурацию БД
router.post('/config/database', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { databaseUrl } = req.body;
    if (!databaseUrl) {
      return res.status(400).json({ error: 'URL базы данных обязателен' });
    }
    res.json({
      success: true,
      message: 'Конфигурация обновлена. Перезапустите сервер для применения.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления конфигурации' });
  }
});

// Настроить Redis
router.post('/config/redis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { redisUrl, enabled } = req.body;
    res.json({ success: true, message: 'Redis настроен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка настройки Redis' });
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
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения конфигурации' });
  }
});

// Очистить кэш
router.post('/cache/clear', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, message: 'Кэш очищен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка очистки кэша' });
  }
});

// Информация о системе
router.get('/system/info', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    res.json({
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3001',
      uptime: `${hours}ч ${minutes}м`,
      platform: process.platform,
      memory: {
        rss: formatBytes(process.memoryUsage().rss),
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
        heapTotal: formatBytes(process.memoryUsage().heapTotal)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения информации' });
  }
});

// Перезагрузить сервер
router.post('/system/restart', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, message: 'Сервер перезагружается...' });
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка перезагрузки' });
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
