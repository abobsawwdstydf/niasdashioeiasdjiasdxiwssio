import express from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all quick replies for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const quickReplies = await prisma.quickReply.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(quickReplies);
  } catch (error) {
    console.error('Error fetching quick replies:', error);
    res.status(500).json({ error: 'Ошибка получения быстрых ответов' });
  }
});

// Create quick reply
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { shortcut, message } = req.body;
    const userId = req.userId!;

    if (!shortcut || !message) {
      return res.status(400).json({ error: 'Шорткат и сообщение обязательны' });
    }

    // Check if shortcut already exists
    const existing = await prisma.quickReply.findUnique({
      where: {
        userId_shortcut: {
          userId,
          shortcut
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Этот шорткат уже существует' });
    }

    const quickReply = await prisma.quickReply.create({
      data: {
        userId,
        shortcut,
        message
      }
    });

    res.json(quickReply);
  } catch (error) {
    console.error('Error creating quick reply:', error);
    res.status(500).json({ error: 'Ошибка создания быстрого ответа' });
  }
});

// Update quick reply
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const { shortcut, message } = req.body;
    const userId = req.userId!;

    const quickReply = await prisma.quickReply.findUnique({
      where: { id }
    });

    if (!quickReply || quickReply.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому быстрому ответу' });
    }

    const updated = await prisma.quickReply.update({
      where: { id },
      data: {
        ...(shortcut && { shortcut }),
        ...(message && { message })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating quick reply:', error);
    res.status(500).json({ error: 'Ошибка обновления быстрого ответа' });
  }
});

// Delete quick reply
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const userId = req.userId!;

    const quickReply = await prisma.quickReply.findUnique({
      where: { id }
    });

    if (!quickReply || quickReply.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому быстрому ответу' });
    }

    await prisma.quickReply.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quick reply:', error);
    res.status(500).json({ error: 'Ошибка удаления быстрого ответа' });
  }
});

// Get priority contacts
router.get('/priority-contacts', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const contacts = await prisma.priorityContact.findMany({
      where: { userId },
      orderBy: { priority: 'desc' }
    });

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching priority contacts:', error);
    res.status(500).json({ error: 'Ошибка получения приоритетных контактов' });
  }
});

// Add priority contact
router.post('/priority-contacts', async (req: AuthRequest, res) => {
  try {
    const { contactId, priority } = req.body;
    const userId = req.userId!;

    if (!contactId) {
      return res.status(400).json({ error: 'ID контакта обязателен' });
    }

    const contact = await prisma.priorityContact.upsert({
      where: {
        userId_contactId: {
          userId,
          contactId
        }
      },
      create: {
        userId,
        contactId,
        priority: priority ?? 0
      },
      update: {
        priority: priority ?? 0
      }
    });

    res.json(contact);
  } catch (error) {
    console.error('Error adding priority contact:', error);
    res.status(500).json({ error: 'Ошибка добавления приоритетного контакта' });
  }
});

// Remove priority contact
router.delete('/priority-contacts/:contactId', async (req: AuthRequest, res) => {
  try {
    const contactId = String(req.params.contactId);
    const userId = req.userId!;

    await prisma.priorityContact.delete({
      where: {
        userId_contactId: {
          userId,
          contactId
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing priority contact:', error);
    res.status(500).json({ error: 'Ошибка удаления приоритетного контакта' });
  }
});

export default router;
