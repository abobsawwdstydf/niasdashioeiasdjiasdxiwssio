import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db';
import { config } from '../config';
import { USER_SELECT } from '../shared';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─── Strict registration rate limiter: 3 registrations per IP per hour ───
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // increased for development
  message: { error: 'Слишком много регистраций с этого IP. Попробуйте через час.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

// In-memory cooldown: track last registration timestamp per IP (prevents rapid-fire even within rate limit)
const registrationCooldowns = new Map<string, number>();
const REGISTRATION_COOLDOWN_MS = 0; // disabled for development

// Регистрация
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, displayName, password, bio, birthday } = req.body;

    // ── IP cooldown check ──
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const lastReg = registrationCooldowns.get(clientIp);
    if (lastReg && Date.now() - lastReg < REGISTRATION_COOLDOWN_MS) {
      const waitMinutes = Math.ceil((REGISTRATION_COOLDOWN_MS - (Date.now() - lastReg)) / 60000);
      res.status(429).json({ error: `Подождите ${waitMinutes} мин. перед созданием нового аккаунта` });
      return;
    }

    // ── Permanent IP limit (DB-level) ──
    const accountsFromIp = await prisma.user.count({ where: { registrationIp: clientIp } });
    if (accountsFromIp >= config.maxRegistrationsPerIp) {
      res.status(403).json({ error: `Максимум ${config.maxRegistrationsPerIp} аккаунта с одного IP. Лимит исчерпан.` });
      return;
    }

    if (!username || !password) {
      res.status(400).json({ error: 'Username и пароль обязательны' });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ error: 'Username: 3-20 символов, только латиница, цифры, _' });
      return;
    }

    if (password.length < config.minPasswordLength) {
      res.status(400).json({ error: `Пароль должен быть не менее ${config.minPasswordLength} символов` });
      return;
    }

    // Password must contain at least one letter and one digit
    if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
      res.status(400).json({ error: 'Пароль должен содержать буквы и цифры' });
      return;
    }

    // Validate age if birthday provided (must be > 5 years old)
    if (birthday) {
      const birthDate = new Date(birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      const actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);
      
      if (actualAge <= 5) {
        res.status(400).json({ error: 'Вам должно быть больше 5 лет для регистрации' });
        return;
      }
    }

    // Validate optional fields
    if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 50)) {
      res.status(400).json({ error: 'Имя должно быть не длиннее 50 символов' });
      return;
    }
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
      res.status(400).json({ error: 'Био должно быть не длиннее 500 символов' });
      return;
    }
    if (birthday !== undefined && (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday))) {
      res.status(400).json({ error: 'Некорректный формат даты рождения' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) {
      res.status(400).json({ error: 'Этот username уже занят' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: (displayName || username).slice(0, 50),
        password: hashedPassword,
        bio: bio ? bio.slice(0, 500) : null,
        birthday: birthday || null,
        registrationIp: clientIp,
      },
      select: USER_SELECT,
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });

    // Track registration for cooldown
    registrationCooldowns.set(clientIp, Date.now());

    res.json({ token, user: { ...user, isOnline: true } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error instanceof Error ? error.message : String(error) });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username и пароль обязательны' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { ...USER_SELECT, password: true },
    });

    if (!user) {
      res.status(400).json({ error: 'Неверный username или пароль' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(400).json({ error: 'Неверный username или пароль' });
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

// Текущий пользователь — uses authenticateToken middleware instead of duplicating JWT parsing
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

// Generate QR session (for non-logged-in users to get QR code)
router.post('/qr-session', async (req, res) => {
  try {
    // For logged-in users, use the existing userId from token
    // For non-logged-in users, generate anonymous session
    const userId = (req as any).userId || 'anonymous';
    
    // Generate 37-char auth key
    const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 32);
    const authKey = `nexo-${randomPart}`; // 5 + 32 = 37 chars
    
    // Store session in DB (userId will be set when confirmed)
    const session = await prisma.authSession.create({
      data: {
        key: authKey,
        userId: userId === 'anonymous' ? 'pending' : userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        used: false
      }
    });
    
    res.json({ 
      authKey,
      expiresIn: 300, // seconds
      serverUrl: req.protocol + '://' + req.get('host')
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка создания сессии' });
  }
});

// Check QR session status
router.get('/qr-session/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    const session = await prisma.authSession.findUnique({
      where: { key },
      include: { user: { select: USER_SELECT } }
    });
    
    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }
    
    if (session.expiresAt < new Date()) {
      res.json({ status: 'expired' });
      return;
    }
    
    if (session.used) {
      res.json({ 
        status: 'used',
        user: session.user,
        token: jwt.sign({ userId: session.userId }, config.jwtSecret, { expiresIn: '30d' })
      });
      return;
    }
    
    res.json({ status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

// Login with auth key
router.post('/key-login', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key || typeof key !== 'string' || key.length !== 37) {
      res.status(400).json({ error: 'Неверный формат ключа. Должен быть 37 символов' });
      return;
    }
    
    const session = await prisma.authSession.findUnique({
      where: { key },
      include: { user: { select: USER_SELECT } }
    });
    
    if (!session) {
      res.status(404).json({ error: 'Ключ не найден' });
      return;
    }
    
    if (session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Ключ истёк' });
      return;
    }
    
    if (session.used) {
      res.status(401).json({ error: 'Ключ уже использован' });
      return;
    }
    
    // Mark as used
    await prisma.authSession.update({
      where: { id: session.id },
      data: { used: true, usedAt: new Date() }
    });
    
    const token = jwt.sign({ userId: session.userId }, config.jwtSecret, { expiresIn: '30d' });
    
    res.json({ 
      success: true,
      token,
      user: session.user
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

// Confirm QR login (for logged-in user to confirm login on another device)
router.post('/qr-session/:key/confirm', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { key } = req.params;
    const confirmUserId = req.userId!;
    
    const session = await prisma.authSession.findUnique({
      where: { key },
    });
    
    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }
    
    if (session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Сессия истекла' });
      return;
    }
    
    if (session.used) {
      res.status(401).json({ error: 'Сессия уже использована' });
      return;
    }
    
    // Update session: mark as used, set the user who is confirming
    await prisma.authSession.update({
      where: { id: session.id },
      data: { 
        used: true, 
        usedAt: new Date(),
        userId: confirmUserId // Set to the user who confirmed
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

// Check if QR session was confirmed (for non-logged-in user waiting for login)
router.get('/qr-session/:key/status', async (req, res) => {
  try {
    const { key } = req.params;
    
    const session = await prisma.authSession.findUnique({
      where: { key },
      include: { user: { select: USER_SELECT } }
    });
    
    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }
    
    if (session.expiresAt < new Date()) {
      res.json({ status: 'expired' });
      return;
    }
    
    if (session.used && session.userId !== 'pending') {
      // Session was confirmed by a logged-in user
      const token = jwt.sign({ userId: session.userId }, config.jwtSecret, { expiresIn: '30d' });
      res.json({ 
        status: 'confirmed',
        token,
        user: session.user
      });
      return;
    }
    
    res.json({ status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});
