import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { prisma } from '../db';
import { config } from '../config';
import { USER_SELECT } from '../shared';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Multer для аватарки (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// ─── Регистрация ───
router.post('/register', registerLimiter, upload.single('avatar'), async (req: Request, res) => {
  try {
    const { username, displayName, phone, password, bio, birthday } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Валидация
    if (!username || !phone || !password) {
      res.status(400).json({ error: 'Username, телефон и пароль обязательны' });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ error: 'Username: 3-20 символов, латиница, цифры, _' });
      return;
    }

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ error: 'Телефон в международном формате (+79991234567)' });
      return;
    }

    if (password.length < config.minPasswordLength) {
      res.status(400).json({ error: `Пароль минимум ${config.minPasswordLength} символов` });
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
      res.status(400).json({ error: 'Этот номер уже зарегистрирован' });
      return;
    }

    // Лимит IP
    const accountsFromIp = await prisma.user.count({ where: { registrationIp: clientIp } });
    if (accountsFromIp >= config.maxRegistrationsPerIp) {
      res.status(403).json({ error: `Лимит регистраций с IP (${config.maxRegistrationsPerIp})` });
      return;
    }

    // Сохранение аватарки
    let avatarPath: string | null = null;
    if (req.file) {
      const fs = await import('fs');
      const path = await import('path');
      const { UPLOADS_ROOT } = await import('../shared');
      const ext = req.file.originalname.split('.').pop() || 'jpg';
      const filename = `avatar_${Date.now()}.${ext}`;
      avatarPath = `/uploads/avatars/${filename}`;
      const dir = path.join(UPLOADS_ROOT, 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), req.file.buffer);
    }

    // Создание пользователя
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: displayName || username,
        phone,
        phoneVerified: true, // Авто-верификация пока
        emailVerified: false,
        password: hashedPassword,
        avatar: avatarPath,
        bio: bio ? bio.slice(0, 500) : null,
        birthday: birthday || null,
        registrationIp: clientIp,
      },
      select: USER_SELECT,
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    res.json({ token, user: { ...user, isOnline: true } });
  } catch (error) {
    console.error('Registration error:', error);
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
