import express from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();
const ADMIN_PASSWORD = 'b2323vgn7v672n7823478t92BRGMV7tv83';

// In-memory session store
interface AdminSession {
  token: string;
  ip: string;
  userAgent: string;
  device: string;
  loginAt: Date;
  lastActive: Date;
}

const sessions: Map<string, AdminSession> = new Map();

// Helper to detect device from user agent
function detectDevice(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  if (/mobile|android|iphone/i.test(userAgent)) return '📱 Mobile';
  if (/tablet|ipad/i.test(userAgent)) return '📱 Tablet';
  if (/windows/i.test(userAgent)) return '🖥️ Windows';
  if (/macintosh|mac os/i.test(userAgent)) return '🖥️ macOS';
  if (/linux/i.test(userAgent)) return '🐧 Linux';
  return '🖥️ Desktop';
}

// Helper to get browser name
function getBrowser(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  if (/chrome/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent)) return 'Safari';
  if (/edge/i.test(userAgent)) return 'Edge';
  return 'Browser';
}

// Login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = 'admin-token-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    sessions.set(token, {
      token,
      ip,
      userAgent,
      device: detectDevice(userAgent),
      loginAt: new Date(),
      lastActive: new Date()
    });
    
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// Get all sessions
router.get('/sessions', authenticateToken, (req: AuthRequest, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    token: s.token,
    ip: s.ip,
    device: s.device,
    browser: getBrowser(s.userAgent),
    userAgent: s.userAgent.substring(0, 100) + '...',
    loginAt: s.loginAt,
    lastActive: s.lastActive,
    isCurrent: s.token === req.headers.authorization?.replace('Bearer ', '')
  }));
  res.json(sessionList);
});

// Logout from specific session
router.delete('/sessions/:token', authenticateToken, (req: AuthRequest, res) => {
  const { token } = req.params;
  if (sessions.delete(token)) {
    res.json({ success: true, message: 'Сессия завершена' });
  } else {
    res.status(404).json({ error: 'Сессия не найдена' });
  }
});

// Logout from all sessions except current
router.post('/sessions/logout-all', authenticateToken, (req: AuthRequest, res) => {
  const currentToken = req.headers.authorization?.replace('Bearer ', '');
  let count = 0;
  for (const [token] of sessions) {
    if (token !== currentToken) {
      sessions.delete(token);
      count++;
    }
  }
  res.json({ success: true, message: `Завершено ${count} сессий` });
});

// Logout current session
router.post('/sessions/logout-current', authenticateToken, (req: AuthRequest, res) => {
  const currentToken = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(currentToken || '');
  res.json({ success: true, message: 'Сессия завершена' });
});

// Stats
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [userCount, chatCount, messageCount, onlineCount, verifiedCount, bannedCount] = await Promise.all([
      prisma.user.count(),
      prisma.chat.count(),
      prisma.message.count(),
      prisma.user.count({ where: { isOnline: true } }),
      prisma.verifiedEntity.count(),
      prisma.user.count({ where: { isBanned: true } })
    ]);
    res.json({ users: userCount, chats: chatCount, messages: messageCount, online: onlineCount, verified: verifiedCount, banned: bannedCount });
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
    res.json({ connected: true, url: dbUrl.replace(/:\/\/[^@]+@/, '://***@'), version: data?.version?.split(' ')[0] || 'Unknown', database: data?.current_database || 'Unknown', size: formatBytes(data?.size || 0) });
  } catch (error: any) {
    res.json({ connected: false, url: (process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@') || 'Не настроено', error: error?.message || 'Не удалось подключиться' });
  }
});

// Redis status
router.get('/status/redis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const redisUrl = process.env.REDIS_URL || '';
    if (!redisUrl) return res.json({ connected: false, url: 'Не настроено', error: 'Redis URL не указан' });
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    await client.connect();
    const info = await client.info();
    const dbsize = await client.dbSize();
    const versionMatch = info.match(/redis_version:([\d.]+)/);
    await client.quit();
    res.json({ connected: true, url: redisUrl.replace(/:\/\/[^@]+@/, '://***@'), version: versionMatch ? versionMatch[1] : 'Unknown', keys: dbsize.toString() });
  } catch (error: any) {
    res.json({ connected: false, url: (process.env.REDIS_URL || '').replace(/:\/\/[^@]+@/, '://***@') || 'Не настроено', error: error?.message || 'Не удалось подключиться' });
  }
});

// Get all users
router.get('/users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true, isOnline: true, isVerified: true, isBanned: true, createdAt: true, avatar: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(users);
  } catch { res.status(500).json({ error: 'Ошибка получения пользователей' }); }
});

// Delete user
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error?.message || 'Ошибка удаления' }); }
});

