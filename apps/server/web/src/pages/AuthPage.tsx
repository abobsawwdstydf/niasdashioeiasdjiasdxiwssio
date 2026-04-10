import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useLang } from '../lib/i18n';
import { api } from '../lib/api';
import { requestPushPermission } from '../lib/webPush';
import { Eye, EyeOff, ArrowRight, UserPlus, LogIn, Check, X, Phone, Send, Volume2, MessageCircle, Clock, Copy, Mail } from 'lucide-react';

type AuthStep =
  | 'form' // Основная форма (вход/регистрация)
  | 'phone-verify' // Подтверждение номера (Telegram/звонок)
  | 'email-verify' // Подтверждение email
  | 'login-2fa'; // 2FA при входе

type VerificationMethod = 'telegram' | 'call';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('form');

  // Форма
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Верификация номера
  const [verifyMethod, setVerifyMethod] = useState<VerificationMethod>('telegram');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLink, setVerifyLink] = useState('');
  const [verifyTimer, setVerifyTimer] = useState(300); // 5 минут в секундах
  const [verifyToken, setVerifyToken] = useState('');
  const [devCode, setDevCode] = useState('');

  // Верификация email
  const [emailCode, setEmailCode] = useState('');
  const [emailTimer, setEmailTimer] = useState(300);

  // 2FA при входе
  const [twoFAMethod, setTwoFAMethod] = useState<string>('telegram');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFATimer, setTwoFATimer] = useState(300);
  const [twoFAPhone, setTwoFAPhone] = useState('');
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);

  const { loginByPhone, loginByPhone2FA, registerByPhone } = useAuthStore();
  const { t } = useLang();

  // Форматирование телефона при вводе
  const formatPhone = (value: string) => {
    // Оставляем только + и цифры
    const cleaned = value.replace(/[^\d+]/g, '');
    // Если начинается с 8, заменяем на +7
    if (cleaned.startsWith('8') && cleaned.length === 1) return '+7';
    if (cleaned.startsWith('8') && cleaned.length > 1) return '+7' + cleaned.slice(1);
    if (!cleaned.startsWith('+') && cleaned.length > 0) return '+' + cleaned;
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  // Таймеры
  useEffect(() => {
    if ((step === 'phone-verify' && verifyTimer > 0) ||
        (step === 'email-verify' && emailTimer > 0) ||
        (step === 'login-2fa' && twoFATimer > 0)) {
      const timer = setInterval(() => {
        if (step === 'phone-verify') setVerifyTimer(t => t - 1);
        else if (step === 'email-verify') setEmailTimer(t => t - 1);
        else if (step === 'login-2fa') setTwoFATimer(t => t - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, verifyTimer, emailTimer, twoFATimer]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Проверка username
  const checkUsername = async (value: string) => {
    if (!value || value.length < 3) { setUsernameStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    try {
      const users = await api.searchUsers(value);
      const isTaken = users.some(u => u.username.toLowerCase() === value.toLowerCase());
      setUsernameStatus(isTaken ? 'taken' : 'available');
    } catch { setUsernameStatus('idle'); }
  };

  // ─── Вход ───
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await loginByPhone(phone, password);
      if (result.require2FA) {
        setTwoFAPhone(phone);
        setAvailableMethods(result.availableMethods || []);
        setTwoFAMethod(result.availableMethods?.[0] || 'telegram');
        setStep('login-2fa');
        setTwoFATimer(300);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Регистрация: Шаг 1 — проверка данных ───
  const handleRegisterStart = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Валидация телефона
      if (!/^\+\d{7,15}$/.test(phone)) {
        setError('Введите номер в международном формате (например, +79991234567)');
        setIsSubmitting(false);
        return;
      }

      // Проверка данных и получение права на регистрацию
      await api.registerStart({
        username,
        displayName: displayName || username,
        phone,
        email: email || undefined,
        password,
        bio: bio || undefined,
        birthday: birthday || undefined,
      });

      // Переходим к подтверждению номера
      setStep('phone-verify');
      setVerifyTimer(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Регистрация: Шаг 2 — запрос кода ───
  const requestVerifyCode = async (method: VerificationMethod) => {
    setError('');
    setVerifyMethod(method);
    try {
      const result = await api.registerRequestCode(phone, method);
      if (result.link) setVerifyLink(result.link);
      if (result.token) setVerifyToken(result.token);
      if (result.devCode) setDevCode(result.devCode);
      setVerifyTimer(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  // ─── Регистрация: Шаг 3 — завершение с кодом ───
  const handleRegisterComplete = async () => {
    if (verifyCode.length < 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await registerByPhone({
        phone,
        code: verifyCode,
        username,
        displayName: displayName || username,
        password,
        email: email || undefined,
        bio: bio || undefined,
        birthday: birthday || undefined,
      });

      // Если email указан — переходим к подтверждению
      if (email) {
        setStep('email-verify');
        setEmailTimer(300);
      } else {
        requestPushPermission();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Email верификация ───
  const handleEmailVerify = async () => {
    if (emailCode.length < 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await api.verifyEmail(email, emailCode);
      requestPushPermission();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const result = await api.resendEmailCode(email);
      if (result.devCode) setDevCode(result.devCode);
      setEmailTimer(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  // ─── 2FA при входе ───
  const request2FACode = async (method: string) => {
    setTwoFAMethod(method);
    try {
      const result = await api.loginRequest2FA(twoFAPhone, method as 'telegram' | 'call' | 'email');
      if (result.devCode) setDevCode(result.devCode);
      setTwoFATimer(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handle2FAComplete = async () => {
    if (twoFACode.length < 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await loginByPhone2FA(twoFAPhone, twoFACode);
      requestPushPermission();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Сброс формы ───
  const resetForm = () => {
    setStep('form');
    setError('');
    setVerifyCode('');
    setEmailCode('');
    setTwoFACode('');
    setDevCode('');
    setVerifyLink('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex items-center justify-center relative overflow-hidden bg-surface"
    >
      {/* Фон */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-nexo-600/30 to-purple-600/30 blur-[120px] animate-pulse" />
        </div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-nexo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Карточка */}
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-nexo-500/5">
          {/* Логотип */}
          <div className="flex flex-col items-center mb-6">
            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
            >
              <img src="/logo.png" alt="Nexo" className="w-20 h-20 rounded-2xl shadow-lg shadow-nexo-500/30 object-cover" />
            </motion.div>
            <h1 className="text-2xl font-bold gradient-text mt-4">Nexo</h1>
            <p className="text-zinc-500 text-sm mt-1">{t('modernMessengerShort')}</p>
          </div>

          {/* Переключатель */}
          {step === 'form' && (
            <div className="flex rounded-xl bg-white/5 p-1 mb-6">
              <button
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  isLogin ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white shadow-lg shadow-nexo-500/25' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <LogIn size={16} />{t('login')}
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  !isLogin ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white shadow-lg shadow-nexo-500/25' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus size={16} />{t('register')}
              </button>
            </div>
          )}

          {/* Ошибка */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dev code */}
          {devCode && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              🔑 Код для разработки: <code className="font-mono font-bold">{devCode}</code>
            </div>
          )}

          {/* ═══ ФОРМА ВХОДА ═══ */}
          {step === 'form' && isLogin && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">📱 Номер телефона</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="+79991234567"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">🔒 Пароль</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-12"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={isSubmitting}
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium shadow-lg shadow-nexo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={18} />{t('loginBtn')}</>}
              </motion.button>
            </form>
          )}

          {/* ═══ ФОРМА РЕГИСТРАЦИИ ═══ */}
          {step === 'form' && !isLogin && (
            <form onSubmit={handleRegisterStart} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">📱 Номер телефона <span className="text-red-400">*</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="+79991234567"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                  required
                  autoFocus
                />
                <p className="text-[10px] text-zinc-600 mt-1">Обязательное поле — используется для входа</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Username <span className="text-zinc-600">{t('latinOnly')}</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); checkUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); }}
                    placeholder="username"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-10"
                    required
                    autoComplete="off"
                  />
                  {username.length >= 3 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'checking' && <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />}
                      {usernameStatus === 'available' && <Check size={16} className="text-emerald-400" />}
                      {usernameStatus === 'taken' && <X size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
                {usernameStatus === 'available' && <p className="text-xs text-emerald-400 mt-1">✓ Username свободен</p>}
                {usernameStatus === 'taken' && <p className="text-xs text-red-400 mt-1">✗ Username занят</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">{t('displayNameLabel')}</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('displayNamePlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">📧 Email <span className="text-zinc-600">(необязательно)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">🔒 Пароль</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-12"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Дата рождения</label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  max={new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">{t('aboutMe')}</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('bioPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={isSubmitting}
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium shadow-lg shadow-nexo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={18} />{t('createAccount')}</>}
              </motion.button>
            </form>
          )}

          {/* ═══ ПОДТВЕРЖДЕНИЕ НОМЕРА ═══ */}
          {step === 'phone-verify' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white text-center">Подтвердите номер</h2>
              <p className="text-sm text-zinc-400 text-center">{phone}</p>

              {!verifyLink && verifyTimer === 300 && (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400 text-center">Выберите способ получения кода:</p>
                  <button
                    onClick={() => requestVerifyCode('telegram')}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                  >
                    <MessageCircle size={18} />Telegram-бот
                  </button>
                  <button
                    onClick={() => requestVerifyCode('call')}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                  >
                    <Volume2 size={18} />Звонок на номер
                  </button>
                </div>
              )}

              {verifyLink && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-zinc-400 mb-2">1. Перейдите в бота и получите код:</p>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={verifyLink}
                      readOnly
                      className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-xs text-zinc-300 font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(verifyLink)}
                      className="p-2 rounded-lg bg-nexo-500/20 text-nexo-400 hover:bg-nexo-500/30"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              {(verifyLink || devCode) && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">2. Введите код:</label>
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <Clock size={14} />
                    <span className="text-sm font-mono">{formatTimer(verifyTimer)}</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleRegisterComplete}
                    disabled={isSubmitting || verifyCode.length < 6 || verifyTimer <= 0}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={18} />Подтвердить</>}
                  </motion.button>

                  {verifyTimer <= 0 && (
                    <button
                      onClick={() => { setVerifyLink(''); setVerifyCode(''); }}
                      className="w-full py-2 px-4 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-sm"
                    >
                      Получить новый код
                    </button>
                  )}
                </div>
              )}

              <button onClick={resetForm} className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300">
                ← Назад к регистрации
              </button>
            </div>
          )}

          {/* ═══ ПОДТВЕРЖДЕНИЕ EMAIL ═══ */}
          {step === 'email-verify' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="w-14 h-14 rounded-full bg-nexo-500/20 flex items-center justify-center mb-3">
                  <Mail size={24} className="text-nexo-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Подтвердите email</h2>
                <p className="text-sm text-zinc-400">{email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Код из письма:</label>
                <input
                  type="text"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-zinc-500">
                <Clock size={14} />
                <span className="text-sm font-mono">{formatTimer(emailTimer)}</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleEmailVerify}
                disabled={isSubmitting || emailCode.length < 6 || emailTimer <= 0}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={18} />Подтвердить</>}
              </motion.button>

              {emailTimer <= 0 && (
                <button
                  onClick={handleResendEmail}
                  className="w-full py-2 px-4 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-sm"
                >
                  Отправить код снова
                </button>
              )}
            </div>
          )}

          {/* ═══ 2FA ПРИ ВХОДЕ ═══ */}
          {step === 'login-2fa' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white text-center">Подтверждение входа</h2>
              <p className="text-sm text-zinc-400 text-center">Выберите способ получения кода:</p>

              {!twoFACode && availableMethods.length > 0 && (
                <div className="space-y-2">
                  {availableMethods.includes('telegram') && (
                    <button
                      onClick={() => request2FACode('telegram')}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                    >
                      <MessageCircle size={18} />Telegram-бот
                    </button>
                  )}
                  {availableMethods.includes('email') && (
                    <button
                      onClick={() => request2FACode('email')}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                    >
                      <Mail size={18} />Email
                    </button>
                  )}
                  {availableMethods.includes('call') && (
                    <button
                      onClick={() => request2FACode('call')}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                    >
                      <Volume2 size={18} />Звонок
                    </button>
                  )}
                </div>
              )}

              {twoFACode !== '' || devCode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Код подтверждения:</label>
                    <input
                      type="text"
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <Clock size={14} />
                    <span className="text-sm font-mono">{formatTimer(twoFATimer)}</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handle2FAComplete}
                    disabled={isSubmitting || twoFACode.length < 6 || twoFATimer <= 0}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={18} />Войти</>}
                  </motion.button>

                  {twoFATimer <= 0 && (
                    <button
                      onClick={() => { setTwoFACode(''); request2FACode(twoFAMethod); }}
                      className="w-full py-2 px-4 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-sm"
                    >
                      Получить новый код
                    </button>
                  )}
                </div>
              ) : null}

              <button onClick={resetForm} className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300">
                ← Назад ко входу
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
