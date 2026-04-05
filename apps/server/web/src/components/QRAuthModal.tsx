import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, QrCode, Key, RefreshCw, Camera, CameraOff } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useLang } from '../lib/i18n';
import QrScanner from 'qr-scanner';
import QrCodeSvg from 'qrcode';

interface QRAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRAuthModal({ isOpen, onClose }: QRAuthModalProps) {
  const { loginWithToken } = useAuthStore();
  const { t } = useLang();
  const [mode, setMode] = useState<'show' | 'scan'>('show');
  const [authKey, setAuthKey] = useState('');
  const [enteredKey, setEnteredKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate QR session on mount
  const generateSession = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.generateQRSession();
      setAuthKey(response.authKey);
      setTimeLeft(response.expiresIn || 300);

      // Generate QR code SVG
      const qrUrl = `${response.serverUrl}/auth/verify/${response.authKey}`;
      const dataUrl = await QrCodeSvg.toDataURL(qrUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);

      // Start polling for auth status
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const status = await api.checkQRSession(response.authKey);
          if (status.status === 'used' && status.token) {
            loginWithToken(status.token, status.user);
            onClose();
            clearInterval(pollingRef.current!);
          } else if (status.status === 'expired') {
            setError('Ключ истёк. Создайте новый.');
            clearInterval(pollingRef.current!);
          }
        } catch {
          // Silent - will retry
        }
      }, 3000);
    } catch (e: any) {
      setError(e.message || 'Ошибка создания сессии');
    } finally {
      setIsLoading(false);
    }
  }, [loginWithToken, onClose]);

  useEffect(() => {
    if (isOpen && mode === 'show' && !authKey) {
      generateSession();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopCamera();
    };
  }, [isOpen, mode, authKey, generateSession]);

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            // Parse QR result - should contain URL with key
            const url = result.data;
            const keyMatch = url.match(/\/auth\/verify\/([a-zA-Z0-9-]+)/);
            if (keyMatch) {
              setEnteredKey(keyMatch[1]);
              stopCamera();
            }
          },
          { returnDetailedScanResult: true }
        );
        scannerRef.current.start();
      }
    } catch (e: any) {
      setError('Не удалось открыть камеру: ' + e.message);
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleKeyLogin = async () => {
    if (enteredKey.length < 37) {
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
          className="bg-surface-strong rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {mode === 'show' ? '📱 Вход в Nexo' : '📷 Сканировать QR'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400">
              <X size={20} />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button
              onClick={() => { setMode('show'); setError(''); stopCamera(); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                mode === 'show' ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <QrCode size={16} />
              Показать QR
            </button>
            <button
              onClick={() => { setMode('scan'); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                mode === 'scan' ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Camera size={16} />
              Сканировать
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
            <div className="flex flex-col items-center">
              {isLoading ? (
                <div className="w-48 h-48 flex items-center justify-center">
                  <div className="w-10 h-10 border-3 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* QR Code */}
                  {qrDataUrl && (
                    <div className="w-48 h-48 bg-white rounded-xl p-4 flex items-center justify-center mb-4">
                      <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
                    </div>
                  )}

                  <p className="text-sm text-zinc-400 mb-3 text-center">
                    Отсканируйте QR-код в приложении Nexo
                  </p>

                  {/* Auth Key */}
                  <div className="w-full bg-white/5 rounded-xl p-4 mb-3">
                    <label className="text-xs text-zinc-500 mb-2 block">Или введите ключ вручную:</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm font-mono text-nexo-400 break-all text-center">
                        {authKey}
                      </code>
                      <button
                        onClick={copyKey}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
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
          ) : (
            <div>
              {/* Camera View */}
              <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                    <CameraOff size={48} className="mb-2 opacity-50" />
                    <p className="text-sm">Нажмите кнопку для сканирования</p>
                  </div>
                )}
                {/* Scan overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 border-2 border-nexo-500/50 rounded-xl">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-nexo-500 rounded-lg" />
                  </div>
                )}
              </div>

              <button
                onClick={cameraActive ? stopCamera : startCamera}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium mb-4"
              >
                {cameraActive ? '⏹️ Остановить камеру' : '📷 Открыть камеру'}
              </button>

              {/* Manual key entry */}
              <div className="border-t border-white/10 pt-4">
                <label className="text-sm text-zinc-400 mb-2 block">Или введите ключ вручную:</label>
                <input
                  type="text"
                  value={enteredKey}
                  onChange={e => setEnteredKey(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  placeholder="nexo-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all font-mono text-sm mb-4"
                  maxLength={37}
                />
                <button
                  onClick={handleKeyLogin}
                  disabled={isLoading || enteredKey.length < 37}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium shadow-lg shadow-nexo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Войти по ключу'
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
