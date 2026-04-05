import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, QrCode, Camera, CameraOff, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useLang } from '../lib/i18n';
import QrScanner from 'qr-scanner';
import QrCodeSvg from 'qrcode';

interface QRAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean; // Whether user is already logged in
}

export default function QRAuthModal({ isOpen, onClose, isLoggedIn }: QRAuthModalProps) {
  const { loginWithToken, user } = useAuthStore();
  const { t } = useLang();
  const [authKey, setAuthKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate QR session on mount
  const generateSession = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setConfirmed(false);
    try {
      const response = await api.generateQRSession();
      setAuthKey(response.authKey);
      setTimeLeft(response.expiresIn || 300);

      // Generate QR code SVG that points to confirm page
      const qrUrl = `${response.serverUrl}/auth/verify/${response.authKey}`;
      const dataUrl = await QrCodeSvg.toDataURL(qrUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);

      // If logged in, start polling for confirmation
      if (isLoggedIn) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
          try {
            const status = await api.checkQRSession(response.authKey);
            if (status.status === 'used') {
              setConfirmed(true);
              clearInterval(pollingRef.current!);
              setTimeout(onClose, 2000);
            } else if (status.status === 'expired') {
              setError('QR код истёк. Создайте новый.');
              clearInterval(pollingRef.current!);
            }
          } catch {
            // Silent - will retry
          }
        }, 3000);
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка создания сессии');
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, onClose]);

  useEffect(() => {
    if (isOpen && !authKey) {
      generateSession();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopCamera();
    };
  }, [isOpen, authKey, generateSession]);

  // Timer countdown
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        scannerRef.current = new QrScanner(
          videoRef.current,
          async (result) => {
            // Parse QR result - should contain URL with key
            const url = result.data;
            const keyMatch = url.match(/\/auth\/verify\/([a-zA-Z0-9-]+)/);
            if (keyMatch && isLoggedIn) {
              stopCamera();
              await confirmLogin(keyMatch[1]);
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

  const confirmLogin = async (key: string) => {
    if (!isLoggedIn) return;
    setConfirming(true);
    setError('');
    try {
      await api.confirmQRLogin(key);
      setConfirmed(true);
      setTimeout(onClose, 2000);
    } catch (e: any) {
      setError(e.message || 'Ошибка подтверждения');
    } finally {
      setConfirming(false);
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
              {isLoggedIn ? '📱 Подтвердить вход' : '📱 Вход по QR-коду'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400">
              <X size={20} />
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

          {confirmed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
            >
              <Check size={48} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-emerald-400 font-medium">Вход подтверждён!</p>
            </motion.div>
          )}

          {isLoading ? (
            <div className="w-48 h-48 flex items-center justify-center mx-auto">
              <div className="w-10 h-10 border-3 border-nexo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {!isLoggedIn ? (
                // NOT LOGGED IN - Show QR code for scanning
                <div className="flex flex-col items-center">
                  {qrDataUrl && (
                    <div className="w-48 h-48 bg-white rounded-xl p-4 flex items-center justify-center mb-4">
                      <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
                    </div>
                  )}

                  <p className="text-sm text-zinc-400 mb-3 text-center">
                    Отсканируйте QR-код камерой телефона<br />с открытым приложением Nexo
                  </p>

                  <div className="w-full bg-white/5 rounded-xl p-4 mb-3">
                    <label className="text-xs text-zinc-500 mb-2 block">Или используйте ключ на другом устройстве:</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm font-mono text-nexo-400 break-all text-center">
                        {authKey}
                      </code>
                      <button
                        onClick={copyKey}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span>Истекает через: {formatTime(timeLeft)}</span>
                    <button
                      onClick={generateSession}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    </button>
                  </div>
                </div>
              ) : (
                // LOGGED IN - Show camera for scanning OR wait for confirmation
                <div className="flex flex-col items-center">
                  {cameraActive ? (
                    <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden mb-4">
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                      <div className="absolute inset-0 border-2 border-nexo-500/50 rounded-xl">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-nexo-500 rounded-lg" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-white/5 rounded-xl flex items-center justify-center mb-4">
                      <Smartphone size={64} className="text-zinc-600" />
                    </div>
                  )}

                  <p className="text-sm text-zinc-400 mb-4 text-center">
                    {cameraActive
                      ? 'Наведите камеру на QR-код на экране входа'
                      : 'Отсканируйте QR-код с экрана входа другого устройства'}
                  </p>

                  <button
                    onClick={cameraActive ? stopCamera : startCamera}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium mb-3"
                  >
                    {cameraActive ? '⏹️ Остановить камеру' : '📷 Открыть камеру'}
                  </button>

                  {qrDataUrl && (
                    <div className="w-full bg-white/5 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-2 text-center">Или введите ключ вручную:</p>
                      <code className="block w-full bg-black/30 rounded-lg px-3 py-2 text-sm font-mono text-nexo-400 break-all text-center mb-3">
                        {authKey}
                      </code>
                      <button
                        onClick={copyKey}
                        className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copied ? 'Скопировано!' : 'Копировать ключ'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
