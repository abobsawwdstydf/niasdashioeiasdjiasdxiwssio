import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Navigation, Loader2 } from 'lucide-react';

interface LocationModalProps {
  onClose: () => void;
  onSend: (location: { lat: number; lng: number; accuracy: number; name?: string }) => void;
}

export default function LocationModal({ onClose, onSend }: LocationModalProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается в этом браузере');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ lat: latitude, lng: longitude, accuracy });
        setLoading(false);

        // Try to get address using reverse geocoding (free API)
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(res => res.json())
          .then(data => {
            if (data.display_name) {
              setAddress(data.display_name);
            }
          })
          .catch(() => {
            // Fallback to coordinates
            setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          });
      },
      (err) => {
        console.error('Geolocation error:', err);
        switch (err.code) {
          case 1:
            setError('Доступ к геолокации запрещён. Разрешите в настройках браузера.');
            break;
          case 2:
            setError('Не удалось определить местоположение');
            break;
          case 3:
            setError('Превышено время ожидания');
            break;
          default:
            setError('Ошибка определения местоположения');
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  const handleSend = () => {
    if (!location) return;
    onSend({
      ...location,
      name: address || undefined,
    });
    onClose();
  };

  const formatAccuracy = (meters: number): string => {
    if (meters < 1000) return `±${Math.round(meters)} м`;
    return `±${(meters / 1000).toFixed(1)} км`;
  };

  const getAccuracyLevel = (meters: number): string => {
    if (meters <= 10) return 'Отличная';
    if (meters <= 50) return 'Хорошая';
    if (meters <= 100) return 'Средняя';
    if (meters <= 500) return 'Низкая';
    return 'Очень низкая';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-surface-secondary rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <MapPin size={18} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Геолокация</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="text-nexo-400 animate-spin" />
              <p className="text-sm text-zinc-400">Определение местоположения...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Navigation size={24} className="text-red-400" />
              </div>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : location ? (
            <div className="space-y-4">
              {/* Map placeholder */}
              <div className="w-full h-40 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
                <div className="text-center">
                  <MapPin size={32} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-emerald-300 font-mono">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Address */}
              {address && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-zinc-400 mb-1">Адрес</p>
                  <p className="text-sm text-white">{address}</p>
                </div>
              )}

              {/* Accuracy */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-zinc-400">Точность</p>
                  <p className={`text-xs font-medium ${
                    location.accuracy <= 50 ? 'text-emerald-400' :
                    location.accuracy <= 200 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {getAccuracyLevel(location.accuracy)}
                  </p>
                </div>
                <p className="text-sm text-white">{formatAccuracy(location.accuracy)}</p>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <MapPin size={16} />
                Отправить местоположение
              </button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
