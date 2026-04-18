import express from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';

const router = express.Router();

// Multer config for audio upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только аудио файлы разрешены'));
    }
  }
});

// Speech-to-text endpoint with OpenAI Whisper
router.post('/transcribe', upload.single('audio'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудио файл обязателен' });
    }

    const { language = 'ru' } = req.body;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      console.warn('OPENAI_API_KEY not configured, speech-to-text disabled');
      return res.status(503).json({ 
        error: 'Speech-to-text временно недоступен',
        text: '[Транскрипция недоступна - API ключ не настроен]'
      });
    }

    try {
      // Prepare form data for OpenAI Whisper API
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: 'audio.webm',
        contentType: req.file.mimetype,
      });
      formData.append('model', 'whisper-1');
      if (language) {
        formData.append('language', language);
      }

      // Call OpenAI Whisper API
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${openaiKey}`,
          },
          timeout: 60000, // 60 seconds
        }
      );

      const transcribedText = response.data.text || '';

      res.json({
        success: true,
        text: transcribedText,
        language: response.data.language || language,
        duration: response.data.duration || 0,
      });
    } catch (apiError: any) {
      console.error('OpenAI Whisper API error:', apiError.response?.data || apiError.message);
      
      // Return graceful fallback
      res.json({
        success: false,
        error: 'Не удалось распознать речь',
        text: '[Ошибка транскрипции]'
      });
    }
  } catch (error) {
    console.error('Speech-to-text error:', error);
    res.status(500).json({ error: 'Ошибка транскрипции аудио' });
  }
});

// Real-time speech recognition (not supported by Whisper API, requires streaming service)
router.post('/transcribe-stream', async (req: AuthRequest, res) => {
  try {
    // Streaming speech-to-text requires WebSocket and streaming API (Google Speech-to-Text, Azure, etc.)
    // OpenAI Whisper doesn't support streaming, so we return a helpful message
    res.json({
      success: false,
      message: 'Потоковая транскрипция требует WebSocket соединения. Используйте /transcribe для файлов.'
    });
  } catch (error) {
    console.error('Streaming speech-to-text error:', error);
    res.status(500).json({ error: 'Ошибка потоковой транскрипции' });
  }
});

export default router;
