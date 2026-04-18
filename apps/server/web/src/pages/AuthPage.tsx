import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { Eye, EyeOff, UserPlus, LogIn, Camera, Check } from 'lucide-react';

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

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { login, register } = useAuthStore();

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('8') && cleaned.length === 1) return '+7';
    if (cleaned.startsWith('8') && cleaned.length > 1) return '+7' + cleaned.slice(1);
    if (!cleaned.startsWith('+') && cleaned.length > 0) return '+' + cleaned;
    return cleaned;
  };

  const formatPhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => setPhone(formatPhone(e.target.value));

  useEffect(() => {
    if (username.length < 3) { setUsernameStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try { const r = await api.checkUsername(username); setUsernameStatus(r.available ? 'available' : 'taken'); }
      catch { setUsernameStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    if (!/^\+\d{7,15}$/.test(phone)) { setPhoneStatus('idle'); return; }
    setPhoneStatus('checking');
    const t = setTimeout(async () => {
      try { const r = await api.checkPhone(phone); setPhoneStatus(r.available ? 'available' : 'taken'); }
      catch { setPhoneStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [phone]);

  const handleLogin = async () => {
    setError('');
    if (!phone.trim()) { setError('Введите логин или номер телефона'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setIsSubmitting(true);
    try {
      await login(phone, password);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка'); }
    finally { setIsSubmitting(false); }
  };

  const handleRegister = async () => {
    setError('');
    if (!displayName.trim()) { setError('Введите имя'); return; }
    if (!/^\+\d{7,15}$/.test(phone)) { setError('Введите корректный номер'); return; }
    if (!username || usernameStatus === 'taken') { setError('Выберите свободный username'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
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
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка'); }
    finally { setIsSubmitting(false); }
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
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-nexo-600/30 to-purple-600/30 blur-[120px] animate-pulse" />
        </div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-nexo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="glass-strong rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <motion.img src="/logo.png" alt="Nexo" className="w-20 h-20 rounded-2xl shadow-lg shadow-nexo-500/30 object-cover"
              initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }} />
            <h1 className="text-2xl font-bold gradient-text mt-4">Nexo</h1>
            <p className="text-zinc-500 text-sm mt-1">Современный мессенджер</p>
          </div>

          {/* Переключатель */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                isLogin ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'
              }`}>
              <LogIn size={16} /> Войти
            </button>
            <button onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                !isLogin ? 'bg-gradient-to-r from-nexo-500 to-purple-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'
              }`}>
              <UserPlus size={16} /> Регистрация
            </button>
          </div>

          {/* Ошибка */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</motion.div>
            )}
          </AnimatePresence>

          {/* ═══ ВХОД ═══ */}
          {isLogin && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                  <AtSignSvg /> Логин или телефон
                </label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="username или +79991234567" 
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all" 
                />
                <p className="text-xs text-zinc-500 mt-1.5">Введите username или номер телефона</p>
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

          {/* ═══ РЕГИСТРАЦИЯ ═══ */}
          {!isLogin && (
            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><AtSignSvg /> Имя <span className="text-red-400">*</span></label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ваше имя" required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all" />
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

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><CalendarSvg /> Дата рождения</label>
                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                  max={new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><FileTextSvg /> О себе</label>
                <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Пара слов о вас..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/25 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2"><ImageSvg /> Аватарка</label>
                <div className="flex items-center gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={selectAvatar}
                    className={`relative w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${
                      avatarPreview ? 'border-nexo-500/50' : 'border-white/20 hover:border-white/40'
                    }`}>
                    {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : <Camera size={16} className="text-zinc-500" />}
                  </motion.button>
                  {avatarPreview && <button onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className="text-sm text-red-400 hover:text-red-300">Убрать</button>}
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={handleRegister} disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-nexo-500/25">
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={18} /> Создать аккаунт</>}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
