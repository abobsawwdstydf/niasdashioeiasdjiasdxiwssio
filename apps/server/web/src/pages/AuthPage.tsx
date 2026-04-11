import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { requestPushPermission } from '../lib/webPush';
import { Eye, EyeOff, ArrowLeft, ArrowRight, UserPlus, LogIn, Camera, Check, Copy, Clock } from 'lucide-react';

// ─── SVG иконки ───
function PhoneSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LockSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function AtSignSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 12a4 4 0 00-8 0c0 2.5 2 4 4 4s4-1.5 4-4" />
      <path d="M16 8V6a4 4 0 00-8 0" />
    </svg>
  );
}

function CalendarSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function FileTextSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ImageSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  );
}

function TelegramSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

type AuthStep = 'choice' | 'login' | 'reg-1' | 'reg-verify' | 'reg-2' | 'reg-3' | 'reg-4';

export default function AuthPage() {
  const [step, setStep] = useState<AuthStep>('choice');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Поля
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Верификация
  const [regToken, setRegToken] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLink, setVerifyLink] = useState('');
  const [verifyTimer, setVerifyTimer] = useState(300);
  const [devCode, setDevCode] = useState('');

  // Статусы
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { login, registerStart, registerUploadAvatar, registerRequestCode, registerComplete } = useAuthStore();

  // Форматирование телефона
  const formatPhone = (value: string) => {
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('8') && cleaned.length === 1) return '+7';
    if (cleaned.startsWith('8') && cleaned.length > 1) return '+7' + cleaned.slice(1);
    if (!cleaned.startsWith('+') && cleaned.length > 0) return '+' + cleaned;
    return cleaned;
  };

  const formatPhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => setPhone(formatPhone(e.target.value));

  // Проверка username
  useEffect(() => {
    if (username.length < 3) { setUsernameStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const r = await api.checkUsername(username);
        setUsernameStatus(r.available ? 'available' : 'taken');
      } catch { setUsernameStatus('idle'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // Проверка телефона
  useEffect(() => {
    if (!/^\+\d{7,15}$/.test(phone)) { setPhoneStatus('idle'); return; }
    setPhoneStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const r = await api.checkPhone(phone);
        setPhoneStatus(r.available ? 'available' : 'taken');
      } catch { setPhoneStatus('idle'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [phone]);

  // Таймер верификации
  useEffect(() => {
    if (step !== 'reg-verify' || verifyTimer <= 0) return;
    const t = setInterval(() => setVerifyTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, verifyTimer]);

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ─── Вход ───
  const handleLogin = async () => {
    setError('');
    if (!/^\+\d{7,15}$/.test(phone)) { setError('Введите корректный номер'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setIsSubmitting(true);
    try {
      await login(phone, password);
      requestPushPermission();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setIsSubmitting(false); }
  };

  // ─── Регистрация: Шаг 1 → начать ───
  const handleRegisterStart = async () => {
    setError('');
    if (!/^\+\d{7,15}$/.test(phone)) { setError('Введите корректный номер'); return; }
    if (!username || usernameStatus === 'taken') { setError('Выберите свободный username'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }

    setIsSubmitting(true);
    try {
      const token = await registerStart({
        username,
        displayName: displayName || username,
        phone,
        password,
        bio: bio || undefined,
        birthday: birthday || undefined,
      });
      setRegToken(token);

      // Если есть аватарка — загрузить
      if (avatarFile) {
        try { await registerUploadAvatar(token, avatarFile); } catch { /* ignore */ }
      }

      setStep('reg-verify');
      setVerifyTimer(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setIsSubmitting(false); }
  };

  // ─── Регистрация: Запрос кода ───
  const handleRequestCode = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const result = await registerRequestCode(regToken);
      setVerifyLink(result.link);
      if (result.devCode) setDevCode(result.devCode);
      setVerifyTimer(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setIsSubmitting(false); }
  };

  // ─── Регистрация: Завершение с кодом ───
  const handleRegisterComplete = async () => {
    setError('');
    if (verifyCode.length !== 6) { setError('Введите 6-значный код'); return; }
    if (verifyTimer <= 0) { setError('Код истёк. Запросите новый.'); return; }

    setIsSubmitting(true);
    try {
      await registerComplete(regToken, verifyCode);
      setStep('reg-4');
      requestPushPermission();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setIsSubmitting(false); }
  };

  const goBack = () => {
    const steps: AuthStep[] = ['choice', 'login', 'reg-1', 'reg-verify', 'reg-2', 'reg-3', 'reg-4'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const selectAvatar = () => avatarInputRef.current?.click();
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { setError('Аватарка не более 5MB'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="h-full flex items-center justify-center relative overflow-hidden bg-surface">
      {/* Фон */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-nexo-600/30 to-purple-600/30 blur-[120px] animate-pulse" />
        </div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-nexo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Карточка */}
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="glass-strong rounded-3xl p-8 shadow-2xl">

          {/* Логотип */}
          <div className="flex flex-col items-center mb-6">
            <motion.img src="/logo.png" alt="Nexo" className="w-20 h-20 rounded-2xl shadow-lg shadow-nexo-500/30 object-cover"
              initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }} />
            <h1 className="text-2xl font-bold gradient-text mt-4">Nexo</h1>
            <p className="text-zinc-500 text-sm mt-1">Современный мессенджер</p>
          </div>

          {/* Ошибка */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</motion.div>
            )}
          </AnimatePresence>

          {/* Dev код */}
          {devCode && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              Код: <code className="font-mono font-bold">{devCode}</code>
            </div>
          )}

          {/* Кнопка назад */}
          {step !== 'choice' && step !== 'reg-4' && (
            <button onClick={goBack} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-4 transition-colors">
              <ArrowLeft size={14} /> Назад
            </button>
          )}

          {/* ═══ ВЫБОР ═══ */}
          {step === 'choice' && (
            <div className="space-y-3">
              <button onClick={() => setStep('login')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-nexo-500/25 transition-all active:scale-[0.98]">
                <LogIn size={20} /> Войти
              </button>
              <button onClick={() => setStep('reg-1')}
                className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-medium flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-[0.98]">
                <UserPlus size={20} /> Создать аккаунт
              </button>
            </div>
          )}

          {/* ═══ ВХОД ═══ */}
          {step === 'login' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Вход</h2>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><PhoneSvg /> Телефон</label>
                <input type="tel" value={phone} onChange={formatPhoneInput} placeholder="+79991234567" autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><LockSvg /> Пароль</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль" onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={handleLogin} disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-nexo-500/25">
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={18} /> Войти</>}
              </motion.button>
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: Шаг 1 — Основное ═══ */}
          {step === 'reg-1' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Создание аккаунта</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><PhoneSvg /> Телефон <span className="text-red-400">*</span></label>
                <input type="tel" value={phone} onChange={formatPhoneInput} placeholder="+79991234567" autoFocus
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-zinc-600 focus:ring-1 transition-all ${
                    phoneStatus === 'taken' ? 'border-red-500/50' : phoneStatus === 'available' ? 'border-emerald-500/50' : 'border-white/10'
                  } focus:border-nexo-500/50 focus:ring-nexo-500/25`} />
                {phoneStatus === 'available' && <p className="text-xs text-emerald-400 mt-1">Свободен</p>}
                {phoneStatus === 'taken' && <p className="text-xs text-red-400 mt-1">Уже зарегистрирован</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><AtSignSvg /> Username <span className="text-red-400">*</span></label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="username"
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-zinc-600 focus:ring-1 transition-all ${
                    usernameStatus === 'taken' ? 'border-red-500/50' : usernameStatus === 'available' ? 'border-emerald-500/50' : 'border-white/10'
                  } focus:border-nexo-500/50 focus:ring-nexo-500/25`} />
                {usernameStatus === 'available' && <p className="text-xs text-emerald-400 mt-1">Свободен</p>}
                {usernameStatus === 'taken' && <p className="text-xs text-red-400 mt-1">Занят</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><LockSvg /> Пароль <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов" minLength={6}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Аватарка */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><ImageSvg /> Аватарка <span className="text-zinc-600">(необязательно)</span></label>
                <div className="flex items-center gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={selectAvatar}
                    className={`relative w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${
                      avatarPreview ? 'border-nexo-500/50' : 'border-white/20 hover:border-white/40'
                    }`}>
                    {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                      : <Camera size={16} className="text-zinc-500" />}
                  </motion.button>
                  {avatarPreview && (
                    <button onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className="text-sm text-red-400 hover:text-red-300">Убрать</button>
                  )}
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={handleRegisterStart} disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight size={18} /> Далее</>}
              </motion.button>
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: Подтверждение через Telegram ═══ */}
          {step === 'reg-verify' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[#229ED9]/20 flex items-center justify-center">
                  <TelegramSvg />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Подтвердите номер</h2>
                  <p className="text-xs text-zinc-500">{phone}</p>
                </div>
              </div>

              {!verifyLink && (
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleRequestCode} disabled={isSubmitting}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-[#229ED9] to-blue-600 text-white font-medium flex items-center justify-center gap-3 disabled:opacity-50">
                  <TelegramSvg /> Получить код через Telegram
                </motion.button>
              )}

              {verifyLink && (
                <>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-zinc-400 mb-2">Перейдите в бота:</p>
                    <div className="flex items-center gap-2">
                      <input type="text" value={verifyLink} readOnly
                        className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-xs text-zinc-300 font-mono" />
                      <button onClick={() => copyToClipboard(verifyLink)} className="p-2 rounded-lg bg-nexo-500/20 text-nexo-400 hover:bg-nexo-500/30">
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Введите код из бота:</label>
                    <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all" />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <Clock size={14} />
                    <span className="text-sm font-mono">{formatTimer(verifyTimer)}</span>
                  </div>

                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleRegisterComplete} disabled={isSubmitting || verifyCode.length < 6 || verifyTimer <= 0}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={18} /> Подтвердить</>}
                  </motion.button>

                  {verifyTimer <= 0 && (
                    <button onClick={() => { setVerifyLink(''); setVerifyCode(''); }} className="w-full py-2 text-sm text-nexo-400 hover:text-nexo-300">
                      Получить новый код
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: Детали ═══ — пропущен, т.к. всё введено на шаге 1 */}

          {/* ═══ РЕГИСТРАЦИЯ: Готово ═══ */}
          {step === 'reg-4' && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-nexo-500/30">
                <Check size={36} className="text-white" />
              </motion.div>
              <h2 className="text-xl font-bold text-white">Добро пожаловать!</h2>
              <p className="text-zinc-400 text-center">Аккаунт создан. Мессенджер загрузится...</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
