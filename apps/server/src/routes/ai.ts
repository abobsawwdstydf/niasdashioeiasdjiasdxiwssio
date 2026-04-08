import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * ============================================
 * NEXO AI - Балансировка между Groq и OpenRouter
 * ============================================
 * 
 * Стратегия:
 * 1. Round-robin между 4 аккаунтами Groq
 * 2. Если Groq падает - fallback на OpenRouter
 * 3. Если оба падают - очередь с retry
 */

// API ключи Groq (4 аккаунта)
const GROQ_KEYS = [
  process.env.GROQ_KEY_1 || '',
  process.env.GROQ_KEY_2 || '',
  process.env.GROQ_KEY_3 || '',
  process.env.GROQ_KEY_4 || '',
].filter(k => k); // Убираем пустые

// API ключи OpenRouter (4 аккаунта)
const OPENROUTER_KEYS = [
  process.env.OPENROUTER_KEY_1 || '',
  process.env.OPENROUTER_KEY_2 || '',
  process.env.OPENROUTER_KEY_3 || '',
  process.env.OPENROUTER_KEY_4 || '',
].filter(k => k); // Убираем пустые

// Счётчик для round-robin
let groqIndex = 0;
let openrouterIndex = 0;

// Статус аккаунтов (если аккаунт временно не работает)
const groqFailed: boolean[] = [false, false, false, false];
const openrouterFailed: boolean[] = [false, false, false, false];

// Очередь запросов при перегрузке
interface QueuedRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  messages: any[];
  timestamp: number;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

/**
 * Получить следующий рабочий Groq ключ
 */
function getNextGroqKey(): string | null {
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const idx = (groqIndex + i) % GROQ_KEYS.length;
    if (!groqFailed[idx]) {
      groqIndex = (idx + 1) % GROQ_KEYS.length;
      return GROQ_KEYS[idx];
    }
  }
  return null; // Все Groq ключи не работают
}

/**
 * Получить следующий рабочий OpenRouter ключ
 */
function getNextOpenRouterKey(): string | null {
  for (let i = 0; i < OPENROUTER_KEYS.length; i++) {
    const idx = (openrouterIndex + i) % OPENROUTER_KEYS.length;
    if (!openrouterFailed[idx]) {
      openrouterIndex = (idx + 1) % OPENROUTER_KEYS.length;
      return OPENROUTER_KEYS[idx];
    }
  }
  return null;
}

/**
 * Запрос к Groq API с SSE стримингом
 */
async function streamFromGroq(messages: any[], res: Response, key: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Ты - Nexo AI, умный и дружелюбный ассистент мессенджера Nexo. Отвечай кратко и по делу. Если пользователь пишет "ну ты понял" или подобное - отвечай с юмором. Пиши на русском языке, если пользователь не указал другой язык.',
          },
          ...messages,
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429 || response.status >= 500) {
        return false; // Rate limit или ошибка сервера - пробуем другой ключ
      }
      throw new Error(`Groq API error: ${response.status} ${error}`);
    }

    // Стриминг SSE
    const reader = response.body?.getReader();
    if (!reader) return false;

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
            }
          } catch {
            // Игнорируем ошибки парсинга SSE
          }
        }
      }
    }

    // Отправляем полный текст
    res.write(`data: ${JSON.stringify({ done: true, text: fullText })}\n\n`);
    return true;
  } catch (error) {
    console.error('Groq stream error:', error);
    return false;
  }
}

/**
 * Запрос к OpenRouter API с SSE стримингом
 */
