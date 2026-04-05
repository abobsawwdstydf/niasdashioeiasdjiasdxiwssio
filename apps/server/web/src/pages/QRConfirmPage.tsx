import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function QRConfirmPage() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'logged-out' | 'confirming' | 'confirmed' | 'error'>('loading');
  const [error, setError] = useState('');

  // Get key from URL path: /auth/verify/:key
  const pathKey = window.location.pathname.split('/').pop() || '';

  useEffect(() => {
    if (!pathKey || pathKey.length < 37) {
      setStatus('error');
      setError('Неверный ключ');
      return;
    }

    if (!user) {
      setStatus('logged-out');
      return;
    }

    setStatus('confirming');
  }, [pathKey, user]);

  const handleConfirm = async () => {
    if (!pathKey || !user) return;
    
    setStatus('confirming');
    try {
      await api.confirmQRLogin(pathKey);
      setStatus('confirmed');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (e: any) {
      setStatus('error');
      setError(e.message || 'Ошибка подтверждения');
    }
  };

  const handleLoginFirst = () => {
    localStorage.setItem('nexo_qr_key', pathKey);
    window.location.href = '/';
  };

  return (
    <div className="h-full flex items-center justify-center bg-surface">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-strong rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl text-center"
      >
        {/* Logo */}
        <div className="mb-6">
          <img src="/logo.png" alt="Nexo" className="w-16 h-16 rounded-2xl mx-auto mb-3" />
          <h1 className="text-2xl font-bold gradient-text">Nexo Messenger</h1>
        </div>

        {status === 'loading' && (
          <div className="py-8">
            <Loader2 size={48} className="mx-auto text-nexo-500 animate-spin mb-4" />
            <p className="text-zinc-400">Проверка...</p>
          </div>
        )}

        {status === 'logged-out' && (
          <>
            <div className="py-4">
              <X size={48} className="mx-auto text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Необходимо войти в аккаунт</h2>
              <p className="text-sm text-zinc-400 mb-6">
                Войдите в аккаунт Nexo чтобы подтвердить вход на другом устройстве
              </p>
            </div>
            <button
              onClick={handleLoginFirst}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium"
            >
              Войти в аккаунт
            </button>
          </>
        )}

        {status === 'confirming' && (
          <div className="py-8">
            <Loader2 size={48} className="mx-auto text-nexo-500 animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Подтверждение входа</h2>
            <p className="text-sm text-zinc-400">
              Подтверждаю вход для <span className="text-nexo-400">{user?.displayName || user?.username}</span>
            </p>
            <button
              onClick={handleConfirm}
              className="mt-6 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium"
            >
              Подтвердить сейчас
            </button>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Вход подтверждён!</h2>
            <p className="text-sm text-zinc-400">
              Перенаправляю на другое устройство...
            </p>
          </div>
        )}

        {status === 'error' && (
          <>
            <div className="py-4">
              <X size={48} className="mx-auto text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Ошибка</h2>
              <p className="text-sm text-zinc-400 mb-6">{error}</p>
            </div>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              <ArrowLeft size={16} className="inline mr-2" />
              Вернуться на главную
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
