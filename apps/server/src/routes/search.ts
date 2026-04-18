import express from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

/**
 * Global search across all chats
 */
router.get('/global', async (req: AuthRequest, res) => {
  try {
    const { q, type, senderId, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;
    const userId = req.userId!;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Get user's chats
    const userChats = await prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true }
    });

    const chatIds = userChats.map(c => c.chatId);

    // Build search filters
    const where: any = {
      chatId: { in: chatIds },
      isDeleted: false,
      OR: [
        { content: { contains: q, mode: 'insensitive' } },
        { quote: { contains: q, mode: 'insensitive' } }
      ]
    };

    // Filter by message type
    if (type && typeof type === 'string') {
      where.type = type;
    }

    // Filter by sender
    if (senderId && typeof senderId === 'string') {
      where.senderId = senderId;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          },
          chat: {
            select: {
              id: true,
              type: true,
              name: true,
              avatar: true
            }
          },
          media: true
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.message.count({ where })
    ]);

    res.json({
      messages,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Search by hashtag
 */
router.get('/hashtag/:tag', async (req: AuthRequest, res) => {
  try {
    const { tag } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.userId!;

    // Get user's chats
    const userChats = await prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true }
    });

    const chatIds = userChats.map(c => c.chatId);

    // Find hashtag
    const hashtag = await prisma.hashtag.findUnique({
      where: { tag: tag.toLowerCase() }
    });

    if (!hashtag) {
      return res.json({ messages: [], total: 0 });
    }

    // Find messages with this hashtag
    const messageHashtags = await prisma.messageHashtag.findMany({
      where: { hashtagId: hashtag.id },
      select: { messageId: true },
      take: Number(limit),
      skip: Number(offset)
    });

    const messageIds = messageHashtags.map(mh => mh.messageId);

    const messages = await prisma.message.findMany({
      where: {
        id: { in: messageIds },
        chatId: { in: chatIds },
        isDeleted: false
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
          }
        },
        chat: {
          select: {
            id: true,
            type: true,
            name: true,
            avatar: true
          }
        },
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.messageHashtag.count({
      where: { hashtagId: hashtag.id }
    });

    res.json({
      messages,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Hashtag search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Get trending hashtags
 */
router.get('/hashtags/trending', async (_req: AuthRequest, res) => {
  try {
    const hashtags = await prisma.hashtag.findMany({
      orderBy: { useCount: 'desc' },
      take: 20
    });

    res.json(hashtags);
  } catch (error) {
    console.error('Trending hashtags error:', error);
    res.status(500).json({ error: 'Failed to get trending hashtags' });
  }
});

export default router;