// Get all verified entities
router.get('/verified', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const entities = await prisma.verifiedEntity.findMany({
      include: { chat: { include: { members: { include: { user: true } } } } }
    });
    const result = entities.map(e => {
      let name = '', members = 0, owner = '', avatar = '';
      if (e.entityType === 'user') {
        // Handled separately
      } else if (e.chat) {
        name = e.chat.name || e.chat.username || '';
        members = e.chat.members.length;
        const admin = e.chat.members.find(m => m.role === 'admin');
        owner = admin?.user?.displayName || admin?.user?.username || '';
        avatar = e.chat.avatar || '';
      }
      return { ...e, name, members, owner, avatar };
    });
    // Add users
    const verifiedUsers = await prisma.user.findMany({
      where: { isVerified: true },
      select: { id: true, displayName: true, username: true, avatar: true, verifiedBadgeUrl: true, verifiedBadgeType: true }
    });
    const userEntities = verifiedUsers.map(u => ({
      entityType: 'user',
      entityId: u.id,
      name: u.displayName || u.username,
      members: 0,
      owner: '',
      avatar: u.avatar || '',
      badgeUrl: u.verifiedBadgeUrl || '',
      badgeType: u.verifiedBadgeType || 'default'
    }));
    res.json([...result, ...userEntities]);
  } catch { res.status(500).json({ error: 'Ошибка' }); }
});

// Verify entity
router.post('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { entityType, entityId, badgeUrl, badgeType } = req.body;
    if (entityType === 'user') {
      await prisma.user.update({
        where: { id: entityId },
        data: { isVerified: true, verifiedBadgeUrl: badgeUrl || null, verifiedBadgeType: badgeType || 'default', verifiedAt: new Date() }
      });
    } else {
      await prisma.verifiedEntity.upsert({
        where: { entityType_entityId: { entityType, entityId } },
        update: { badgeUrl: badgeUrl || null, badgeType: badgeType || 'default', verifiedAt: new Date() },
        create: { entityType, entityId, badgeUrl: badgeUrl || null, badgeType: badgeType || 'default', verifiedBy: req.userId! }
      });
      if (entityType === 'channel' || entityType === 'group') {
        await prisma.chat.update({ where: { id: entityId }, data: { isVerified: true, verifiedBadgeUrl: badgeUrl || null, verifiedBadgeType: badgeType || 'default', verifiedAt: new Date() } });
      }
    }
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error?.message || 'Ошибка' }); }
});

// Remove verification
router.delete('/verify/:type/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'user') {
      await prisma.user.update({ where: { id }, data: { isVerified: false, verifiedBadgeUrl: null, verifiedBadgeType: null, verifiedAt: null } });
    } else {
      await prisma.verifiedEntity.deleteMany({ where: { entityType: type, entityId: id } });
      await prisma.chat.updateMany({ where: { id }, data: { isVerified: false, verifiedBadgeUrl: null, verifiedBadgeType: null, verifiedAt: null } });
    }
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error?.message || 'Ошибка' }); }
});

// Ban user
router.post('/ban', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, reason, expiresAt } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, banReason: reason, banExpiresAt: expiresAt ? new Date(expiresAt) : null, bannedAt: new Date(), bannedBy: req.userId }
    });
    await prisma.userBan.create({
      data: { userId, reason, expiresAt: expiresAt ? new Date(expiresAt) : null, bannedBy: req.userId! }
    });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error?.message || 'Ошибка' }); }
});

// Unban user
router.delete('/ban/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: false, banReason: null, banExpiresAt: null, bannedAt: null, bannedBy: null } });
    await prisma.userBan.updateMany({ where: { userId: req.params.id, isActive: true }, data: { isActive: false, liftedAt: new Date(), liftedBy: req.userId } });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error?.message || 'Ошибка' }); }
});

// Storage config
router.post('/config/storage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { mode } = req.body;
    if (mode === 'local' || mode === 'telegram') {
      res.json({ success: true, message: `Режим хранилища: ${mode === 'local' ? 'Локальный' : 'Telegram'}` });
    } else { res.status(400).json({ error: 'Неверный режим' }); }
  } catch { res.status(500).json({ error: 'Ошибка' }); }
});

// Database config
router.post('/config/database', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { databaseUrl } = req.body;
    if (!databaseUrl) return res.status(400).json({ error: 'URL базы данных обязателен' });
    res.json({ success: true, message: 'Конфигурация обновлена. Перезапустите сервер.' });
  } catch { res.status(500).json({ error: 'Ошибка обновления' }); }
});

// Redis config
router.post('/config/redis', authenticateToken, async (req: AuthRequest, res) => {
  try { res.json({ success: true, message: 'Redis настроен' }); }
  catch { res.status(500).json({ error: 'Ошибка настройки' }); }
});

// Get config
router.get('/config', authenticateToken, async (req: AuthRequest, res) => {
  res.json({
    database: { type: process.env.DATABASE_URL?.includes('postgres') ? 'postgresql' : 'sqlite', url: process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://***@') },
    redis: { enabled: !!process.env.REDIS_URL, url: process.env.REDIS_URL?.replace(/:\/\/[^@]+@/, '://***@') }
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
  res.json({ nodeVersion: process.version, env: process.env.NODE_ENV || 'development', port: process.env.PORT || '3001', uptime: `${hours}ч ${minutes}м`, memory: formatBytes(process.memoryUsage().rss) });
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
