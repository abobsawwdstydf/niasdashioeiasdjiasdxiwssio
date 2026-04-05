import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, Monitor, Tablet, X, LogOut, 
  ChevronRight, Check, AlertTriangle, Globe 
} from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';

interface Device {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  addedAt: string;
}

interface DevicesTabProps {
  onClose: () => void;
}

export default function DevicesTab({ onClose }: DevicesTabProps) {
  const { t } = useLang();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch {
      // Mock data for demo
      setDevices([
        {
          id: '1',
          deviceName: 'Chrome on Windows',
          browser: 'Chrome 120',
          os: 'Windows 11',
          ip: '192.168.1.100',
          location: 'Москва, Россия',
          lastActive: new Date().toISOString(),
          isCurrent: true,
          addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          deviceName: 'Safari on iPhone',
          browser: 'Safari 17',
          os: 'iOS 17',
          ip: '192.168.1.105',
          location: 'Москва, Россия',
          lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          isCurrent: false,
          addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const terminateDevice = async (deviceId: string) => {
    setTerminatingId(deviceId);
    try {
      await api.terminateDevice(deviceId);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch {
      // Optimistic update
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } finally {
      setTerminatingId(null);
    }
  };

  const terminateAll = async () => {
    if (!confirm('Завершить все сессии кроме текущей?')) return;
    try {
      const result = await api.terminateAllDevices();
      setDevices(prev => prev.filter(d => d.isCurrent));
    } catch {
      setDevices(prev => prev.filter(d => d.isCurrent));
    }
  };

  const getDeviceIcon = (os: string) => {
    if (os.toLowerCase().includes('iphone') || os.toLowerCase().includes('ios') || os.toLowerCase().includes('android')) {
      return <Smartphone size={20} className="text-nexo-400" />;
    }
    if (os.toLowerCase().includes('ipad') || os.toLowerCase().includes('tablet')) {
      return <Tablet size={20} className="text-nexo-400" />;
    }
    return <Monitor size={20} className="text-nexo-400" />;
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Сейчас';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    return `${diffDays} дн. назад`;
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 bg-surface flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <X size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">Устройства</h3>
        <button 
          onClick={terminateAll}
          className="text-xs text-red-400 hover:text-red-300 font-medium"
        >
          Завершить все
        </button>
      </div>

      {/* Info */}
      <div className="px-4 py-3 bg-nexo-500/10 border-b border-nexo-500/20">
        <p className="text-xs text-zinc-400">
          Здесь показаны все устройства, на которых выполнен вход в ваш аккаунт
        </p>
      </div>

      {/* Devices List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
            <Smartphone size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Нет активных устройств</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {devices.map(device => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    {getDeviceIcon(device.os)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{device.deviceName}</p>
                      {device.isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-500/20 text-nexo-400 font-medium">
                          Текущее
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {device.browser} • {device.os}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Globe size={10} />
                        {device.location}
                      </span>
                      <span>IP: {device.ip}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Последняя активность: {formatLastActive(device.lastActive)}
                    </p>
                  </div>

                  {/* Action */}
                  {!device.isCurrent && (
                    <button
                      onClick={() => terminateDevice(device.id)}
                      disabled={terminatingId === device.id}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    >
                      {terminatingId === device.id ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <LogOut size={16} />
                      )}
                    </button>
                  )}
                  {device.isCurrent && (
                    <div className="p-2 text-emerald-400">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-surface-tertiary/50">
        <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Если видите незнакомое устройство — завершите его сессию и смените пароль
        </p>
      </div>
    </motion.div>
  );
}
