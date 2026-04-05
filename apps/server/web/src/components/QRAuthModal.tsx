import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, QrCode, Key, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useLang } from '../lib/i18n';

interface QRAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRAuthModal({ isOpen, onClose }: QRAuthModalProps) {
  const { loginWithToken } = useAuthStore();
  const { t } = useLang();
  const [mode, setMode] = useState<'show' | 'enter'>('show');
  const [authKey, setAuthKey] = useState('');
  const [enteredKey, setEnteredKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [copied, setCopied] = useState(false);

  // Generate QR session on mount
  const generateSession = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.generateQRSession();
      setAuthKey(response.authKey);
      setTimeLeft(response.expiresIn || 300);
    } catch (e: any) {
      setError(e.message || 'Ошибка создания сессии');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && mode === 'show' && !authKey) {
      generateSession();
    }
  }, [isOpen, mode, authKey, generateSession]);

  // Poll for authentication status
  useEffect(() => {
    if (!isOpen || mode !== 'show' || !authKey) return;

    const interval = setInterval(async () => {
      try {
        const response = await api.checkQRSession(authKey);
        if (response.status === 'used' && response.token) {
          // User authenticated from another device
          loginWithToken(response.token, response.user);
          onClose();
        } else if (response.status === 'expired') {
          setError('Ключ истёк. Создайте новый.');
          clearInterval(interval);
        }
      } catch {
        // Silent - will retry
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, mode, authKey, loginWithToken, onClose]);

  // Timer countdown
  useEffect(() => {
    if (!isOpen || mode !== 'show') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, mode]);

  // Handle key login
  const handleKeyLogin = async () => {
    if (enteredKey.length !== 37) {
      setError('Ключ должен содержать 37 символов');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await api.loginWithKey(enteredKey);
      loginWithToken(response.token, response.user);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(authKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-surface-strong rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {mode === 'show' ? '📱 Вход в Nexo' : '🔑 Вход по ключу'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400">
              <X size={20} />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button
              onClick={() => { setMode('show'); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                mode === 'show' ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <QrCode size={16} />
              QR-код
            </button>
            <button
              onClick={() => { setMode('enter'); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                mode === 'enter' ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Key size={16} />
              Ключ
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          {mode === 'show' ? (
            <>
              {/* QR Code Display */}
              <div className="flex flex-col items-center">
                {isLoading ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <div className="w-10 h-10 border-3 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* QR Code Placeholder */}
                    <div className="w-48 h-48 bg-white rounded-xl p-4 flex items-center justify-center mb-4">
                      <div className="w-full h-full bg-gradient-to-br from-nexo-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                        <QrCode size={64} className="text-nexo-500" />
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-400 mb-3 text-center">
                      Отсканируйте QR-код в приложении Nexo
                    </p>

                    {/* Auth Key */}
                    <div className="w-full bg-white/5 rounded-xl p-4 mb-3">
                      <label className="text-xs text-zinc-500 mb-2 block">Или введите ключ вручную:</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm font-mono text-nexo-400 break-all">
                          {authKey}
                        </code>
                        <button
                          onClick={copyKey}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors"
                          title="Копировать"
                        >
                          {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <span>Истекает через: {formatTime(timeLeft)}</span>
                      <button
                        onClick={generateSession}
                        disabled={isLoading}
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Обновить"
                      >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Enter Key Mode */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">
                  Введите 37-символьный ключ авторизации:
                </label>
                <input
                  type="text"
                  value={enteredKey}
                  onChange={e => setEnteredKey(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  placeholder="nexo-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all font-mono text-sm mb-4"
                  maxLength={37}
                />
                <p className="text-xs text-zinc-600 mb-4">
                  Ключ состоит из 37 символов и начинается с "nexo-"
                </p>
                <button
                  onClick={handleKeyLogin}
                  disabled={isLoading || enteredKey.length !== 37}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium shadow-lg shadow-nexo-500/25 hover:shadow-nexo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Войти'
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
