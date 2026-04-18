import express from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = express.Router();

/**
 * Create secret chat with password
 */
router.post('/secret', async (req: AuthRequest, res) => {
  try {
    const { participantId, password } = req.body;
    const userId = req.userId!;

    if (!participantId || !password) {
      return res.status(400).json({ error: 'Participant ID and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if secret chat already exists
    const existingChat = await prisma.chat.findFirst({
      where: {
        isSecret: true,
        members: {
          every: {
            userId: { in: [userId, participantId] }
          }
        }
      }
    });

    if (existingChat) {
      return res.status(400).json({ error: 'Secret chat already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create secret chat
    const chat = await prisma.chat.create({
      data: {
        type: 'personal',
        isSecret: true,
        isE2E: true,
        secretPassword: hashedPassword,
        members: {
          create: [
            { userId, role: 'admin' },
            { userId: participantId, role: 'member' }
          ]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isOnline: true,
                lastSeen: true
              }
            }
          }
        }
      }
    });

    res.json(chat);
  } catch (error) {
    console.error('Create secret chat error:', error);
    res.status(500).json({ error: 'Failed to create secret chat' });
  }
});

/**
 * Verify secret chat password
 */
router.post('/secret/:chatId/verify', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const { password } = req.body;
    const userId = req.userId!;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!chat || !chat.isSecret) {
      return res.status(404).json({ error: 'Secret chat not found' });
    }

    if (chat.members.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    if (!chat.secretPassword) {
      return res.status(400).json({ error: 'Chat password not set' });
    }

    const isValid = await bcrypt.compare(password, chat.secretPassword);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('Verify secret chat error:', error);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

/**
 * Change secret chat password
 */
router.put('/secret/:chatId/password', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const { oldPassword, newPassword } = req.body;
    const userId = req.userId!;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new passwords required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { userId, role: 'admin' }
        }
      }
    });

    if (!chat || !chat.isSecret) {
      return res.status(404).json({ error: 'Secret chat not found' });
    }

    if (chat.members.length === 0) {
      return res.status(403).json({ error: 'Only admin can change password' });
    }

    if (!chat.secretPassword) {
      return res.status(400).json({ error: 'Chat password not set' });
    }

    const isValid = await bcrypt.compare(oldPassword, chat.secretPassword);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.chat.update({
      where: { id: chatId },
      data: { secretPassword: hashedPassword }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Change secret chat password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
