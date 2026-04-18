import express from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get chat statistics for user
router.get('/chat/:chatId', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user!.userId;

    // Check if user is member
    const member = await prisma.chatMember.findFirst({
      where: { chatId, userId }
    });

    if (!member) {
      return res.status(403).json({ error: 'Вы не являетесь участником этого чата' });
    }

    let stats = await prisma.chatStatistics.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    });

    if (!stats) {
      // Create initial stats
      stats = await prisma.chatStatistics.create({
        data: {
          chatId,
          userId,
          messageCount: 0,
          mediaCount: 0,
          lastActive: new Date()
        }
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching chat statistics:', error);
    res.status(500).json({ error: 'Ошибка получения статистики чата' });
  }
});

// Get user activity graph
router.get('/activity', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { days = 7 } = req.query;

    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get message count per day
    const messages = await prisma.message.findMany({
      where: {
        senderId: userId,
        createdAt: {
          gte: startDate
        },
        isDeleted: false
      },
      select: {
        createdAt: true
      }
    });

    // Group by day
    const activityMap = new Map<string, number>();
    
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      activityMap.set(dateStr, 0);
    }

    messages.forEach(msg => {
      const dateStr = msg.createdAt.toISOString().split('T')[0];
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
    });

    const activity = Array.from(activityMap.entries()).map(([date, count]) => ({
      date,
      count
    })).reverse();

    res.json({ activity });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Ошибка получения активности' });
  }
});

// Export chat history
router.get('/export/chat/:chatId', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user!.userId;
    const { format = 'json' } = req.query;

    // Check if user is member
    const member = await prisma.chatMember.findFirst({
      where: { chatId, userId }
    });

    if (!member) {
      return res.status(403).json({ error: 'Вы не являетесь участником этого чата' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        isDeleted: false
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        },
        media: true
      },
      orderBy: { createdAt: 'asc' }
    });

    if (format === 'json') {
      res.json({ messages });
    } else if (format === 'txt') {
      const text = messages.map(msg => 
        `[${msg.createdAt.toISOString()}] ${msg.sender.displayName || msg.sender.username}: ${msg.content || '[media]'}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}.txt"`);
      res.send(text);
    } else {
      res.status(400).json({ error: 'Неподдерживаемый формат' });
    }
  } catch (error) {
    console.error('Error exporting chat:', error);
    res.status(500).json({ error: 'Ошибка экспорта чата' });
  }
});

// Document preview stub
router.get('/preview/:fileId', async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;

    // TODO: Implement document preview using libraries like pdf.js, mammoth, etc.
    res.json({
      success: false,
      message: 'Предпросмотр документов в разработке'
    });
  } catch (error) {
    console.error('Error previewing document:', error);
    res.status(500).json({ error: 'Ошибка предпросмотра документа' });
  }
});

export default router;
