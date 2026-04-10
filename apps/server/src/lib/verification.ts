import { prisma } from '../db';
import { TELEGRAM_BOTS } from '../config';

/**
 * Генерирует 6-значный код верификации
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Генерирует уникальный токен для Telegram-ссылки
 */
export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Создаёт запись верификации и возвращает код + токен
 */
export async function createVerification(data: {
  phone?: string;
  email?: string;
  userId?: string;
  purpose: 'phone_register' | 'email_register' | 'login_2fa';
  method: 'telegram' | 'call' | 'email' | 'sms';
}): Promise<{ code: string; token: string }> {
  const code = generateCode();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

  await prisma.verificationCode.create({
    data: {
      phone: data.phone || null,
      email: data.email || null,
      userId: data.userId || null,
      code,
      purpose: data.purpose,
      method: data.method,
      token,
      expiresAt,
    },
  });

  return { code, token };
}

/**
 * Проверяет код верификации
 */
export async function verifyCode(data: {
  phone?: string;
  email?: string;
  userId?: string;
  code: string;
  purpose: 'phone_register' | 'email_register' | 'login_2fa';
}): Promise<{ valid: boolean; message: string }> {
  const record = await prisma.verificationCode.findFirst({
    where: {
      code: data.code,
      purpose: data.purpose,
      used: false,
      expiresAt: { gt: new Date() },
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.email ? { email: data.email } : {}),
      ...(data.userId ? { userId: data.userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return { valid: false, message: 'Неверный или истёкший код' };
  }

  // Отмечаем как использованный
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { used: true },
  });

  return { valid: true, message: 'Код подтверждён' };
}

/**
 * Находит токен верификации Telegram
 */
export async function findTelegramToken(token: string) {
  return prisma.verificationCode.findFirst({
    where: { token, used: false, expiresAt: { gt: new Date() } },
  });
}

/**
 * Отправляет сообщение через Telegram Bot API (fetch, без зависимостей)
 */
async function sendTelegramMessage(botToken: string, chatId: number | string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({})) as { description?: string };
    throw new Error(`Telegram API error: ${errorBody.description || res.statusText}`);
  }
}

/**
 * Отправляет код через Telegram-бота
 */
export async function sendTelegramCode(chatId: number | string, code: string, purpose: string): Promise<void> {
  const botToken = TELEGRAM_BOTS[0].token; // Первый бот для верификации
  const messengerName = 'Nexo';

  const messages: Record<string, string> = {
    phone_register: `🎉 Добро пожаловать в ${messengerName}!\n\n🔐 Ваш код подтверждения: *${code}*\n\n⏱ Код действует 5 минут.`,
    email_register: `📧 Подтверждение email в ${messengerName}\n\n🔐 Ваш код: *${code}*\n\n⏱ Код действует 5 минут.`,
    login_2fa: `🔑 Код входа в ${messengerName}\n\n🔐 Ваш код: *${code}*\n\n⏱ Код действует 5 минут.\n\nЕсли вы не пытались войти — смените пароль!`,
  };

  await sendTelegramMessage(botToken, chatId, messages[purpose] || `🔐 Ваш код: *${code}*\n\n⏱ Код действует 5 минут.`);
}

/**
 * Очищает истёкшие коды верификации
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const result = await prisma.verificationCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
