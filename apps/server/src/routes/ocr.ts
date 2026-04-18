import express from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Multer config for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  }
});

// OCR endpoint - extract text from image
router.post('/extract', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Изображение обязательно' });
    }

    // TODO: Integrate with Tesseract.js or cloud OCR service
    // For now, return a stub response
    const extractedText = 'OCR функция в разработке. Текст будет извлечен здесь.';

    res.json({
      success: true,
      text: extractedText,
      language: 'ru',
      confidence: 0.95
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Ошибка извлечения текста' });
  }
});

// OCR from URL
router.post('/extract-url', async (req: AuthRequest, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL изображения обязателен' });
    }

    // TODO: Download image and process with OCR
    const extractedText = 'OCR функция в разработке. Текст будет извлечен из URL.';

    res.json({
      success: true,
      text: extractedText,
      language: 'ru',
      confidence: 0.95
    });
  } catch (error) {
    console.error('OCR URL error:', error);
    res.status(500).json({ error: 'Ошибка извлечения текста из URL' });
  }
});

export default router;
