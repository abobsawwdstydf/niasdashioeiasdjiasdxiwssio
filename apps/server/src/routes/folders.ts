import express from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all folders for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const folders = await prisma.chatFolder.findMany({
      where: { userId },
      include: {
        chats: {
          include: {
            members: {
              where: { userId },
              select: { isPinned: true, isMuted: true }
            }
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    res.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Ошибка получения папок' });
  }
});

// Create folder
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, icon, color } = req.body;
    const userId = req.user!.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Название папки обязательно' });
    }

    // Get max order
    const maxOrder = await prisma.chatFolder.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    const folder = await prisma.chatFolder.create({
      data: {
        userId,
        name,
        icon,
        color,
        order: (maxOrder?.order ?? -1) + 1
      }
    });

    res.json(folder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Ошибка создания папки' });
  }
});

// Update folder
router.put('/:folderId', async (req: AuthRequest, res) => {
  try {
    const { folderId } = req.params;
    const { name, icon, color, order } = req.body;
    const userId = req.user!.userId;

    // Check ownership
    const folder = await prisma.chatFolder.findUnique({
      where: { id: folderId }
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этой папке' });
    }

    const updated = await prisma.chatFolder.update({
      where: { id: folderId },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(typeof order === 'number' && { order })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Ошибка обновления папки' });
  }
});

// Delete folder
router.delete('/:folderId', async (req: AuthRequest, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user!.userId;

    const folder = await prisma.chatFolder.findUnique({
      where: { id: folderId }
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этой папке' });
    }

    await prisma.chatFolder.delete({
      where: { id: folderId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Ошибка удаления папки' });
  }
});

// Add chat to folder
router.post('/:folderId/chats/:chatId', async (req: AuthRequest, res) => {
  try {
    const { folderId, chatId } = req.params;
    const userId = req.user!.userId;

    // Check folder ownership
    const folder = await prisma.chatFolder.findUnique({
      where: { id: folderId }
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этой папке' });
    }

    // Check if user is member of chat
    const member = await prisma.chatMember.findFirst({
      where: { chatId, userId }
    });

    if (!member) {
      return res.status(403).json({ error: 'Вы не являетесь участником этого чата' });
    }

    // Add chat to folder (many-to-many relation)
    await prisma.chatFolder.update({
      where: { id: folderId },
      data: {
        chats: {
          connect: { id: chatId }
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding chat to folder:', error);
    res.status(500).json({ error: 'Ошибка добавления чата в папку' });
  }
});

// Remove chat from folder
router.delete('/:folderId/chats/:chatId', async (req: AuthRequest, res) => {
  try {
    const { folderId, chatId } = req.params;
    const userId = req.user!.userId;

    const folder = await prisma.chatFolder.findUnique({
      where: { id: folderId }
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этой папке' });
    }

    await prisma.chatFolder.update({
      where: { id: folderId },
      data: {
        chats: {
          disconnect: { id: chatId }
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing chat from folder:', error);
    res.status(500).json({ error: 'Ошибка удаления чата из папки' });
  }
});

export default router;
