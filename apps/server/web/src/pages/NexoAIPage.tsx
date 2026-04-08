import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Loader2, Sparkles, X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export default function NexoAIPage({ onClose }: { onClose?: () => void }) {
  const { token } = useAuthStore();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /** Определяем мобильное устройство */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Автоскролл вниз */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** Инициализация распознавания речи */
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  /** Переключение записи голоса */
  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      console.warn('Speech Recognition not supported');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        // Уже записывает
      }
    }
  }, [isRecording]);

  /** Отправка сообщения со стримингом */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsSending(true);

    // Создаём placeholder для ответа AI
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }]);

    // Отменяем предыдущий запрос если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Формируем историю сообщений
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userInput });

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Network error');
      }

      // Читаем SSE стрим
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.token) {
                fullText += json.token;
                // Обновляем сообщение AI в реальном времени
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                ));
              }
              if (json.done) {
                fullText = json.text || fullText;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullText, isStreaming: false } : m
                ));
              }
              if (json.error) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: '⚠️ ' + json.error, isStreaming: false } : m
                ));
              }
            } catch {
              // Игнорируем ошибки парсинга
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: '❌ Не удалось получить ответ. Попробуй позже.', isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [input, isSending, messages, token]);

  /** Отправка по Enter */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /** Приветственное сообщение */
  const welcomeMessage = "Привет! Я Nexo AI 🤖\n\nМогу помочь с ответами на вопросы, переводами, кодом или просто поболтать. Спрашивай что угодно!";

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* ====== HEADER ====== */}
      <div className="glass-strong px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {/* Закрыть (мобилки) */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="glass-btn w-9 h-9 rounded-xl text-zinc-400"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Логотип и название */}
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-nexo-500 to-purple-600 blur-lg rounded-xl opacity-50" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Nexo AI</h1>
            <p className="text-[10px] text-zinc-500">Умный ассистент</p>
          </div>
        </div>

        {/* Закрыть (ПК) */}
        {!isMobile && onClose && (
          <button
            onClick={onClose}
            className="glass-btn w-9 h-9 rounded-xl text-zinc-400"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ====== СООБЩЕНИЯ ====== */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence>
          {messages.length === 0 ? (
            /* Приветствие */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center gap-4"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-nexo-500/30 to-purple-600/30 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 rounded-full glass flex items-center justify-center animate-float">
                  <Sparkles size={32} className="text-nexo-400" />
                </div>
              </div>
              <div className="max-w-xs">
                <h2 className="text-lg font-bold text-white mb-2">Nexo AI</h2>
                <p className="text-sm text-zinc-400 whitespace-pre-line">{welcomeMessage}</p>
              </div>
            </motion.div>
          ) : (
            /* Список сообщений */
            <div className="space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-nexo-500 to-purple-600 text-white rounded-br-md'
                        : 'glass-subtle text-zinc-200 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-nexo-400 ml-0.5 animate-pulse-soft rounded-full" />
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ====== ПОЛЕ ВВОДА ====== */}
      <div className="glass-strong px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          {/* Кнопка записи голоса */}
          <button
            onClick={toggleRecording}
            className={`glass-btn w-10 h-10 rounded-xl flex-shrink-0 transition-all ${
              isRecording
                ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse-soft'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {isRecording ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* Поле ввода */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напиши сообщение..."
              rows={1}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 glass-input resize-none max-h-24"
              style={{ minHeight: '40px' }}
            />
          </div>

          {/* Кнопка отправки */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="glass-btn w-10 h-10 rounded-xl flex-shrink-0 text-nexo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-nexo-300"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        {/* Индикатор записи */}
        {isRecording && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-400 mt-2 text-center"
          >
            🔴 Запись голоса... Говори сейчас
          </motion.p>
        )}
      </div>
    </div>
  );
}
