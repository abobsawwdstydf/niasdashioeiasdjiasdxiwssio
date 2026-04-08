import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Navigation, Loader2, Crosshair } from 'lucide-react';

interface LocationModalProps {
  onClose: () => void;
  onSend: (location: { lat: number; lng: number; accuracy: number; name?: string }) => void;
}

export default function LocationModal({ onClose, onSend }: LocationModalProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>('Определение...');
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается');
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        // Accuracy should be reasonable - filter out very inaccurate readings
        if (accuracy > 500) return; // Wait for better accuracy
        
        setLocation({ lat: latitude, lng: longitude, accuracy });
        setLoading(false);

        // Reverse geocoding with Nominatim (free, no API key)
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ru`, {
          headers: { 'User-Agent': 'Nexo Messenger App' }
        })
          .then(res => res.json())
          .then(data => {
            if (data.address) {
              const parts = [];
              if (data.address.road) parts.push(data.address.road);
              if (data.address.house_number) parts.push(data.address.house_number);
              if (data.address.city || data.address.town || data.address.village) parts.push(data.address.city || data.address.town || data.address.village);
              if (data.address.country) parts.push(data.address.country);
              setAddress(parts.join(', ') || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          })
          .catch(() => setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`));
      },
      (err) => {
        console.error('Geolocation error:', err);
        switch (err.code) {
          case 1: setError('Доступ к геолокации запрещён. Разрешите в настройках браузера.'); break;
          case 2: setError('Не удалось определить местоположение'); break;
          case 3: setError('Превышено время ожидания'); break;
          default: setError('Ошибка определения местоположения');
        }
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => { navigator.geolocation.clearWatch(watchId); };
  }, []);

  const handleSend = () => {
    if (!location) return;
    onSend({ ...location, name: address || undefined });
    onClose();
  };

  const formatAccuracy = (meters: number): string => {
    if (meters < 1000) return `±${Math.round(meters)} м`;
    return `±${(meters / 1000).toFixed(1)} км`;
  };

  const getAccuracyColor = (meters: number): string => {
    if (meters <= 20) return 'text-emerald-400';
    if (meters <= 50) return 'text-green-400';
    if (meters <= 100) return 'text-yellow-400';
    if (meters <= 200) return 'text-orange-400';
    return 'text-red-400';
  };

  // Static map image from OpenStreetMap
  const mapUrl = location
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${location.lat},${location.lng}&zoom=16&size=400x200&maptype=mapnik&markers=${location.lat},${location.lng},red`
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm bg-surface-secondary/95 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <MapPin size={14} className="text-white" />
            </div>
            <h3 className="text-sm font-semibold text-white">Геолокация</h3>
          </div>
          <button onClick={onClose} disabled={loading}
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-50">
            <X size={14} />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 size={28} className="text-nexo-400 animate-spin" />
              <p className="text-sm text-zinc-400">Определение местоположения...</p>
              <p className="text-xs text-zinc-500">Разрешите доступ к GPS</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                <Navigation size={20} className="text-red-400" />
              </div>
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <button onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
                className="text-xs text-nexo-400 hover:text-nexo-300">
                Попробовать снова
              </button>
            </div>
          ) : location ? (
            <div className="space-y-3">
              {/* Map */}
              <div ref={mapRef} className="relative w-full h-36 rounded-xl overflow-hidden bg-zinc-800">
                {mapUrl ? (
                  <img src={mapUrl} alt="map" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500">
                    <Crosshair size={24} className="animate-pulse" />
                  </div>
                )}
                {/* Center marker */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-red-500/50" />
                </div>
              </div>

              {/* Address */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-zinc-400 mb-1">Адрес</p>
                <p className="text-sm text-white">{address}</p>
              </div>

              {/* Accuracy */}
              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Точность GPS</p>
                  <p className="text-sm text-white">{formatAccuracy(location.accuracy)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crosshair size={14} className={getAccuracyColor(location.accuracy)} />
                  <span className={`text-xs font-medium ${getAccuracyColor(location.accuracy)}`}>
                    {location.accuracy <= 20 ? 'Отличная' : location.accuracy <= 50 ? 'Хорошая' : location.accuracy <= 100 ? 'Средняя' : 'Низкая'}
                  </span>
                </div>
              </div>

              {/* Coordinates */}
              <p className="text-xs text-zinc-500 font-mono text-center">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>

              {/* Send */}
              <button onClick={handleSend}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2">
                <MapPin size={14} />
                Отправить местоположение
              </button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
