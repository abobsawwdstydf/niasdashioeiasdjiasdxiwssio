import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { requestPushPermission } from '../lib/webPush';
import { Eye, EyeOff, ArrowLeft, ArrowRight, UserPlus, LogIn, Camera, Check } from 'lucide-react';

// ─── SVG иконки вместо эмодзи ───
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0112 0v1" />
    </svg>
  );
}

function AtSignIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 12a4 4 0 00-8 0c0 2.5 2 4 4 4s4-1.5 4-4" />
      <path d="M16 8V6a4 4 0 00-8 0" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  );
}

type AuthStep = 'choice' | 'login' | 'reg-1' | 'reg-2' | 'reg-3' | 'reg-4';

export default function AuthPage() {
  const [step, setStep] = useState<AuthStep>('choice');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Поля формы
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Статусы проверки
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { login, register } = useAuthStore();

  // Форматирование телефона
  const formatPhone = (value: string) => {
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('8') && cleaned.length === 1) return '+7';
    if (cleaned.startsWith('8') && cleaned.length > 1) return '+7' + cleaned.slice(1);
    if (!cleaned.startsWith('+') && cleaned.length > 0) return '+' + cleaned;
    return cleaned;
  };

  // Проверка username
  useEffect(() => {
    if (username.length < 3) { setUsernameStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setUsernameStatus('idle'); return; }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkUsername(username);
        setUsernameStatus(result.available ? 'available' : 'taken');
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
        const result = await api.checkPhone(phone);
        setPhoneStatus(result.available ? 'available' : 'taken');
      } catch { setPhoneStatus('idle'); }
    }, 500);

    return () => clearTimeout(timer);
  }, [phone]);

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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!username || !phone || !password) { setError('Заполните обязательные поля'); return; }

    setIsSubmitting(true);
    try {
      await register({
        username,
        displayName: displayName || username,
        phone,
        password,
        bio: bio || undefined,
        birthday: birthday || undefined,
        avatar: avatarFile || undefined,
      });
      setStep('reg-4');
      requestPushPermission();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectAvatar = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Аватарка не более 5MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  const goBack = () => {
    const steps: AuthStep[] = ['choice', 'login', 'reg-1', 'reg-2', 'reg-3', 'reg-4'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const formatPhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  // Шаги индикатора
  const stepsList = [
    { key: 'reg-1', label: 'Основное' },
    { key: 'reg-2', label: 'Детали' },
    { key: 'reg-3', label: 'Аватар' },
    { key: 'reg-4', label: 'Готово' },
  ];
  const currentStepIdx = stepsList.findIndex(s => s.key === step);

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
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        <div className="glass-strong rounded-3xl p-8 shadow-2xl">

          {/* Логотип */}
          <div className="flex flex-col items-center mb-6">
            <motion.img
              src="/logo.png"
              alt="Nexo"
              className="w-20 h-20 rounded-2xl shadow-lg shadow-nexo-500/30 object-cover"
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
            />
            <h1 className="text-2xl font-bold gradient-text mt-4">Nexo</h1>
            <p className="text-zinc-500 text-sm mt-1">Современный мессенджер</p>
          </div>

          {/* Индикатор шагов */}
          {currentStepIdx >= 0 && (
            <div className="flex items-center gap-1 mb-6">
              {stepsList.map((s, i) => (
                <div key={s.key} className="flex-1 flex items-center gap-1">
                  <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= currentStepIdx ? 'bg-nexo-500' : 'bg-white/10'
                  }`} />
                  {i < stepsList.length - 1 && <div className="w-1" />}
                </div>
              ))}
            </div>
          )}

          {/* Кнопка назад */}
          {step !== 'choice' && step !== 'reg-4' && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-4 transition-colors"
            >
              <ArrowLeft size={14} /> Назад
            </button>
          )}

          {/* Ошибка */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ ВЫБОР ═══ */}
          {step === 'choice' && (
            <div className="space-y-3">
              <button
                onClick={() => setStep('login')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-nexo-500/25 transition-all active:scale-[0.98]"
              >
                <LogIn size={20} /> Войти
              </button>
              <button
                onClick={() => setStep('reg-1')}
                className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-medium flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <UserPlus size={20} /> Создать аккаунт
              </button>
            </div>
          )}

          {/* ═══ ВХОД ═══ */}
          {step === 'login' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Вход</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <PhoneIcon /> Номер телефона
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={formatPhoneInput}
                  placeholder="+79991234567"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <LockIcon /> Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-12"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-nexo-500/25"
              >
                {isSubmitting
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><LogIn size={18} /> Войти</>
                }
              </motion.button>
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: ШАГ 1 — Основное ═══ */}
          {step === 'reg-1' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Основное</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <PhoneIcon /> Телефон <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={formatPhoneInput}
                  placeholder="+79991234567"
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-zinc-600 focus:ring-1 transition-all ${
                    phoneStatus === 'taken' ? 'border-red-500/50 focus:border-red-500/50' :
                    phoneStatus === 'available' ? 'border-emerald-500/50 focus:border-emerald-500/50' :
                    'border-white/10 focus:border-nexo-500/50'
                  } focus:ring-nexo-500/25`}
                  autoFocus
                />
                {phoneStatus === 'available' && <p className="text-xs text-emerald-400 mt-1">Номер свободен</p>}
                {phoneStatus === 'taken' && <p className="text-xs text-red-400 mt-1">Номер уже зарегистрирован</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <AtSignIcon /> Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="username"
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-zinc-600 focus:ring-1 transition-all ${
                    usernameStatus === 'taken' ? 'border-red-500/50' :
                    usernameStatus === 'available' ? 'border-emerald-500/50' :
                    'border-white/10'
                  } focus:border-nexo-500/50 focus:ring-nexo-500/25`}
                />
                {usernameStatus === 'available' && <p className="text-xs text-emerald-400 mt-1">Свободен</p>}
                {usernameStatus === 'taken' && <p className="text-xs text-red-400 mt-1">Занят</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <LockIcon /> Пароль <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all pr-12"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!/^\+\d{7,15}$/.test(phone)) { setError('Введите корректный номер'); return; }
                  if (!username || usernameStatus === 'taken') { setError('Выберите свободный username'); return; }
                  if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
                  setError('');
                  setStep('reg-2');
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2"
              >
                Далее <ArrowRight size={18} />
              </motion.button>
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: ШАГ 2 — Детали ═══ */}
          {step === 'reg-2' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Подробнее</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <UserIcon /> Имя
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ваше имя"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <CalendarIcon /> Дата рождения
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                  max={new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <FileTextIcon /> О себе
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Пара слов о вас..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/5 text-zinc-400 hover:text-white font-medium flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} /> Назад
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('reg-3')}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2"
                >
                  Далее <ArrowRight size={18} />
                </motion.button>
              </div>
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: ШАГ 3 — Аватарка ═══ */}
          {step === 'reg-3' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Аватарка</h2>
              <p className="text-sm text-zinc-500 text-center">Необязательно — можно пропустить</p>

              <div className="flex flex-col items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={selectAvatar}
                  className={`relative w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                    avatarPreview
                      ? 'border-nexo-500/50 hover:border-nexo-500'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-zinc-500">
                      <ImageIcon />
                      <span className="text-xs mt-1">Выбрать</span>
                    </div>
                  )}
                  {/* Overlay camera icon */}
                  <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-nexo-500 flex items-center justify-center shadow-lg">
                    <Camera size={14} className="text-white" />
                  </div>
                </motion.button>

                {avatarPreview && (
                  <button
                    onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Убрать аватарку
                  </button>
                )}

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/5 text-zinc-400 hover:text-white font-medium flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} /> Назад
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRegister}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Check size={18} /> Готово</>
                  }
                </motion.button>
              </div>
            </div>
          )}

          {/* ═══ РЕГИСТРАЦИЯ: ШАГ 4 — Готово ═══ */}
          {step === 'reg-4' && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-nexo-500/30"
              >
                <Check size={36} className="text-white" />
              </motion.div>
              <h2 className="text-xl font-bold text-white">Добро пожаловать!</h2>
              <p className="text-zinc-400 text-center">Аккаунт создан. Мессенджер загрузится автоматически...</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
