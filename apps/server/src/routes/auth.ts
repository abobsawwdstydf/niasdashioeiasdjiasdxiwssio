import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { config } from '../config';
import { USER_SELECT } from '../shared';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { generateCode, createVerification, verifyCode, sendTelegramCode } from '../lib/verification';

const router = Router();

// ─── Rate limiters ───
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Слишком много попыток. Попробуйте через час.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 15,
  message: { error: 'Слишком много попыток входа. Подождите 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 10,
  message: { error: 'Слишком много попыток. Подождите 5 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

// ─── Шаг 1: Начало регистрации (проверка данных) ───
router.post('/register/start', registerLimiter, async (req, res) => {
  try {
    const { username, displayName, phone, email, password, bio, birthday } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Валидация обязательных полей
    if (!username || !phone || !password) {
      res.status(400).json({ error: 'Username, телефон и пароль обязательны' });
      return;
    }

    // Валидация username
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ error: 'Username: 3-20 символов, только латиница, цифры, _' });
      return;
    }

    // Валидация телефона (международный формат)
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ error: 'Номер телефона должен быть в международном формате (например, +79991234567)' });
      return;
    }

    // Валидация пароля
    if (password.length < config.minPasswordLength) {
      res.status(400).json({ error: `Пароль минимум ${config.minPasswordLength} символов` });
      return;
    }

    if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
      res.status(400).json({ error: 'Пароль должен содержать буквы и цифры' });
      return;
    }

    // Валидация email (если указан)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Некорректный email' });
      return;
    }

    // Проверка существования username
    const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUsername) {
      res.status(400).json({ error: 'Username занят' });
      return;
    }

    // Проверка что номер не зарегистрирован
    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) {
      res.status(400).json({ error: 'Этот номер уже зарегистрирован' });
      return;
    }

    // Проверка возраста
    if (birthday) {
      const birthDate = new Date(birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      const actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);

      if (actualAge <= 5) {
        res.status(400).json({ error: 'Вам должно быть больше 5 лет' });
        return;
      }
    }

    // Проверка лимита IP
    const accountsFromIp = await prisma.user.count({ where: { registrationIp: clientIp } });
    if (accountsFromIp >= config.maxRegistrationsPerIp) {
      res.status(403).json({ error: `Лимит регистраций с IP исчерпан (макс. ${config.maxRegistrationsPerIp})` });
      return;
    }

    // Всё ок — возвращаем что можно продолжать
    res.json({
      ok: true,
      phone,
      email: email || null,
      username: username.toLowerCase(),
      displayName: displayName || username,
      bio: bio ? bio.slice(0, 500) : null,
      birthday: birthday || null,
    });
  } catch (error) {
    console.error('Registration start error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Шаг 2: Запрос кода верификации номера ───
router.post('/register/request-code', verifyLimiter, async (req, res) => {
  try {
    const { phone, method } = req.body; // method: 'telegram' | 'call'

    if (!phone || !method) {
      res.status(400).json({ error: 'Телефон и метод обязательны' });
      return;
    }

    if (!['telegram', 'call'].includes(method)) {
      res.status(400).json({ error: 'Метод должен быть "telegram" или "call"' });
      return;
    }

    // Генерируем код и токен
    const { code, token } = await createVerification({
      phone,
      purpose: 'phone_register',
      method: method as 'telegram' | 'call',
    });

    if (method === 'telegram') {
      // Формируем ссылку на бота
      const botUsername = 'nexomessenger_bot'; // TODO: вынести в config
      const link = `https://t.me/${botUsername}?start=verify_${token}`;
      res.json({ ok: true, method: 'telegram', link, token });
    } else {
      // TODO: реализовать звонок через DialMyCalls
      // Пока что просто возвращаем код (для разработки)
      console.log(`[CALL VERIFY] Code for ${phone}: ${code}`);
      res.json({ ok: true, method: 'call', devCode: process.env.NODE_ENV === 'development' ? code : undefined });
    }
  } catch (error) {
    console.error('Request code error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Шаг 3: Завершение регистрации (подтверждение номера + создание аккаунта) ───
router.post('/register/complete', verifyLimiter, async (req, res) => {
  try {
    const { phone, code, email, username, displayName, password, bio, birthday } = req.body;

    if (!phone || !code || !username || !password) {
      res.status(400).json({ error: 'Телефон, код, username и пароль обязательны' });
      return;
    }

    // Проверяем код верификации
    const verification = await verifyCode({
      phone,
      code,
      purpose: 'phone_register',
    });

    if (!verification.valid) {
      res.status(400).json({ error: verification.message });
      return;
    }

    // Создаём аккаунт
    const hashedPassword = await bcrypt.hash(password, 10);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: displayName || username,
        phone,
        phoneVerified: true,
        email: email || null,
        emailVerified: false,
        password: hashedPassword,
        bio: bio ? bio.slice(0, 500) : null,
        birthday: birthday || null,
        registrationIp: clientIp,
      },
      select: USER_SELECT,
    });

    // Если email указан — генерируем код для подтверждения
    let emailToken: string | null = null;
    if (email) {
      const { token } = await createVerification({
        email,
        userId: user.id,
        purpose: 'email_register',
        method: 'email',
      });
      emailToken = token;
      // TODO: отправить email через балансировщик
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });

    res.json({
      token,
      user: { ...user, isOnline: true },
      emailVerification: emailToken ? { required: true, token: emailToken } : { required: false },
    });
  } catch (error) {
    console.error('Registration complete error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Подтверждение email ───
router.post('/verify-email', verifyLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ error: 'Email и код обязательны' });
      return;
    }

    const verification = await verifyCode({
      email,
      code,
      purpose: 'email_register',
    });

    if (!verification.valid) {
      res.status(400).json({ error: verification.message });
      return;
    }

    res.json({ ok: true, message: 'Email подтверждён' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Повторная отправка кода email ───
router.post('/verify-email/resend', verifyLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email обязателен' });
      return;
    }

    // Удаляем старые коды и создаём новый
    await prisma.verificationCode.deleteMany({
      where: { email, purpose: 'email_register', used: false },
    });

    const user = await prisma.user.findFirst({ where: { email } });
    const { code, token } = await createVerification({
      email,
      userId: user?.id,
      purpose: 'email_register',
      method: 'email',
    });

    // TODO: отправить email
    console.log(`[EMAIL RESEND] Code for ${email}: ${code}`);

    res.json({ ok: true, devCode: process.env.NODE_ENV === 'development' ? code : undefined });
  } catch (error) {
    console.error('Email resend error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Вход: Шаг 1 — проверка телефона и пароля ───
router.post('/login/start', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ error: 'Телефон и пароль обязательны' });
      return;
    }

    // Ищем пользователя по номеру телефона
    const user = await prisma.user.findFirst({
      where: { phone },
      select: { ...USER_SELECT, password: true },
    });

    if (!user) {
      res.status(400).json({ error: 'Неверный номер телефона или пароль' });
      return;
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(400).json({ error: 'Неверный номер телефона или пароль' });
      return;
    }

    // Определяем доступные способы 2FA
    const twoFAMethods: string[] = [];
    if (user.phoneVerified) twoFAMethods.push('telegram');
    if (user.emailVerified) twoFAMethods.push('email');
    twoFAMethods.push('call'); // звонок всегда доступен

    // Если 2FA не нужен (нет подтверждённых способов) — сразу логиним
    if (twoFAMethods.length === 0 || (twoFAMethods.length === 1 && twoFAMethods[0] === 'call')) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isOnline: true, lastSeen: new Date() },
      });

      const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
      const { password: _, ...userWithoutPassword } = user;

      res.json({ token, user: { ...userWithoutPassword, isOnline: true } });
      return;
    }

    // Иначе требуем 2FA
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      require2FA: true,
      user: userWithoutPassword,
      availableMethods: twoFAMethods,
    });
  } catch (error) {
    console.error('Login start error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Вход: Шаг 2 — запрос 2FA кода ───
router.post('/login/request-2fa', verifyLimiter, async (req, res) => {
  try {
    const { phone, method } = req.body;

    if (!phone || !method) {
      res.status(400).json({ error: 'Телефон и метод обязательны' });
      return;
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      res.status(400).json({ error: 'Пользователь не найден' });
      return;
    }

    const { code, token } = await createVerification({
      phone,
      email: user.email || undefined,
      userId: user.id,
      purpose: 'login_2fa',
      method: method as 'telegram' | 'call' | 'email',
    });

    if (method === 'telegram') {
      // TODO: отправить через бота (нужен chat_id пользователя)
      console.log(`[2FA TELEGRAM] Code for ${phone}: ${code}`);
      res.json({ ok: true, method: 'telegram', devCode: process.env.NODE_ENV === 'development' ? code : undefined });
    } else if (method === 'email') {
      // TODO: отправить email
      console.log(`[2FA EMAIL] Code for ${user.email}: ${code}`);
      res.json({ ok: true, method: 'email', devCode: process.env.NODE_ENV === 'development' ? code : undefined });
    } else {
      // Звонок
      console.log(`[2FA CALL] Code for ${phone}: ${code}`);
      res.json({ ok: true, method: 'call', devCode: process.env.NODE_ENV === 'development' ? code : undefined });
    }
  } catch (error) {
    console.error('2FA request error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Вход: Шаг 3 — подтверждение 2FA кода ───
router.post('/login/complete-2fa', verifyLimiter, async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      res.status(400).json({ error: 'Телефон и код обязательны' });
      return;
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      res.status(400).json({ error: 'Пользователь не найден' });
      return;
    }

    const verification = await verifyCode({
      userId: user.id,
      code,
      purpose: 'login_2fa',
    });

    if (!verification.valid) {
      res.status(400).json({ error: verification.message });
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
    console.error('2FA complete error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Legacy: регистрация (обратная совместимость) ───
router.post('/register', async (req, res) => {
  res.status(410).json({ error: 'Используйте /api/auth/register/start' });
});

// ─── Legacy: вход (обратная совместимость) ───
router.post('/login', async (req, res) => {
  res.status(410).json({ error: 'Используйте /api/auth/login/start' });
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
