import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/folders - Получить все папки пользователя
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const folders = await prisma.chatFolder.findMany({
      where: { userId },
      include: {
        chats: {
          include: {
            members: {
              where: { userId },
              select: {
                isMuted: true,
                isPinned: true,
                isArchived: true,
              },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    res.json(folders);
  } catch (error) {
    console.error('Ошибка получения папок:', error);
    res.status(500).json({ error: 'Ошибка получения папок' });
  }
});

/**
 * POST /api/folders - Создать новую папку
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, icon, color } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Название папки обязательно' });
      return;
    }

    // Получаем максимальный order для новой папки
    const maxOrder = await prisma.chatFolder.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const folder = await prisma.chatFolder.create({
      data: {
        userId,
        name: name.trim(),
        icon: icon || '📁',
        color: color || '#6366f1',
        order: (maxOrder?.order || 0) + 1,
      },
      include: {
        chats: true,
      },
    });

    res.json(folder);
  } catch (error) {
    console.error('Ошибка создания папки:', error);
    res.status(500).json({ error: 'Ошибка создания папки' });
  }
});

/**
 * PUT /api/folders/:id - Обновить папку
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const { name, icon, color, order } = req.body;

    // Проверяем что папка принадлежит пользователю
    const existing = await prisma.chatFolder.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }

    const folder = await prisma.chatFolder.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(order !== undefined && { order }),
      },
      include: {
        chats: true,
      },
    });

    res.json(folder);
  } catch (error) {
    console.error('Ошибка обновления папки:', error);
    res.status(500).json({ error: 'Ошибка обновления папки' });
  }
});

/**
 * DELETE /api/folders/:id - Удалить папку
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);

    // Проверяем что папка принадлежит пользователю
    const existing = await prisma.chatFolder.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }

    await prisma.chatFolder.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления папки:', error);
    res.status(500).json({ error: 'Ошибка удаления папки' });
  }
});

/**
 * POST /api/folders/:id/chats - Добавить чат в папку
 */
router.post('/:id/chats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const { chatId } = req.body;

    if (!chatId) {
      res.status(400).json({ error: 'chatId обязателен' });
      return;
    }

    // Проверяем что папка принадлежит пользователю
    const folder = await prisma.chatFolder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }

    // Проверяем что пользователь является участником чата
    const membership = await prisma.chatMember.findFirst({
      where: { chatId, userId },
    });

    if (!membership) {
      res.status(403).json({ error: 'Вы не являетесь участником этого чата' });
      return;
    }

    // Добавляем чат в папку
    await prisma.chatFolder.update({
      where: { id },
      data: {
        chats: {
          connect: { id: chatId },
        },
      },
    });

    const updated = await prisma.chatFolder.findUnique({
      where: { id },
      include: {
        chats: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Ошибка добавления чата в папку:', error);
    res.status(500).json({ error: 'Ошибка добавления чата в папку' });
  }
});

/**
 * DELETE /api/folders/:id/chats/:chatId - Убрать чат из папки
 */
router.delete('/:id/chats/:chatId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const chatId = String(req.params.chatId);

    // Проверяем что папка принадлежит пользователю
    const folder = await prisma.chatFolder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }

    // Убираем чат из папки
    await prisma.chatFolder.update({
      where: { id },
      data: {
        chats: {
          disconnect: { id: chatId },
        },
      },
    });

    const updated = await prisma.chatFolder.findUnique({
      where: { id },
      include: {
        chats: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Ошибка удаления чата из папки:', error);
    res.status(500).json({ error: 'Ошибка удаления чата из папки' });
  }
});

export default router;
