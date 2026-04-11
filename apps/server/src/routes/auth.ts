import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from '../db';
import { config, TELEGRAM_AUTH_BOT } from '../config';
import { USER_SELECT } from '../shared';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Multer для аватарки
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения'));
  },
});

// ─── Rate limiters ───
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Подождите час.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Слишком много попыток. Подождите 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

// ─── In-memory: временные данные регистрации → по token ───
interface PendingRegistration {
  username: string;
  displayName: string;
  phone: string;
  password: string;
  bio: string | null;
  birthday: string | null;
  avatarBuffer?: Buffer;
  avatarFilename?: string;
  createdAt: number;
}

const pendingRegistrations = new Map<string, PendingRegistration>();

// Экспорт для webhook'а
(global as any).__pendingRegistrations = pendingRegistrations;

// Чистилка старых каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingRegistrations) {
    if (now - v.createdAt > 30 * 60 * 1000) pendingRegistrations.delete(k);
  }
}, 5 * 60 * 1000);

// ─── Шаг 1: Начало регистрации (проверка данных, генерация token) ───
router.post('/register/start', registerLimiter, async (req, res) => {
  try {
    const { username, displayName, phone, password, bio, birthday } = req.body;

    if (!username || !phone || !password) {
      res.status(400).json({ error: 'Username, телефон и пароль обязательны' });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ error: 'Username: 3-20 символов, латиница, цифры, _' });
      return;
    }

    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      res.status(400).json({ error: 'Телефон в формате +79991234567' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль минимум 6 символов' });
      return;
    }

    // Проверка существования
    const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUsername) {
      res.status(400).json({ error: 'Username занят' });
      return;
    }

    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) {
      res.status(400).json({ error: 'Номер уже зарегистрирован' });
      return;
    }

    // Лимит IP
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const accountsFromIp = await prisma.user.count({ where: { registrationIp: clientIp } });
    if (accountsFromIp >= config.maxRegistrationsPerIp) {
      res.status(403).json({ error: 'Лимит регистраций с IP' });
      return;
    }

    // Генерируем token и сохраняем данные
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    pendingRegistrations.set(token, {
      username: username.toLowerCase(),
      displayName: displayName || username,
      phone,
      password,
      bio: bio ? bio.slice(0, 500) : null,
      birthday: birthday || null,
      createdAt: Date.now(),
    });

    res.json({ token });
  } catch (error) {
    console.error('Register start error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Шаг 1b: Загрузка аватарки для pending registration ───
router.post('/register/upload-avatar', upload.single('avatar'), async (req: Request, res) => {
  try {
    const { token } = req.body;
    if (!token || !pendingRegistrations.has(token)) {
      res.status(400).json({ error: 'Недействительный token' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const pending = pendingRegistrations.get(token)!;
    pending.avatarBuffer = req.file.buffer;
    pending.avatarFilename = req.file.originalname;

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Шаг 2: Запрос кода через Telegram ───
router.post('/register/request-code', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || !pendingRegistrations.has(token)) {
      res.status(400).json({ error: 'Сессия истекла. Начните регистрацию заново.' });
      return;
    }

    const pending = pendingRegistrations.get(token)!;

    // Генерируем 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 мин

    // Сохраняем код
    (pending as any).verifyCode = code;
    (pending as any).verifyExpiresAt = expiresAt;

    // Ссылка на бота
    const botUsername = TELEGRAM_AUTH_BOT.username;
    const link = `https://t.me/${botUsername}?start=verify_${token}`;

    res.json({ link, devCode: process.env.NODE_ENV === 'development' ? code : undefined });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Шаг 3: Подтверждение кода и завершение регистрации ───
router.post('/register/complete', async (req, res) => {
  try {
    const { token, code } = req.body;
    if (!token || !code) {
      res.status(400).json({ error: 'Token и код обязательны' });
      return;
    }

    const pending = pendingRegistrations.get(token);
    if (!pending) {
      res.status(400).json({ error: 'Сессия истекла' });
      return;
    }

    if ((pending as any).verifyCode !== code) {
      res.status(400).json({ error: 'Неверный код' });
      return;
    }

    if (Date.now() > (pending as any).verifyExpiresAt) {
      res.status(400).json({ error: 'Код истёк. Запросите новый.' });
      return;
    }

    // Сохранение аватарки
    let avatarPath: string | null = null;
    if (pending.avatarBuffer && pending.avatarFilename) {
      const fs = await import('fs');
      const path = await import('path');
      const { UPLOADS_ROOT } = await import('../shared');
      const ext = pending.avatarFilename.split('.').pop() || 'jpg';
      const filename = `avatar_${Date.now()}.${ext}`;
      avatarPath = `/uploads/avatars/${filename}`;
      const dir = path.join(UPLOADS_ROOT, 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), pending.avatarBuffer);
    }

    // Создание пользователя
    const hashedPassword = await bcrypt.hash(pending.password, 10);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const user = await prisma.user.create({
      data: {
        username: pending.username,
        displayName: pending.displayName,
        phone: pending.phone,
        phoneVerified: true,
        emailVerified: false,
        password: hashedPassword,
        avatar: avatarPath,
        bio: pending.bio,
        birthday: pending.birthday,
        registrationIp: clientIp,
      },
      select: USER_SELECT,
    });

    // Удаляем pending
    pendingRegistrations.delete(token);

    const jwtToken = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    res.json({ token: jwtToken, user: { ...user, isOnline: true } });
  } catch (error) {
    console.error('Register complete error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Проверка username ───
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username обязателен' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.json({ available: false, reason: 'invalid' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    res.json({ available: !existing });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Проверка телефона ───
router.get('/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ error: 'Телефон обязателен' });
      return;
    }
    const existing = await prisma.user.findFirst({ where: { phone } });
    res.json({ available: !existing });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Вход ───
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ error: 'Телефон и пароль обязательны' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { phone },
      select: { ...USER_SELECT, password: true },
    });

    if (!user) {
      res.status(400).json({ error: 'Неверный номер или пароль' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(400).json({ error: 'Неверный номер или пароль' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    const { password: _, ...userWithoutPassword } = user;

    res.json({ token, user: { ...userWithoutPassword, isOnline: true } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Текущий пользователь ───
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: USER_SELECT,
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
