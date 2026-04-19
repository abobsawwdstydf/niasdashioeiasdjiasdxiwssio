import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Sparkles, Check, Zap, Shield, Star, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { NexoLoader } from '../components/LoadingStates';
import { fadeInUp, scaleInBounce } from '../lib/animations';

interface PremiumStatus {
  isPremium: boolean;
  premiumUntil: string | null;
  premiumType: string | null;
  beavers: number;
}

interface PremiumPageProps {
  onClose: () => void;
}

const PREMIUM_PRICES = {
  1: { price: 101, discount: 0 },
  3: { price: 270, discount: 10 },
  6: { price: 505, discount: 17 },
  12: { price: 970, discount: 20 },
};

const PREMIUM_FEATURES = [
  { icon: Sparkles, text: 'AI контекст из чатов', premium: true },
  { icon: Zap, text: 'Умные предложения ответов', premium: true },
  { icon: Shield, text: 'Автодополнение текста', premium: true },
  { icon: Star, text: 'Исправление грамматики', premium: true },
  { icon: TrendingUp, text: 'Неограниченные папки', premium: true },
  { icon: Check, text: 'Умный поиск с фильтрами', premium: true },
  { icon: Zap, text: 'Быстрые ответы (шаблоны)', premium: true },
  { icon: Crown, text: 'Кастомные темы и фоны', premium: true },
  { icon: TrendingUp, text: 'Расширенная статистика', premium: true },
  { icon: Shield, text: 'Экспорт в PDF/HTML/JSON', premium: true },
  { icon: Shield, text: 'Секретные чаты', premium: true },
  { icon: Star, text: 'Анимированные аватары', premium: true },
  { icon: Sparkles, text: 'Музыка в профиле', premium: true },
  { icon: Crown, text: 'Приоритетная поддержка', premium: true },
];

export default function PremiumPage({ onClose }: PremiumPageProps) {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number>(1);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.getPremiumStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load premium status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!status) return;

    const price = PREMIUM_PRICES[selectedMonths as keyof typeof PREMIUM_PRICES].price;
    
    if (status.beavers < price) {
      alert(`Недостаточно бобров! Нужно: ${price}, у вас: ${status.beavers}`);
      return;
    }

    if (!confirm(`Купить Premium на ${selectedMonths} мес. за ${price} бобров?`)) {
      return;
    }

    setPurchasing(true);
    try {
      await api.purchasePremium(selectedMonths);
      await loadStatus();
      alert('Premium успешно активирован!');
    } catch (error: any) {
      console.error('Purchase failed:', error);
      alert(error.response?.data?.error || 'Ошибка покупки');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      >
        <NexoLoader size="lg" />
      </motion.div>
    );
  }

  const isPremiumActive = status?.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <motion.div
        {...scaleInBounce}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-strong rounded-3xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 glass-strong border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              <Crown size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nexo Premium</h2>
              <p className="text-sm text-zinc-400">Разблокируйте все возможности</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl glass-btn text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Status */}
          {isPremiumActive && (
            <motion.div {...fadeInUp} className="glass-card p-6 rounded-2xl border-2 border-yellow-500/30">
              <div className="flex items-center gap-3 mb-3">
                <Crown size={24} className="text-yellow-500" />
                <h3 className="text-lg font-bold text-white">Premium активен</h3>
              </div>
              <p className="text-zinc-400">
                Действует до: {new Date(status.premiumUntil!).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </motion.div>
          )}

          {/* Balance */}
          <motion.div {...fadeInUp} className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400 mb-1">Ваш баланс</p>
                <p className="text-3xl font-bold text-white">{status?.beavers || 0} 🦫</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">1 бобр = 1 рубль</p>
              </div>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Выберите подписку</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(PREMIUM_PRICES).map(([months, { price, discount }]) => (
                <motion.button
                  key={months}
                  {...fadeInUp}
                  onClick={() => setSelectedMonths(Number(months))}
                  className={`glass-card p-6 rounded-2xl text-left transition-all ${
                    selectedMonths === Number(months)
                      ? 'ring-2 ring-yellow-500 bg-yellow-500/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {discount > 0 && (
                    <div className="inline-block px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold mb-3">
                      -{discount}%
                    </div>
                  )}
                  <p className="text-2xl font-bold text-white mb-1">{months} мес.</p>
                  <p className="text-3xl font-bold text-yellow-500 mb-2">{price} 🦫</p>
                  <p className="text-xs text-zinc-500">
                    {Math.round(price / Number(months))} 🦫/мес
                  </p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Возможности Premium</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PREMIUM_FEATURES.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 glass-subtle p-3 rounded-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <feature.icon size={16} className="text-white" />
                  </div>
                  <span className="text-sm text-zinc-300">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Purchase Button */}
          <motion.button
            {...fadeInUp}
            onClick={handlePurchase}
            disabled={purchasing || (status?.beavers || 0) < PREMIUM_PRICES[selectedMonths as keyof typeof PREMIUM_PRICES].price}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-yellow-500/30 transition-all flex items-center justify-center gap-2"
          >
            {purchasing ? (
              <>
                <NexoLoader size="sm" />
                <span>Обработка...</span>
              </>
            ) : (
              <>
                <Crown size={20} />
                <span>
                  Купить Premium за {PREMIUM_PRICES[selectedMonths as keyof typeof PREMIUM_PRICES].price} 🦫
                </span>
              </>
            )}
          </motion.button>

          {(status?.beavers || 0) < PREMIUM_PRICES[selectedMonths as keyof typeof PREMIUM_PRICES].price && (
            <p className="text-center text-sm text-red-400">
              Недостаточно бобров. Нужно ещё {PREMIUM_PRICES[selectedMonths as keyof typeof PREMIUM_PRICES].price - (status?.beavers || 0)} 🦫
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
