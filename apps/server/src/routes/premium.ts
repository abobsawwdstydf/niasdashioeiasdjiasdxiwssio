import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Premium prices in beavers
const PREMIUM_PRICES = {
  '1month': 101,
  '3months': 270, // 10% discount
  '6months': 505, // 17% discount
  '12months': 970, // 20% discount
};

// Get premium status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        isPremium: true,
        premiumUntil: true,
        premiumType: true,
        beavers: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Get premium status error:', error);
    res.status(500).json({ error: 'Failed to get premium status' });
  }
});

// Purchase premium
router.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const { months } = req.body;
    const userId = req.user!.id;

    // Validate months
    const premiumType = `${months}month${months > 1 ? 's' : ''}` as keyof typeof PREMIUM_PRICES;
    const price = PREMIUM_PRICES[premiumType];

    if (!price) {
      return res.status(400).json({ error: 'Invalid premium duration' });
    }

    // Get user balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { beavers: true, isPremium: true, premiumUntil: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check balance
    if (user.beavers < price) {
      return res.status(400).json({ 
        error: 'Insufficient beavers',
        required: price,
        current: user.beavers,
      });
    }

    // Calculate expiration date
    const now = new Date();
    const currentExpiry = user.isPremium && user.premiumUntil && user.premiumUntil > now
      ? user.premiumUntil
      : now;
    
    const expiresAt = new Date(currentExpiry);
    expiresAt.setMonth(expiresAt.getMonth() + months);

    // Process purchase
    await prisma.$transaction([
      // Deduct beavers
      prisma.user.update({
        where: { id: userId },
        data: {
          beavers: { decrement: price },
          totalSpent: { increment: price },
          isPremium: true,
          premiumUntil: expiresAt,
          premiumType,
        },
      }),
      // Create transaction record
      prisma.transaction.create({
        data: {
          userId,
          amount: -price,
          type: 'premium',
          description: `Premium subscription: ${months} month${months > 1 ? 's' : ''}`,
        },
      }),
      // Create premium purchase record
      prisma.premiumPurchase.create({
        data: {
          userId,
          months,
          beavers: price,
          expiresAt,
        },
      }),
    ]);

    res.json({
      success: true,
      premiumUntil: expiresAt,
      beaversRemaining: user.beavers - price,
    });
  } catch (error) {
    console.error('Purchase premium error:', error);
    res.status(500).json({ error: 'Failed to purchase premium' });
  }
});

// Get premium prices
router.get('/prices', async (req, res) => {
  res.json(PREMIUM_PRICES);
});

// Get purchase history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const purchases = await prisma.premiumPurchase.findMany({
      where: { userId: req.user!.id },
      orderBy: { purchasedAt: 'desc' },
      take: 20,
    });

    res.json(purchases);
  } catch (error) {
    console.error('Get purchase history error:', error);
    res.status(500).json({ error: 'Failed to get purchase history' });
  }
});

export default router;
