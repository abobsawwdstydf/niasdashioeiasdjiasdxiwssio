import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Users,
  Settings,
  Languages,
  Info,
  LogOut,
  ArrowLeft,
  Camera,
  Edit3,
  Check,
  Loader2,
  Trash2,
  Calendar,
  AtSign,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Palette,
  UserPlus,
  UserMinus,
  UserCheck,
  Clock,
  Search,
  Shield,
  Eye,
  Phone,
  Mic,
  Bell,
  Volume2,
  Minimize2,
  Maximize2,
  Monitor,
  Crown,
  BarChart3,
  Bot,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useLang } from '../lib/i18n';
import { useCallSettingsStore } from '../stores/callSettingsStore';
import { useUIThemeStore } from '../stores/uiThemeStore';
import DatePicker from './DatePicker';
import DevicesTab from './DevicesTab';
import LegalPage from './LegalPage';
import PremiumPage from '../pages/PremiumPage';
import StatisticsPage from '../pages/StatisticsPage';
import BotsPage from '../pages/BotsPage';
import ThemeSettings from './ThemeSettings';
import type { User as UserType, UserPresence, FriendRequest, FriendWithId } from '../lib/types';

type SideView = 'main' | 'profile' | 'settings' | 'about' | 'friends' | 'premium' | 'statistics' | 'bots';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { user, updateUser, logout } = useAuthStore();
  const { clearStore } = useChatStore();
  const [notificationSettings, setNotificationSettings] = useState<{
    notifyAll: boolean;
    notifyMessages: boolean;
    notifyCalls: boolean;
    notifyFriends: boolean;
  }>({
    notifyAll: true,
    notifyMessages: true,
    notifyCalls: true,
    notifyFriends: true,
  });
  const callSettings = useCallSettingsStore();

  useEffect(() => {
    // Load notification settings only if user is logged in
    if (user) {
      api.getNotificationSettings().then((settings) => {
        if (settings) setNotificationSettings(settings);
      }).catch(() => {
        // Silent fail - keep default values
      });
    }
  }, [user]);

  const updateNotificationSetting = async (key: 'notifyAll' | 'notifyMessages' | 'notifyCalls' | 'notifyFriends', value: boolean) => {
    try {
      const newSettings = { ...notificationSettings, [key]: value };
      if (key === 'notifyAll') {
        newSettings.notifyMessages = value;
        newSettings.notifyCalls = value;
        newSettings.notifyFriends = value;
      }
      await api.updateNotificationSettings(newSettings);
      setNotificationSettings(newSettings);
    } catch (e) {
      console.error('Failed to update notification settings:', e);
    }
  };
  const uiTheme = useUIThemeStore();
  const { t, lang, setLang } = useLang();

  const [view, setView] = useState<SideView>('main');
  const [prevView, setPrevView] = useState<SideView>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<UserPresence[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | null>(null);

  const changeView = (newView: SideView) => {
    setPrevView(view);
    setView(newView);
  };

  // Load friends
  useEffect(() => {
    if (view === 'friends') {
      loadFriends();
    }
  }, [view]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const [friendsData, requests] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsData);
      setFriendRequests(requests);
    } catch (e) {
      console.error(e);
    } finally {
      setFriendsLoading(false);
    }
  };

  // Search friends
  useEffect(() => {
    if (!friendSearch.trim() || friendSearch.trim().length < 3) {
      setFriendSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setFriendSearchLoading(true);
      try {
        const raw = friendSearch.trim();
        const q = raw.startsWith('@') ? raw.slice(1) : raw;
        const results = await api.searchUsers(q);
        setFriendSearchResults(results.filter((u) => u.id !== user?.id));
      } catch (e) {
        console.error(e);
      } finally {
        setFriendSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [friendSearch, user?.id]);

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptFriend = async (friendshipId: string) => {
    try {
      await api.acceptFriendRequest(friendshipId);
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    try {
      await api.removeFriend(friendshipId);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      await api.declineFriendRequest(friendshipId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    clearStore();
    logout();
    onClose();
  };

  // Profile editing
  useEffect(() => {
    if (view === 'profile' && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setBirthday(user.birthday || '');
    }
  }, [view, user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.updateProfile({ displayName, bio, birthday });
      updateUser({ displayName, bio, birthday });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const updatedUser = await api.uploadAvatar(file);
      updateUser({ avatar: updatedUser.avatar });
    } catch (e) {
      console.error(e);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const updatedUser = await api.removeAvatar();
      updateUser({ avatar: updatedUser.avatar });
    } catch (e) {
      console.error(e);
    }
  };

  const initials = (user?.displayName || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const menuItems = [
    { icon: User, label: t('myProfile'), onClick: () => changeView('profile') },
    { icon: Users, label: t('friends'), onClick: () => changeView('friends'), badge: friendRequests.length > 0 ? friendRequests.length : undefined },
    { divider: true },
    { icon: Crown, label: 'Premium', onClick: () => changeView('premium'), highlight: true },
    { icon: Bot, label: 'Боты', onClick: () => changeView('bots') },
    { icon: BarChart3, label: 'Статистика', onClick: () => changeView('statistics') },
    { icon: Settings, label: t('settings'), onClick: () => changeView('settings') },
    { divider: true },
    { icon: Info, label: t('aboutApp'), subtitle: 'Nexo Messenger v1.3', onClick: () => changeView('about') },
  ];

  // Slide direction for animations
  const slideDir = prevView === 'main' ? 1 : -1;
  const viewVariants = {
    enter: (dir: number) => ({ x: dir * 100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 100, opacity: 0 }),
  };

  // ======= MAIN VIEW =======
  const renderMain = () => (
    <motion.div key="main" className="flex flex-col h-full" initial={false} animate="center" exit="exit" variants={viewVariants} custom={-1} transition={{ duration: 0.2 }}>
      {/* Header — стеклянный стиль */}
      <div className="relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-nexo-500/30 via-purple-600/15 to-transparent pointer-events-none" />
        <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.03] pointer-events-none" />
        <div className="relative p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="relative group cursor-pointer" onClick={() => changeView('profile')}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-nexo-500/50 via-purple-500/30 to-nexo-500/50 rounded-full opacity-60 blur-sm group-hover:opacity-90 transition duration-500" />
              <div className="relative">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-[64px] h-[64px] rounded-full object-cover ring-2 ring-white/10" />
                ) : (
                  <div className="w-[64px] h-[64px] rounded-full bg-gradient-to-br from-nexo-500/20 to-purple-600/20 flex items-center justify-center ring-2 ring-white/10 relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-tr from-nexo-500/10 to-purple-500/10" />
                    <span className="relative z-10 text-xl font-bold text-white/90">{initials}</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-[#0a0a0f]" />
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
              <X size={18} />
            </button>
          </div>
          <h3 className="text-lg font-semibold text-white/90 tracking-tight leading-tight">
            {user?.displayName || user?.username}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <AtSign size={11} className="text-zinc-500" />
            <span className="text-xs text-zinc-500">{user?.username}</span>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* Menu items — стеклянный стиль */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {menuItems.map((item, i) => {
          if ('divider' in item) return <div key={i} className="my-2 mx-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />;
          const Icon = item.icon!;
          const isHighlight = 'highlight' in item && item.highlight;
          return (
            <button
              key={i}
              onClick={item.onClick}
              className={`group w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-300 active:scale-[0.98] backdrop-blur-sm border ${
                isHighlight
                  ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20 hover:border-yellow-500/30 hover:from-yellow-500/15 hover:to-orange-500/15'
                  : 'border-transparent hover:bg-white/[0.06] hover:border-white/[0.06]'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                isHighlight
                  ? 'bg-yellow-500/20 border-yellow-500/30 group-hover:bg-yellow-500/30'
                  : 'bg-white/[0.06] group-hover:bg-white/[0.1] border-white/[0.04] group-hover:border-white/[0.08]'
              }`}>
                <Icon size={17} className={`transition-all duration-300 ${
                  isHighlight ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-zinc-200'
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] font-medium transition-all duration-300 ${
                  isHighlight ? 'text-yellow-400 group-hover:text-yellow-300' : 'text-zinc-300 group-hover:text-white'
                }`}>{item.label}</p>
                {item.subtitle && <p className="text-[10px] text-zinc-600 mt-0.5">{item.subtitle}</p>}
              </div>
              {'badge' in item && item.badge ? (
                <span className="bg-nexo-500/20 text-nexo-400 text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center flex-shrink-0">
                  {item.badge}
                </span>
              ) : (
                <ChevronRight size={14} className={`transition-colors flex-shrink-0 ${
                  isHighlight ? 'text-yellow-600 group-hover:text-yellow-500' : 'text-zinc-700 group-hover:text-zinc-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Logout — стеклянный стиль */}
      <div className="px-3 pb-3 pt-1">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-3" />
        <button
          onClick={handleLogout}
          className="group w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 hover:bg-red-500/[0.08] active:scale-[0.98] border border-transparent hover:border-red-500/[0.15]"
        >
          <div className="w-9 h-9 rounded-xl bg-red-500/[0.08] group-hover:bg-red-500/[0.15] flex items-center justify-center transition-all duration-300 border border-red-500/[0.1] group-hover:border-red-500/[0.2]">
            <LogOut size={17} className="text-red-400/70 group-hover:text-red-400 transition-all duration-300" />
          </div>
          <span className="text-[13.5px] font-medium text-red-400/70 group-hover:text-red-400 transition-all duration-300">{t('logout')}</span>
        </button>
      </div>
    </motion.div>
  );

  // ======= PROFILE VIEW =======
  const renderProfile = () => (
    <motion.div key="profile" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-nexo-500/20 to-purple-500/10 pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => { changeView('main'); setIsEditing(false); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">{t('myProfile')}</h3>
        </div>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="relative z-10 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
            <Edit3 size={16} />
          </button>
        ) : (
          <button onClick={handleSaveProfile} disabled={isSaving} className="relative z-10 p-2 rounded-full text-nexo-400 hover:text-nexo-300 hover:bg-nexo-500/10 transition-all border border-nexo-500/20">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center pt-8 pb-4 px-6 relative overflow-visible">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-nexo-500/10 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent via-purple-500 to-accent rounded-full opacity-50 blur group-hover:opacity-75 transition duration-500 animate-[spin_4s_linear_infinite]" />

            <div className="relative">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-28 h-28 rounded-full object-cover ring-4 ring-surface bg-surface" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-surface to-surface-secondary flex items-center justify-center text-white font-bold text-3xl ring-4 ring-surface relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-purple-500/20" />
                  <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 drop-shadow-md">{initials}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-x-1 bottom-1 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-xs font-medium text-white transition-all transform translate-y-2 group-hover:translate-y-0"
            >
              {avatarUploading ? (
                <Loader2 size={14} className="text-nexo-400 animate-spin" />
              ) : (
                <Camera size={14} className="text-nexo-400" />
              )}
            </button>

            {user?.avatar && (
              <button
                onClick={handleRemoveAvatar}
                disabled={avatarUploading}
                className="absolute h-7 px-2.5 -top-1 left-1/2 -translate-x-1/2 bg-red-500/80 backdrop-blur-md hover:bg-red-500 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-400/30 transform -translate-y-2 group-hover:translate-y-0"
              >
                <Trash2 size={10} className="text-white" />
                <span className="text-[10px] font-semibold text-white">{t('removePhoto')}</span>
              </button>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {isEditing ? (
            <div className="mt-5 w-full max-w-[260px] relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-nexo-500 to-purple-500 rounded-2xl opacity-50 blur-sm pointer-events-none" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('enterName')}
                className="relative text-lg font-bold text-center text-white bg-black/40 border border-white/20 outline-none px-4 py-2.5 w-full rounded-2xl transition-colors focus:bg-black/60 focus:border-nexo-400 placeholder-white/30"
              />
            </div>
          ) : (
            <h3 className="mt-4 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 tracking-tight text-center px-4">
              {user?.displayName || user?.username}
            </h3>
          )}

          <div className="flex items-center gap-1.5 mt-2 bg-nexo-500/10 hover:bg-nexo-500/20 transition-colors px-3.5 py-1.5 rounded-full border border-nexo-500/20 backdrop-blur-sm cursor-default">
            <AtSign size={13} className="text-nexo-400" />
            <span className="text-sm font-semibold text-nexo-100">{user?.username}</span>
          </div>
        </div>

        <div className="px-4 space-y-2.5 pb-6">
          <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-4 transition-all hover:bg-black/30 hover:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-nexo-500/20 flex items-center justify-center border border-nexo-500/30">
                <Edit3 size={12} className="text-nexo-400" />
              </div>
              <span className="text-xs font-semibold text-nexo-200/50 uppercase tracking-widest">{t('aboutMe')}</span>
            </div>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-black/40 text-sm text-white placeholder-white/30 p-3 border border-white/10 focus:border-nexo-500 transition-colors resize-none outline-none leading-relaxed"
                placeholder={t('tellAboutYourself')}
              />
            ) : (
              <p className="text-sm text-zinc-200 leading-relaxed pl-1">
                {user?.bio || <span className="text-white/30 italic">{t('notSpecified')}</span>}
              </p>
            )}
          </div>

          <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-4 transition-all hover:bg-black/30 hover:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                <Calendar size={12} className="text-orange-400" />
              </div>
              <span className="text-xs font-semibold text-orange-200/50 uppercase tracking-widest">{t('birthday')}</span>
            </div>
            {isEditing ? (
              <DatePicker value={birthday} onChange={setBirthday} />
            ) : (
              <p className="text-sm text-zinc-200 pl-1">
                {user?.birthday ? (
                  new Date(user.birthday).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                ) : (
                  <span className="text-white/30 italic">{t('notSpecified')}</span>
                )}
              </p>
            )}
          </div>

          <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-4 transition-all hover:bg-black/30 hover:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Check size={12} className="text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-200/50 uppercase tracking-widest">{t('onNexoSince')}</span>
            </div>
            <p className="text-sm text-zinc-200 pl-1">
              {new Date(user?.createdAt || Date.now()).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {isEditing && (
          <div className="px-4 pb-6 flex gap-3">
            <button
              onClick={() => { setIsEditing(false); setDisplayName(user?.displayName || ''); setBio(user?.bio || ''); setBirthday(user?.birthday || ''); }}
              className="flex-1 py-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 text-sm font-semibold text-zinc-300 hover:text-white transition-all backdrop-blur-md"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 hover:from-nexo-600 hover:to-purple-700 text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t('save')}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );

  // ======= SETTINGS VIEW =======
  const renderSettings = () => (
    <motion.div key="settings" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <button onClick={() => changeView('main')} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('settings')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('language')}</h4>
          <div className="space-y-1">
            <button
              onClick={() => setLang('ru')}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${lang === 'ru' ? 'bg-nexo-500/15 ring-1 ring-nexo-500/30' : 'bg-surface-tertiary/50 hover:bg-surface-hover'}`}
            >
              <span className="text-lg">🇷🇺</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Русский</p>
              </div>
              {lang === 'ru' && <Check size={16} className="text-nexo-400" />}
            </button>
            <button
              onClick={() => setLang('en')}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${lang === 'en' ? 'bg-nexo-500/15 ring-1 ring-nexo-500/30' : 'bg-surface-tertiary/50 hover:bg-surface-hover'}`}
            >
              <span className="text-lg">🇬🇧</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">English</p>
              </div>
              {lang === 'en' && <Check size={16} className="text-nexo-400" />}
            </button>
          </div>
        </div>
        {/* Кастомизация - ThemeSettings */}
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Palette size={14} />
            Кастомизация
          </h4>
          <ThemeSettings />
        </div>
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('privacy')}</h4>
          <div className="space-y-1">
            <button
              onClick={async () => {
                const newVal = !user?.hideStoryViews;
                try {
                  await api.updateSettings({ hideStoryViews: newVal });
                  updateUser({ hideStoryViews: newVal });
                } catch {}
              }}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50 hover:bg-surface-hover transition-colors"
            >
              <Eye size={18} className="text-zinc-400 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">{t('hideStoryViews')}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{t('hideStoryViewsDesc')}</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${user?.hideStoryViews ? 'bg-nexo-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${user?.hideStoryViews ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
        </div>
        {/* Push Notifications Settings */}
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Bell size={14} />
            Push уведомления
          </h4>
          <div className="space-y-1">
            {/* All Notifications */}
            <button
              onClick={() => updateNotificationSetting('notifyAll', !notificationSettings.notifyAll)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50 hover:bg-surface-hover transition-colors"
            >
              <Bell size={18} className={`flex-shrink-0 ${notificationSettings.notifyAll ? 'text-nexo-400' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Все уведомления</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Включить/выключить всё</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationSettings.notifyAll ? 'bg-nexo-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings.notifyAll ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Messages */}
            <button
              onClick={() => updateNotificationSetting('notifyMessages', !notificationSettings.notifyMessages)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50 hover:bg-surface-hover transition-colors"
            >
              <MessageSquare size={18} className={`flex-shrink-0 ${notificationSettings.notifyMessages ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Сообщения</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Новые сообщения</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationSettings.notifyMessages ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings.notifyMessages ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Friends */}
            <button
              onClick={() => updateNotificationSetting('notifyFriends', !notificationSettings.notifyFriends)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50 hover:bg-surface-hover transition-colors"
            >
              <UserPlus size={18} className={`flex-shrink-0 ${notificationSettings.notifyFriends ? 'text-purple-400' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Друзья</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Запросы в друзья</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationSettings.notifyFriends ? 'bg-purple-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings.notifyFriends ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 px-2">
            💡 Уведомления приходят даже когда браузер закрыт
          </p>
        </div>
        {/* Devices */}
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Monitor size={14} />
            Устройства
          </h4>
          <button
            onClick={() => setShowDevices(true)}
            className="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50 hover:bg-surface-hover transition-colors"
          >
            <Monitor size={18} className="text-nexo-400" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-zinc-200">Активные сессии</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Управление устройствами и сессиями</p>
            </div>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>
        </div>
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('about')}</h4>
          <div className="flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50">
            <Info size={18} className="text-zinc-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200">Nexo Messenger</p>
              <p className="text-xs text-zinc-500">{t('version')} 1.3.0</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ======= FRIENDS VIEW =======
  const renderFriends = () => (
    <motion.div key="friends" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <button onClick={() => { changeView('main'); setFriendSearch(''); setFriendSearchResults([]); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('friends')}</h3>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={t('searchFriends')}
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {friendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            {friendSearch.trim().length > 0 && (
              <div className="px-4 pt-2 pb-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  <Search size={12} className="inline mr-1" />{t('searchFriends').split('(')[0].trim()}
                </h4>
                {(() => {
                  const raw = friendSearch.trim();
                  const q = raw.startsWith('@') ? raw.slice(1) : raw;
                  if (q.length < 3) {
                    return <p className="text-xs text-zinc-500 text-center py-3">{t('minCharsHint')}</p>;
                  }
                  if (friendSearchLoading) {
                    return (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={18} className="animate-spin text-zinc-400" />
                      </div>
                    );
                  }
                  if (friendSearchResults.length === 0) {
                    return <p className="text-xs text-zinc-500 text-center py-3">{t('noSearchResults')}</p>;
                  }
                  return (
                    <div className="space-y-1">
                      {friendSearchResults.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border/50">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                              {(u.displayName || u.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                            <p className="text-xs text-zinc-500">@{u.username}</p>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(u.id)}
                            className="p-2 rounded-lg bg-nexo-500/20 text-nexo-400 hover:bg-nexo-500/30 transition-colors"
                            title={t('addFriend')}
                          >
                            <UserPlus size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {friendRequests.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  {t('friendRequests')} ({friendRequests.length})
                </h4>
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border/50">
                      {req.sender?.avatar ? (
                        <img src={req.sender.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {(req.sender?.displayName || req.sender?.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{req.sender?.displayName || req.sender?.username}</p>
                        <p className="text-xs text-zinc-500">@{req.sender?.username}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAcceptFriend(req.id)}
                          className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                          title={t('accept')}
                        >
                          <UserCheck size={16} />
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          title={t('decline')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 pt-4 pb-2">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {t('friendsList')} ({friends.length})
              </h4>
              {friends.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">{t('noFriends')}</p>
              ) : (
                <div className="space-y-1">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group/friend">
                      <div className="relative">
                        {friend.avatar ? (
                          <img src={friend.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {(friend.displayName || friend.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        {friend.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{friend.displayName || friend.username}</p>
                        <p className="text-xs text-zinc-500">
                          {friend.isOnline ? t('online') : `@${friend.username}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.friendshipId)}
                        className="p-2 rounded-lg text-zinc-600 opacity-0 group-hover/friend:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title={t('removeFriend')}
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
  const renderAbout = () => (
    <motion.div key="about" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <button onClick={() => changeView('main')} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('aboutApp')}</h3>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <img src="/logo.png" alt="Nexo" className="w-20 h-20 rounded-2xl object-cover mb-4 ring-2 ring-white/10" />
        <h2 className="text-xl font-bold gradient-text mb-1">Nexo Messenger</h2>
        <p className="text-sm text-zinc-400 mb-6">{t('version')} 1.3.0</p>
        <div className="text-xs text-zinc-500 space-y-1">
          <p>{t('modernMessenger')}</p>
          <p>{t('onPrivacy')}</p>
          <p className="mt-4 text-zinc-600">© 2026 Dark Heavens Corporate</p>
        </div>
        {/* Legal links */}
        <div className="mt-8 space-y-2 w-full">
          <button
            onClick={() => setLegalPage('terms')}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            📄 Пользовательское соглашение
          </button>
          <button
            onClick={() => setLegalPage('privacy')}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            🔒 Политика конфиденциальности
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-3 top-3 bottom-3 w-[340px] max-w-[calc(100vw-24px)] bg-white/[0.08] backdrop-blur-3xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_100px_rgba(99,102,241,0.1)] border border-white/[0.12] rounded-3xl z-50 flex flex-col overflow-hidden"
          >
            <AnimatePresence mode="wait" custom={slideDir}>
              {view === 'main' && renderMain()}
              {view === 'profile' && renderProfile()}
              {view === 'settings' && renderSettings()}
              {view === 'friends' && renderFriends()}
              {view === 'about' && renderAbout()}
              {view === 'premium' && (
                <div className="h-full">
                  <PremiumPage onClose={() => changeView('main')} />
                </div>
              )}
              {view === 'statistics' && (
                <div className="h-full overflow-hidden">
                  <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0 bg-surface">
                    <button onClick={() => changeView('main')} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                      <ArrowLeft size={20} />
                    </button>
                    <h3 className="text-sm font-semibold text-white flex-1">Статистика</h3>
                  </div>
                  <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
                    <StatisticsPage />
                  </div>
                </div>
              )}
              {view === 'bots' && (
                <div className="h-full overflow-hidden">
                  <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0 bg-surface">
                    <button onClick={() => changeView('main')} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                      <ArrowLeft size={20} />
                    </button>
                    <h3 className="text-sm font-semibold text-white flex-1">Боты</h3>
                  </div>
                  <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
                    <BotsPage />
                  </div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      {/* Devices Tab */}
      <AnimatePresence>
        {showDevices && (
          <div className="fixed inset-0 z-[60]">
            <DevicesTab onClose={() => setShowDevices(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Legal Page */}
      <AnimatePresence>
        {legalPage && (
          <div className="fixed inset-0 z-[70]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setLegalPage(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-surface-secondary border-l border-border/50"
            >
              <LegalPage type={legalPage} onClose={() => setLegalPage(null)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
