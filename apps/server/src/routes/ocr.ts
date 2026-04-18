import express from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';

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

// OCR endpoint - extract text from image using OpenAI Vision API
router.post('/extract', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Изображение обязательно' });
    }

    const { language = 'ru' } = req.body;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      console.warn('OPENAI_API_KEY not configured, OCR disabled');
      return res.status(503).json({ 
        error: 'OCR временно недоступен',
        text: '[Распознавание текста недоступно - API ключ не настроен]'
      });
    }

    try {
      // Convert image buffer to base64
      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      // Call OpenAI Vision API for OCR
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all text from this image. Return only the extracted text, nothing else. If the text is in ${language === 'ru' ? 'Russian' : 'English'}, preserve the original language.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const extractedText = response.data.choices[0]?.message?.content || '';

      res.json({
        success: true,
        text: extractedText.trim(),
        language,
      });
    } catch (apiError: any) {
      console.error('OpenAI Vision API error:', apiError.response?.data || apiError.message);
      
      res.json({
        success: false,
        error: 'Не удалось распознать текст',
        text: '[Ошибка распознавания]'
      });
    }
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Ошибка извлечения текста' });
  }
});

// OCR from URL
router.post('/extract-url', async (req: AuthRequest, res) => {
  try {
    const { imageUrl, language = 'ru' } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL изображения обязателен' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      console.warn('OPENAI_API_KEY not configured, OCR disabled');
      return res.status(503).json({ 
        error: 'OCR временно недоступен',
        text: '[Распознавание текста недоступно - API ключ не настроен]'
      });
    }

    try {
      // Call OpenAI Vision API with image URL
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all text from this image. Return only the extracted text, nothing else. If the text is in ${language === 'ru' ? 'Russian' : 'English'}, preserve the original language.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const extractedText = response.data.choices[0]?.message?.content || '';

      res.json({
        success: true,
        text: extractedText.trim(),
        language,
      });
    } catch (apiError: any) {
      console.error('OpenAI Vision API error:', apiError.response?.data || apiError.message);
      
      res.json({
        success: false,
        error: 'Не удалось распознать текст',
        text: '[Ошибка распознавания]'
      });
    }
  } catch (error) {
    console.error('OCR URL error:', error);
    res.status(500).json({ error: 'Ошибка извлечения текста из URL' });
  }
});

export default router;
