import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Цены на премиум (в бобрах)
const PREMIUM_PRICES = {
  '1month': 101,
  '3months': 270,  // Скидка 10%
  '6months': 505,  // Скидка 17%
  '12months': 970, // Скидка 20%
};

// Получить статус премиума текущего пользователя
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isPremium: true,
        premiumUntil: true,
        premiumType: true,
        beavers: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, не истек ли премиум
    if (user.isPremium && user.premiumUntil && new Date(user.premiumUntil) < new Date()) {
      // Премиум истек, обновляем статус
      await prisma.user.update({
        where: { id: userId },
        data: {
          isPremium: false,
          premiumType: null,
        },
      });

      return res.json({
        isPremium: false,
        premiumUntil: null,
        premiumType: null,
        beavers: user.beavers,
      });
    }

    res.json({
      isPremium: user.isPremium,
      premiumUntil: user.premiumUntil,
      premiumType: user.premiumType,
      beavers: user.beavers,
    });
  } catch (error) {
    console.error('Error getting premium status:', error);
    res.status(500).json({ error: 'Ошибка получения статуса премиума' });
  }
});

// Купить премиум
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { months } = req.body;

    // Валидация
    if (!months || !['1month', '3months', '6months', '12months'].includes(months)) {
      return res.status(400).json({ error: 'Неверный период подписки' });
    }

    const price = PREMIUM_PRICES[months as keyof typeof PREMIUM_PRICES];

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        beavers: true,
        isPremium: true,
        premiumUntil: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем баланс
    if (user.beavers < price) {
      return res.status(400).json({
        error: 'Недостаточно бобров',
        required: price,
        current: user.beavers,
        missing: price - user.beavers,
      });
    }

    // Вычисляем дату окончания премиума
    const now = new Date();
    let premiumUntil: Date;

    if (user.isPremium && user.premiumUntil && new Date(user.premiumUntil) > now) {
      // Продлеваем существующий премиум
      premiumUntil = new Date(user.premiumUntil);
    } else {
      // Новый премиум
      premiumUntil = new Date(now);
    }

    // Добавляем месяцы
    const monthsToAdd = parseInt(months.replace('months', '').replace('month', ''));
    premiumUntil.setMonth(premiumUntil.getMonth() + monthsToAdd);

    // Выполняем транзакцию
    const [updatedUser, purchase, transaction] = await prisma.$transaction([
      // Обновляем пользователя
      prisma.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
          premiumUntil,
          premiumType: months,
          beavers: user.beavers - price,
          totalSpent: { increment: price },
        },
      }),
      // Создаем запись о покупке
      prisma.premiumPurchase.create({
        data: {
          userId,
          months: monthsToAdd,
          beavers: price,
          expiresAt: premiumUntil,
        },
      }),
      // Создаем транзакцию
      prisma.transaction.create({
        data: {
          userId,
          amount: -price,
          type: 'premium',
          description: `Покупка премиума на ${monthsToAdd} мес.`,
        },
      }),
    ]);

    res.json({
      success: true,
      isPremium: true,
      premiumUntil: updatedUser.premiumUntil,
      premiumType: updatedUser.premiumType,
      beavers: updatedUser.beavers,
      spent: price,
      purchase: {
        id: purchase.id,
        months: monthsToAdd,
        expiresAt: purchase.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error purchasing premium:', error);
    res.status(500).json({ error: 'Ошибка покупки премиума' });
  }
});

// Получить историю покупок премиума
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const purchases = await prisma.premiumPurchase.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
      take: 50,
    });

    res.json(purchases);
  } catch (error) {
    console.error('Error getting premium history:', error);
    res.status(500).json({ error: 'Ошибка получения истории покупок' });
  }
});

// Получить цены на премиум
router.get('/prices', async (req, res) => {
  res.json({
    prices: PREMIUM_PRICES,
    features: [
      '✨ AI контекст из чатов',
      '🤖 Умные предложения ответов от AI',
      '📝 Автодополнение текста',
      '✍️ Исправление грамматики и стиля',
      '📁 Папки для чатов (неограниченно)',
      '🔍 Умный поиск с фильтрами',
      '⚡ Быстрые ответы (шаблоны)',
      '🎨 Кастомные темы и фоны',
      '📊 Расширенная статистика',
      '💾 Экспорт в PDF/HTML/JSON',
      '🔒 Секретные чаты',
      '🎭 Анимированные аватары',
      '🎵 Музыка в профиле',
      '📈 Приоритетная поддержка',
    ],
  });
});

export default router;
