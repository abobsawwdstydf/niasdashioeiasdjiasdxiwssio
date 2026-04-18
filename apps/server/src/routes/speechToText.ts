import express from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';

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

// Speech-to-text endpoint
router.post('/transcribe', upload.single('audio'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудио файл обязателен' });
    }

    const { language = 'ru' } = req.body;

    // TODO: Integrate with speech recognition service (Google Speech-to-Text, OpenAI Whisper, etc.)
    // For now, return a stub response
    const transcribedText = 'Speech-to-text функция в разработке. Транскрипция будет здесь.';

    res.json({
      success: true,
      text: transcribedText,
      language,
      duration: 0,
      confidence: 0.95
    });
  } catch (error) {
    console.error('Speech-to-text error:', error);
    res.status(500).json({ error: 'Ошибка транскрипции аудио' });
  }
});

// Real-time speech recognition (WebSocket would be better for this)
router.post('/transcribe-stream', async (req: AuthRequest, res) => {
  try {
    // TODO: Implement streaming speech recognition
    res.json({
      success: true,
      message: 'Streaming speech-to-text в разработке'
    });
  } catch (error) {
    console.error('Streaming speech-to-text error:', error);
    res.status(500).json({ error: 'Ошибка потоковой транскрипции' });
  }
});

export default router;
