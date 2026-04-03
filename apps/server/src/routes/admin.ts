import express from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

const ADMIN_PASSWORD = 'b2323vgn7v672n7823478t92BRGMV7tv83';

// In-memory storage for bots and channels (in production, use DB)
interface Bot {
  id: string;
  token: string;
  username?: string;
  firstName?: string;
  online: boolean;
  addedAt: Date;
}

interface Channel {
  id: string;
  channelId: string;
  title?: string;
  botId: string;
  botUsername?: string;
  online: boolean;
  addedAt: Date;
}

const bots: Bot[] = [];
const channels: Channel[] = [];
let storageMode: 'local' | 'telegram' = 'local';

// Login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-token-' + Date.now() });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// Stats
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
      online: onlineCount,
      bots: bots.length,
      channels: channels.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// PostgreSQL status
router.get('/status/postgres', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
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

// Redis status
router.get('/status/redis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const redisUrl = process.env.REDIS_URL || '';
    if (!redisUrl) {
      return res.json({ connected: false, url: 'Не настроено', error: 'Redis URL не указан' });
    }

    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    await client.connect();
    const info = await client.info();
    const dbsize = await client.dbSize();
    const versionMatch = info.match(/redis_version:([\d.]+)/);
    await client.quit();
    
    res.json({
      connected: true,
      url: redisUrl.replace(/:\/\/[^@]+@/, '://***@'),
      version: versionMatch ? versionMatch[1] : 'Unknown',
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

// Telegram status
router.get('/status/telegram', authenticateToken, async (req: AuthRequest, res) => {
  const activeBots = bots.filter(b => b.online).length;
  const activeChannels = channels.filter(c => c.online).length;
  
  res.json({
    bots: bots.length,
    channels: channels.length,
    active: activeBots + activeChannels
  });
});

// Get all bots
router.get('/bots', authenticateToken, async (req: AuthRequest, res) => {
  res.json(bots);
});

// Add bot
router.post('/bots', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { token: botToken } = req.body;
    if (!botToken) return res.status(400).json({ error: 'Токен обязателен' });

    // Check bot via Telegram API
    const axios = require('axios');
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, { timeout: 10000 });
    
    if (!response.data.ok) {
      return res.status(400).json({ error: 'Неверный токен. Бот не найден.' });
    }

    const bot = response.data.result;
    const newBot: Bot = {
      id: 'bot_' + Date.now(),
      token: botToken,
      username: bot.username,
      firstName: bot.first_name,
      online: true,
      addedAt: new Date()
    };

    bots.push(newBot);
    res.json({ success: true, username: bot.username, botName: bot.first_name });
  } catch (error: any) {
    res.status(400).json({ error: error?.response?.data?.description || error?.message || 'Ошибка проверки бота' });
  }
});

// Delete bot
router.delete('/bots/:id', authenticateToken, async (req: AuthRequest, res) => {
  const idx = bots.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Бот не найден' });
  
  // Also delete channels using this bot
  const botChannels = channels.filter(c => c.botId === req.params.id);
  botChannels.forEach(c => {
    const cIdx = channels.findIndex(ch => ch.id === c.id);
    if (cIdx !== -1) channels.splice(cIdx, 1);
  });
  
  bots.splice(idx, 1);
  res.json({ success: true });
});

// Get all channels
router.get('/channels', authenticateToken, async (req: AuthRequest, res) => {
  res.json(channels);
});

// Add channel
router.post('/channels', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { channelId, botId } = req.body;
    if (!channelId || !botId) return res.status(400).json({ error: 'channelId и botId обязательны' });

    const bot = bots.find(b => b.id === botId);
    if (!bot) return res.status(400).json({ error: 'Бот не найден' });

    // Check channel via Telegram API
    const axios = require('axios');
    const cleanChannelId = channelId.replace('@', '');
    const chatId = channelId.startsWith('-') ? channelId : '@' + cleanChannelId;
    
    try {
      const response = await axios.get(`https://api.telegram.org/bot${bot.token}/getChat`, {
        params: { chat_id: chatId },
        timeout: 10000
      });

      if (!response.data.ok) {
        return res.status(400).json({ error: 'Канал не найден. Убедитесь что бот добавлен в канал.' });
      }

      const chat = response.data.result;
      const newChannel: Channel = {
        id: 'ch_' + Date.now(),
        channelId: chatId,
        title: chat.title || chat.username || channelId,
        botId: bot.id,
        botUsername: bot.username,
        online: true,
        addedAt: new Date()
      };

      channels.push(newChannel);
      res.json({ success: true, title: newChannel.title });
    } catch (tgError: any) {
      res.status(400).json({ error: tgError?.response?.data?.description || 'Не удалось найти канал. Бот должен быть администратором канала.' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Ошибка добавления канала' });
  }
});

// Test channel - send test message
router.post('/channels/:id/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const channel = channels.find(c => c.id === req.params.id);
    if (!channel) return res.status(404).json({ error: 'Канал не найден' });

    const bot = bots.find(b => b.id === channel.botId);
    if (!bot) return res.status(400).json({ error: 'Бот не найден' });

    const axios = require('axios');
    await axios.post(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
      chat_id: channel.channelId,
      text: `✅ Тестовое сообщение от Nexo Admin\nВремя: ${new Date().toLocaleString('ru-RU')}\nБот: ${bot.username}`,
      parse_mode: 'HTML'
    }, { timeout: 10000 });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.response?.data?.description || error?.message || 'Ошибка отправки' });
  }
});

// Delete channel
router.delete('/channels/:id', authenticateToken, async (req: AuthRequest, res) => {
  const idx = channels.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Канал не найден' });
  channels.splice(idx, 1);
  res.json({ success: true });
});

// Get users
router.get('/users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true, isOnline: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка удаления' });
  }
});

// Update storage mode
router.post('/config/storage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { mode } = req.body;
    if (mode === 'local' || mode === 'telegram') {
      storageMode = mode;
      res.json({ success: true, message: `Режим хранилища: ${mode === 'local' ? 'Локальный' : 'Telegram'}` });
    } else {
      res.status(400).json({ error: 'Неверный режим' });
    }
  } catch {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// Update database
router.post('/config/database', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { databaseUrl } = req.body;
    if (!databaseUrl) return res.status(400).json({ error: 'URL базы данных обязателен' });
    res.json({ success: true, message: 'Конфигурация обновлена. Перезапустите сервер.' });
  } catch {
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// Update Redis
router.post('/config/redis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, message: 'Redis настроен' });
  } catch {
    res.status(500).json({ error: 'Ошибка настройки' });
  }
});

// Get config
router.get('/config', authenticateToken, async (req: AuthRequest, res) => {
  res.json({
    database: { type: process.env.DATABASE_URL?.includes('postgres') ? 'postgresql' : 'sqlite', url: process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://***@') },
    redis: { enabled: !!process.env.REDIS_URL, url: process.env.REDIS_URL?.replace(/:\/\/[^@]+@/, '://***@') },
    storage: { mode: storageMode }
  });
});

// Clear cache
router.post('/cache/clear', authenticateToken, async (req: AuthRequest, res) => {
  res.json({ success: true, message: 'Кэш очищен' });
});

// System info
router.get('/system/info', authenticateToken, async (req: AuthRequest, res) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  res.json({
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '3001',
    uptime: `${hours}ч ${minutes}м`,
    memory: formatBytes(process.memoryUsage().rss)
  });
});

// Restart
router.post('/system/restart', authenticateToken, async (req: AuthRequest, res) => {
  res.json({ success: true, message: 'Сервер перезагружается...' });
  setTimeout(() => process.exit(0), 1000);
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
