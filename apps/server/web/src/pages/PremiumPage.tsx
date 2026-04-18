import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { PremiumStatus, PremiumPrices, Transaction } from '../lib/types';
import { ArrowLeft, Crown, Sparkles, Check, Loader2 } from 'lucide-react';

export default function PremiumPage({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [prices, setPrices] = useState<{ prices: PremiumPrices; features: string[] } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, pricesRes, transactionsRes] = await Promise.all([
        api.get('/premium/status'),
        api.get('/premium/prices'),
        api.get('/users/transactions?limit=10'),
      ]);

      setStatus(statusRes.data);
      setPrices(pricesRes.data);
      setTransactions(transactionsRes.data.transactions || []);
    } catch (err: any) {
      console.error('Failed to load premium data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (months: string) => {
    if (!status || !prices) return;

    const price = prices.prices[months as keyof PremiumPrices];
    
    if (status.beavers < price) {
      setError(`Недостаточно бобров! Нужно: ${price}, у вас: ${status.beavers}`);
      return;
    }

    if (!confirm(`Купить премиум на ${months.replace('month', ' мес.')}?\nСтоимость: ${price} 🦫`)) {
      return;
    }

    try {
      setPurchasing(months);
      setError(null);

      const res = await api.post('/premium/purchase', { months });
      
      setStatus(res.data);
      await loadData();
      
      alert('✨ Премиум успешно активирован!');
    } catch (err: any) {
      console.error('Purchase failed:', err);
      setError(err.response?.data?.error || 'Ошибка покупки');
    } finally {
      setPurchasing(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getPriceInfo = (months: string) => {
    if (!prices) return { price: 0, discount: 0, perMonth: 0 };
    
    const price = prices.prices[months as keyof PremiumPrices];
    const monthCount = parseInt(months.replace('months', '').replace('month', ''));
    const perMonth = Math.round(price / monthCount);
    const fullPrice = 101 * monthCount;
    const discount = Math.round(((fullPrice - price) / fullPrice) * 100);

    return { price, discount, perMonth };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-400" />
            <h1 className="text-2xl font-bold">Nexo Premium</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Current Status */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Ваш статус</h2>
                <p className="text-white/60">
                  {status.isPremium ? (
                    <>
                      <span className="text-yellow-400 font-semibold">Premium активен</span>
                      {status.premiumUntil && (
                        <> до {formatDate(status.premiumUntil)}</>
                      )}
                    </>
                  ) : (
                    'Бесплатный аккаунт'
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{status.beavers} 🦫</div>
                <p className="text-sm text-white/60">Ваш баланс</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        {/* Pricing Cards */}
        {prices && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Выберите подписку</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(['1month', '3months', '6months', '12months'] as const).map((months, idx) => {
                const { price, discount, perMonth } = getPriceInfo(months);
                const monthCount = parseInt(months.replace('months', '').replace('month', ''));
                const isPopular = months === '6months';

                return (
                  <motion.div
                    key={months}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`relative p-6 rounded-2xl border-2 ${
                      isPopular
                        ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-400'
                        : 'bg-white/5 border-white/20'
                    } hover:scale-105 transition-transform`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-black text-xs font-bold rounded-full">
                        ПОПУЛЯРНО
                      </div>
                    )}
                    
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold mb-1">{monthCount}</div>
                      <div className="text-sm text-white/60">
                        {monthCount === 1 ? 'месяц' : 'месяца'}
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold mb-1">{price} 🦫</div>
                      {discount > 0 && (
                        <div className="text-sm text-green-400 font-semibold">
                          Скидка {discount}%
                        </div>
                      )}
                      <div className="text-xs text-white/60 mt-1">
                        {perMonth} 🦫/мес
                      </div>
                    </div>

                    <button
                      onClick={() => handlePurchase(months)}
                      disabled={purchasing !== null}
                      className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                        isPopular
                          ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                          : 'bg-white/10 hover:bg-white/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                    >
                      {purchasing === months ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Покупка...
                        </>
                      ) : (
                        'Купить'
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Features */}
        {prices && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12 p-8 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold">Возможности Premium</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prices.features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="p-6 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20"
          >
            <h2 className="text-xl font-bold mb-4">История транзакций</h2>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{tx.description || tx.type}</div>
                    <div className="text-sm text-white/60">
                      {formatDate(tx.createdAt)}
                    </div>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount} 🦫
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
