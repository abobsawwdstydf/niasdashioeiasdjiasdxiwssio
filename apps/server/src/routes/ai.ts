import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================
// NEXO AI - Балансировка 4 сервисов
// ============================================
//
// Приоритет:
//   1. Cerebras  (80-90% запросов, до 1M токенов/день/аккаунт)
//   2. Groq      (резерв, стабильный)
//   3. SambaNova (глубокий резерв)
//   4. OpenRouter (последний рубеж, free модели)
//
// Модели:
//   Cerebras: qwen-3-235b-a22b-instruct-2507 (сложные), llama3.1-8b (простые)
//   Groq: llama-3.3-70b-versatile
//   SambaNova: Meta-Llama-3.1-70B-Instruct
//   OpenRouter: mistral-7b-instruct:free

// ---------- Загрузка ключей из env ----------

function loadKeys(prefix: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    const key = process.env[`${prefix}_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

const CEREBRAS_KEYS = loadKeys('CEREBRAS_KEY', 4);
const GROQ_KEYS = loadKeys('GROQ_KEY', 4);
const SAMBANOVA_KEYS = loadKeys('SAMBANOVA_KEY', 4);
const OPENROUTER_KEYS = loadKeys('OPENROUTER_KEY', 4);

// ---------- Состояние аккаунтов ----------

interface ProviderState {
  keys: string[];
  failed: boolean[];   // true = ключ временно не работает
  index: number;       // round-robin указатель
  name: string;
}

const providers: ProviderState[] = [
  { keys: CEREBRAS_KEYS, failed: CEREBRAS_KEYS.map(() => false), index: 0, name: 'Cerebras' },
  { keys: GROQ_KEYS, failed: GROQ_KEYS.map(() => false), index: 0, name: 'Groq' },
  { keys: SAMBANOVA_KEYS, failed: SAMBANOVA_KEYS.map(() => false), index: 0, name: 'SambaNova' },
  { keys: OPENROUTER_KEYS, failed: OPENROUTER_KEYS.map(() => false), index: 0, name: 'OpenRouter' },
];

// ---------- Очередь запросов ----------

interface QueuedRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  messages: any[];
  stream: boolean;
  res?: Response;
  timestamp: number;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

const MAX_QUEUE_SIZE = 50;
const REQUEST_TIMEOUT = 45000; // 45 секунд

// ---------- Helper: найти рабочий ключ ----------

function getNextKey(state: ProviderState): string | null {
  if (state.keys.length === 0) return null;

  for (let i = 0; i < state.keys.length; i++) {
    const idx = (state.index + i) % state.keys.length;
    if (!state.failed[idx]) {
      state.index = (idx + 1) % state.keys.length;
      return state.keys[idx];
    }
  }
  return null; // Все ключи этого провайдера временно не работают
}

function markKeyFailed(state: ProviderState, key: string) {
  const idx = state.keys.indexOf(key);
  if (idx >= 0) {
    state.failed[idx] = true;
    // Сброс через 120 секунд
    setTimeout(() => { state.failed[idx] = false; }, 120000);
  }
}

function countAvailable(state: ProviderState): number {
  return state.keys.length - state.failed.filter(Boolean).length;
}

// ---------- SYSTEM PROMPT ----------

const SYSTEM_PROMPT = `Ты — Nexo AI, умный и дружелюбный ассистент мессенджера Nexo.

Правила:
- Отвечай кратко и по делу
- Если пользователь пишет "ну ты понял" или подобное — отвечай с юмором
- Пиши на русском языке, если пользователь не указал другой язык
- Используй markdown для форматирования (жирный, курсив, списки, код)
- Для блоков кода используй тройные кавычки с указанием языка`;

// ============================================
// СТРИМИНГ — CEREBRAS
// ============================================

async function streamCerebras(messages: any[], res: Response, key: string, isSimple: boolean): Promise<boolean> {
  const model = isSimple ? 'llama3.1-8b' : 'qwen-3-235b-a22b-instruct-2507';

  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_completion_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    if (response.status === 429 || response.status >= 500) return false;
    throw new Error(`Cerebras ${response.status}: ${err}`);
  }

  return consumeSSEStream(response, res);
}

// ============================================
// СТРИМИНГ — GROQ
// ============================================

async function streamGroq(messages: any[], res: Response, key: string): Promise<boolean> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    if (response.status === 429 || response.status >= 500) return false;
    throw new Error(`Groq ${response.status}: ${err}`);
  }

  return consumeSSEStream(response, res);
}

// ============================================
// СТРИМИНГ — SAMBANOVA
// ============================================

async function streamSambaNova(messages: any[], res: Response, key: string): Promise<boolean> {
  const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3.1-70B-Instruct',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    if (response.status === 429 || response.status >= 500) return false;
    throw new Error(`SambaNova ${response.status}: ${err}`);
  }

  return consumeSSEStream(response, res);
}

// ============================================
// СТРИМИНГ — OPENROUTER
// ============================================

async function streamOpenRouter(messages: any[], res: Response, key: string): Promise<boolean> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nexo-0hs3.onrender.com',
      'X-Title': 'Nexo AI',
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    if (response.status === 429 || response.status >= 500) return false;
    throw new Error(`OpenRouter ${response.status}: ${err}`);
  }

  return consumeSSEStream(response, res);
}

// ============================================
// SSE STREAM CONSUMER (универсальный)
// ============================================

async function consumeSSEStream(fetchResponse: Response, res: Response): Promise<boolean> {
  const reader = fetchResponse.body?.getReader();
  if (!reader) return false;

  const decoder = new TextDecoder();
  let fullText = '';

  try {
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
          } catch { /* игнорируем ошибки парсинга SSE */ }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, text: fullText })}\n\n`);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// НЕ-СТРИМ ЗАПРОСЫ (для JSON endpoint)
// ============================================

async function requestCerebras(messages: any[], key: string, isSimple: boolean): Promise<string> {
  const model = isSimple ? 'llama3.1-8b' : 'qwen-3-235b-a22b-instruct-2507';
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_completion_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new Error('RATE_LIMIT');
    throw new Error(`Cerebras ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function requestGroq(messages: any[], key: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new Error('RATE_LIMIT');
    throw new Error(`Groq ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function requestSambaNova(messages: any[], key: string): Promise<string> {
  const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'Meta-Llama-3.1-70B-Instruct',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new Error('RATE_LIMIT');
    throw new Error(`SambaNova ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function requestOpenRouter(messages: any[], key: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nexo-0hs3.onrender.com',
      'X-Title': 'Nexo AI',
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new Error('RATE_LIMIT');
    throw new Error(`OpenRouter ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================
// ОПРЕДЕЛЕНИЕ ТИПА ЗАПРОСА
// ============================================

/**
 * Простой запрос — короткое сообщение, приветствие, перевод
 * Использует лёгкую модель для скорости
 */
function isSimpleQuery(messages: any[]): boolean {
  const lastMsg = messages[messages.length - 1]?.content || '';
  return lastMsg.length < 100;
}

// ============================================
// ОСНОВНОЙ БАЛАНСИРОВЩИК — СТРИМИНГ
// ============================================

async function tryStream(messages: any[], res: Response): Promise<boolean> {
  const isSimple = isSimpleQuery(messages);

  // 1. CEREBRAS
  const cerberasState = providers[0];
  const cKey = getNextKey(cerberasState);
  if (cKey) {
    const ok = await streamCerebras(messages, res, cKey, isSimple);
    if (ok) return true;
    markKeyFailed(cerberasState, cKey);
  }

  // 2. GROQ
  const groqState = providers[1];
  const gKey = getNextKey(groqState);
  if (gKey) {
    const ok = await streamGroq(messages, res, gKey);
    if (ok) return true;
    markKeyFailed(groqState, gKey);
  }

  // 3. SAMBANOVA
  const snState = providers[2];
  const sKey = getNextKey(snState);
  if (sKey) {
    const ok = await streamSambaNova(messages, res, sKey);
    if (ok) return true;
    markKeyFailed(snState, sKey);
  }

  // 4. OPENROUTER
  const orState = providers[3];
  const oKey = getNextKey(orState);
  if (oKey) {
    const ok = await streamOpenRouter(messages, res, oKey);
    if (ok) return true;
    markKeyFailed(orState, oKey);
  }

  return false;
}

// ============================================
// ОСНОВНОЙ БАЛАНСИРОВЩИК — JSON
// ============================================

async function tryRequest(messages: any[]): Promise<string> {
  const isSimple = isSimpleQuery(messages);
  let lastError = '';

  // 1. CEREBRAS
  const cState = providers[0];
  const cKey = getNextKey(cState);
  if (cKey) {
    try { return await requestCerebras(messages, cKey, isSimple); }
    catch (e: any) { if (e.message !== 'RATE_LIMIT') lastError = e.message; markKeyFailed(cState, cKey); }
  }

  // 2. GROQ
  const gState = providers[1];
  const gKey = getNextKey(gState);
  if (gKey) {
    try { return await requestGroq(messages, gKey); }
    catch (e: any) { if (e.message !== 'RATE_LIMIT') lastError = e.message; markKeyFailed(gState, gKey); }
  }

  // 3. SAMBANOVA
  const sState = providers[2];
  const sKey = getNextKey(sState);
  if (sKey) {
    try { return await requestSambaNova(messages, sKey); }
    catch (e: any) { if (e.message !== 'RATE_LIMIT') lastError = e.message; markKeyFailed(sState, sKey); }
  }

  // 4. OPENROUTER
  const oState = providers[3];
  const oKey = getNextKey(oState);
  if (oKey) {
    try { return await requestOpenRouter(messages, oKey); }
    catch (e: any) { if (e.message !== 'RATE_LIMIT') lastError = e.message; markKeyFailed(oState, oKey); }
  }

  throw new Error(lastError || 'Все AI сервисы временно недоступны');
}

// ============================================
// ОБРАБОТКА ОЧЕРЕДИ
// ============================================

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const req = requestQueue.shift();
    if (!req) continue;

    // Таймаут
    if (Date.now() - req.timestamp > REQUEST_TIMEOUT) {
      req.reject(new Error('Request timeout'));
      continue;
    }

    try {
      if (req.stream && req.res) {
        const ok = await tryStream(req.messages, req.res);
        if (ok) { req.res.end(); req.resolve(true); }
        else req.reject(new Error('All providers failed'));
      } else {
        const text = await tryRequest(req.messages);
        req.resolve({ text });
      }
    } catch (error) {
      req.reject(error as Error);
    }
  }

  isProcessingQueue = false;
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/ai/chat — обычный JSON ответ
 */
router.post('/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Сообщения обязательны' });
    return;
  }

  try {
    const text = await tryRequest(messages);
    res.json({ text });
  } catch (error: any) {
    // Ставим в очередь если есть место
    if (requestQueue.length < MAX_QUEUE_SIZE) {
      const promise = new Promise<any>((resolve, reject) => {
        requestQueue.push({ resolve, reject, messages, stream: false, timestamp: Date.now() });
      });

      processQueue();

      try {
        const result = await promise;
        res.json(result);
      } catch {
        res.status(503).json({ error: 'Nexo AI перегружен, попробуй через несколько секунд' });
      }
    } else {
      res.status(503).json({ error: 'Nexo AI перегружен, попробуй позже' });
    }
  }
});

/**
 * POST /api/ai/chat/stream — SSE стриминг
 */
router.post('/chat/stream', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Сообщения обязательны' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    const ok = await tryStream(messages, res);
    if (ok) { res.end(); return; }
  } catch { /* пробуем очередь */ }

  // Очередь
  if (requestQueue.length < MAX_QUEUE_SIZE) {
    const promise = new Promise<any>((resolve, reject) => {
      requestQueue.push({ resolve, reject, messages, stream: true, res, timestamp: Date.now() });
    });

    processQueue();

    try {
      await promise;
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'Nexo AI перегружен, попробуй через несколько секунд' })}\n\n`);
    }
  } else {
    res.write(`data: ${JSON.stringify({ error: 'Nexo AI перегружен, попробуй позже' })}\n\n`);
  }

  res.end();
});

/**
 * GET /api/ai/status — статус всех провайдеров
 */
router.get('/status', authenticateToken, (_req: AuthRequest, res: Response) => {
  res.json({
    providers: providers.map(p => ({
      name: p.name,
      total: p.keys.length,
      available: countAvailable(p),
      failed: p.failed.filter(Boolean).length,
    })),
    queue: requestQueue.length,
  });
});

export default router;