async function streamFromOpenRouter(messages: any[], res: Response, key: string): Promise<boolean> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nexo-0hs3.onrender.com',
        'X-Title': 'Nexo AI',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'Ты - Nexo AI, умный и дружелюбный ассистент мессенджера Nexo. Отвечай кратко и по делу. Если пользователь пишет "ну ты понял" или подобное - отвечай с юмором. Пиши на русском языке, если пользователь не указал другой языка.',
          },
          ...messages,
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429 || response.status >= 500) {
        return false;
      }
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    // Стриминг SSE
    const reader = response.body?.getReader();
    if (!reader) return false;

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
            }
          } catch {
            // Игнорируем ошибки парсинга SSE
          }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, text: fullText })}\n\n`);
    return true;
  } catch (error) {
    console.error('OpenRouter stream error:', error);
    return false;
  }
}

/**
 * Обработка очереди запросов
 */
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const req = requestQueue.shift();
    if (!req) continue;

    // Если запросу больше 30 секунд - отклоняем
    if (Date.now() - req.timestamp > 30000) {
      req.reject(new Error('Request timeout'));
      continue;
    }

    try {
      const result = await chatWithAI(req.messages);
      req.resolve(result);
    } catch (error) {
      req.reject(error as Error);
    }
  }

  isProcessingQueue = false;
}

/**
 * Основная функция чата с балансировкой
 */
async function chatWithAI(messages: any[]): Promise<{ text: string }> {
  // Пробуем Groq
  const groqKey = getNextGroqKey();
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'Ты - Nexo AI, умный и дружелюбный ассистент мессенджера Nexo. Отвечай кратко и по делу.',
            },
            ...messages,
          ],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { text: data.choices?.[0]?.message?.content || 'Извини, не могу ответить.' };
      }

      // Помечаем ключ как неудачный при 429/5xx
      if (response.status === 429 || response.status >= 500) {
        const idx = GROQ_KEYS.indexOf(groqKey);
        if (idx >= 0) groqFailed[idx] = true;
        // Сбрасываем через 60 секунд
        setTimeout(() => { if (idx >= 0) groqFailed[idx] = false; }, 60000);
      }
    } catch {
      // Ошибка сети
    }
  }

  // Fallback на OpenRouter
  const orKey = getNextOpenRouterKey();
  if (orKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexo-0hs3.onrender.com',
          'X-Title': 'Nexo AI',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            {
              role: 'system',
              content: 'Ты - Nexo AI, умный и дружелюбный ассистент мессенджера Nexo. Отвечай кратко и по делу.',
            },
            ...messages,
          ],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { text: data.choices?.[0]?.message?.content || 'Извини, не могу ответить.' };
      }

      if (response.status === 429 || response.status >= 500) {
        const idx = OPENROUTER_KEYS.indexOf(orKey);
        if (idx >= 0) openrouterFailed[idx] = true;
        setTimeout(() => { if (idx >= 0) openrouterFailed[idx] = false; }, 60000);
      }
    } catch {
      // Ошибка сети
    }
  }

  throw new Error('Все AI сервисы временно недоступны. Попробуй позже.');
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/ai/chat - Обычный чат (JSON)
 */
router.post('/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Сообщения обязательны' });
    return;
  }

  try {
    const result = await chatWithAI(messages);
    res.json(result);
  } catch (error: any) {
    // Если все сервисы заняты - ставим в очередь
    if (requestQueue.length < 10) {
      const promise = new Promise<any>((resolve, reject) => {
        requestQueue.push({ resolve, reject, messages, timestamp: Date.now() });
      });

      processQueue();

      try {
        const result = await promise;
        res.json(result);
      } catch {
        res.status(503).json({ error: 'Сервис временно недоступен' });
      }
    } else {
      res.status(503).json({ error: 'Сервис перегружен, попробуй позже' });
    }
  }
});

/**
 * POST /api/ai/chat/stream - Стриминг чат (SSE)
 */
router.post('/chat/stream', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Сообщения обязательны' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Пробуем Groq
  let groqKey = getNextGroqKey();
  if (groqKey) {
    const success = await streamFromGroq(messages, res, groqKey);
    if (success) {
      res.end();
      return;
    }

    // Помечаем ключ как неудачный
    const idx = GROQ_KEYS.indexOf(groqKey);
    if (idx >= 0) {
      groqFailed[idx] = true;
      setTimeout(() => { if (idx >= 0) groqFailed[idx] = false; }, 60000);
    }
  }

  // Fallback на OpenRouter
  const orKey = getNextOpenRouterKey();
  if (orKey) {
    const success = await streamFromOpenRouter(messages, res, orKey);
    if (success) {
      res.end();
      return;
    }

    const idx = OPENROUTER_KEYS.indexOf(orKey);
    if (idx >= 0) {
      openrouterFailed[idx] = true;
      setTimeout(() => { if (idx >= 0) openrouterFailed[idx] = false; }, 60000);
    }
  }

  // Все сервисы не работают
  res.write(`data: ${JSON.stringify({ error: 'Сервис временно недоступен' })}\n\n`);
  res.end();
});

/**
 * GET /api/ai/status - Статус AI сервисов
 */
router.get('/status', authenticateToken, (_req: AuthRequest, res: Response) => {
  res.json({
    groq: {
      total: GROQ_KEYS.length,
      available: GROQ_KEYS.length - groqFailed.filter(Boolean).length,
    },
    openrouter: {
      total: OPENROUTER_KEYS.length,
      available: OPENROUTER_KEYS.length - openrouterFailed.filter(Boolean).length,
    },
    queue: requestQueue.length,
  });
});

export default router;
