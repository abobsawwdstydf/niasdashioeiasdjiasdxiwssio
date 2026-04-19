import express from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { getSocket } from '../socket';

const router = express.Router();

// Generate bot token
function generateBotToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create a new bot
router.post('/create', async (req: AuthRequest, res) => {
  try {
    const { name, username, description, avatar } = req.body;
    const ownerId = req.user!.userId;

    if (!name || !username) {
      return res.status(400).json({ error: 'Имя и username обязательны' });
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username должен содержать 3-20 символов (латиница, цифры, _)' });
    }

    // Check if username is taken
    const existing = await prisma.bot.findUnique({
      where: { username }
    });

    if (existing) {
      return res.status(400).json({ error: 'Этот username уже занят' });
    }

    const token = generateBotToken();

    const bot = await prisma.bot.create({
      data: {
        name,
        username,
        description: description || null,
        avatar: avatar || null,
        token,
        ownerId
      }
    });

    res.json(bot);
  } catch (error) {
    console.error('Error creating bot:', error);
    res.status(500).json({ error: 'Ошибка создания бота' });
  }
});

// Get user's bots
router.get('/my', async (req: AuthRequest, res) => {
  try {
    const ownerId = req.user!.userId;

    const bots = await prisma.bot.findMany({
      where: { ownerId },
      include: {
        commands: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(bots);
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Ошибка получения ботов' });
  }
});

// Get bot by ID
router.get('/:botId', async (req: AuthRequest, res) => {
  try {
    const { botId } = req.params;
    const userId = req.user!.userId;

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        commands: true
      }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Бот не найден' });
    }

    if (bot.ownerId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому боту' });
    }

    res.json(bot);
  } catch (error) {
    console.error('Error fetching bot:', error);
    res.status(500).json({ error: 'Ошибка получения бота' });
  }
});

// Update bot
router.put('/:botId', async (req: AuthRequest, res) => {
  try {
    const { botId } = req.params;
    const { name, description, avatar, webhookUrl, webhookSecret, isActive } = req.body;
    const userId = req.user!.userId;

    const bot = await prisma.bot.findUnique({
      where: { id: botId }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Бот не найден' });
    }

    if (bot.ownerId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому боту' });
    }

    const updated = await prisma.bot.update({
      where: { id: botId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(avatar !== undefined && { avatar }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(webhookSecret !== undefined && { webhookSecret }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        commands: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({ error: 'Ошибка обновления бота' });
  }
});

// Delete bot
router.delete('/:botId', async (req: AuthRequest, res) => {
  try {
    const { botId } = req.params;
    const userId = req.user!.userId;

    const bot = await prisma.bot.findUnique({
      where: { id: botId }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Бот не найден' });
    }

    if (bot.ownerId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому боту' });
    }

    await prisma.bot.delete({
      where: { id: botId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ error: 'Ошибка удаления бота' });
  }
});

// Add command to bot
router.post('/:botId/commands', async (req: AuthRequest, res) => {
  try {
    const { botId } = req.params;
    const { command, description } = req.body;
    const userId = req.user!.userId;

    if (!command || !description) {
      return res.status(400).json({ error: 'Команда и описание обязательны' });
    }

    const bot = await prisma.bot.findUnique({
      where: { id: botId }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Бот не найден' });
    }

    if (bot.ownerId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому боту' });
    }

    const botCommand = await prisma.botCommand.create({
      data: {
        botId,
        command: command.replace(/^\//, ''), // Remove leading slash
        description
      }
    });

    res.json(botCommand);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Эта команда уже существует' });
    }
    console.error('Error adding command:', error);
    res.status(500).json({ error: 'Ошибка добавления команды' });
  }
});

// Delete command
router.delete('/:botId/commands/:commandId', async (req: AuthRequest, res) => {
  try {
    const { botId, commandId } = req.params;
    const userId = req.user!.userId;

    const bot = await prisma.bot.findUnique({
      where: { id: botId }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Бот не найден' });
    }

    if (bot.ownerId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому боту' });
    }

    await prisma.botCommand.delete({
      where: { id: commandId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting command:', error);
    res.status(500).json({ error: 'Ошибка удаления команды' });
  }
});

// Bot API: Send message (using bot token)
router.post('/api/:token/sendMessage', async (req, res) => {
  try {
    const { token } = req.params;
    const { chatId, text, type = 'text' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const bot = await prisma.bot.findUnique({
      where: { token }
    });

    if (!bot || !bot.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive bot token' });
    }

    // Check if bot has access to chat
    const member = await prisma.chatMember.findFirst({
      where: {
        chatId,
        userId: bot.ownerId
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'Bot owner is not a member of this chat' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: bot.ownerId,
        content: text,
        type
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
          }
        }
      }
    });

    // Emit via socket
    const io = getSocket();
    if (io) {
      io.to(chatId).emit('new_message', message);
    }

    res.json({ success: true, message });
  } catch (error) {
    console.error('Error sending bot message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Regenerate bot token
router.post('/:botId/regenerate-token', async (req: AuthRequest, res) => {
  try {
    const { botId } = req.params;
    const userId = req.user!.userId;

    const bot = await prisma.bot.findUnique({
      where: { id: botId }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Бот не найден' });
    }

    if (bot.ownerId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому боту' });
    }

    const newToken = generateBotToken();

    const updated = await prisma.bot.update({
      where: { id: botId },
      data: { token: newToken }
    });

    res.json({ token: updated.token });
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({ error: 'Ошибка генерации токена' });
  }
});

export default router;
