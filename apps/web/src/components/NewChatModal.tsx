import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Users, Megaphone, Camera } from 'lucide-react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import type { UserPresence } from '../lib/types';

interface NewChatModalProps {
  onClose: () => void;
}

type Mode = 'personal' | 'group' | 'channel';

export default function NewChatModal({ onClose }: NewChatModalProps) {
  const { addChat, setActiveChat, loadMessages } = useChatStore();
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>('personal');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [channelUsername, setChannelUsername] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelAvatar, setChannelAvatar] = useState<File | null>(null);
  const [channelAvatarPreview, setChannelAvatarPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = await api.searchUsers(query);
        setUsers(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectUser = async (selectedUser: UserPresence) => {
    try {
      const chat = await api.createPersonalChat(selectedUser.id);
      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setIsCreating(true);
    try {
      const chat = await api.createGroupChat(groupName.trim(), []);
      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!groupName.trim() || !channelUsername.trim()) return;
    setIsCreating(true);
    try {
      let avatarUrl: string | undefined;
      
      // Сначала загружаем аватарку если есть
      if (channelAvatar) {
        const uploadResult = await api.uploadFile(channelAvatar);
        avatarUrl = uploadResult.url;
      }
      
      // Создаем канал
      const chat = await api.createChannel(
        groupName.trim(),
        channelUsername.trim(),
        channelDescription.trim() || undefined,
        avatarUrl
      );

      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e) {
      console.error('Create channel error:', e);
      if (e instanceof Error && e.message.includes('юзернейм')) {
        alert('Этот юзернейм уже занят. Пожалуйста, выберите другой.');
      } else if (e instanceof Error) {
        alert('Ошибка при создании канала: ' + e.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальный размер аватарки 5MB');
      return;
    }
    
    setChannelAvatar(file);
    
    // Создаем превью
    const reader = new FileReader();
    reader.onload = () => {
      setChannelAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md rounded-2xl glass-strong shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Новый чат"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {mode !== 'personal' && (
                <button
                  onClick={() => setMode('personal')}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-hover transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <h2 className="text-lg font-semibold text-white">
                {mode === 'personal' ? 'Новый чат' : mode === 'group' ? 'Новая группа' : 'Новый канал'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Selection */}
          {mode === 'personal' ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setMode('personal')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-nexo-500/20 border border-nexo-500/30 text-nexo-400"
                >
                  <MessageSquare size={24} />
                  <span className="text-xs font-medium">Личный</span>
                </button>
                <button
                  onClick={() => setMode('group')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-tertiary/50 border border-border text-zinc-400 hover:bg-surface-hover transition-colors"
                >
                  <Users size={24} />
                  <span className="text-xs font-medium">Группа</span>
                </button>
                <button
                  onClick={() => setMode('channel')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-tertiary/50 border border-border text-zinc-400 hover:bg-surface-hover transition-colors"
                >
                  <Megaphone size={24} />
                  <span className="text-xs font-medium">Канал</span>
                </button>
              </div>

              {/* Search for personal chat */}
              <div>
                <input
                  type="text"
                  placeholder="Поиск пользователей..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
                  autoFocus
                />
              </div>

              {/* Search Results */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : users.length > 0 ? (
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {(u.displayName || u.username)?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0 text-left flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {u.displayName || u.username}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.trim().length > 0 && query.trim().length < 3 ? (
                <div className="text-center py-6 text-zinc-500">
                  <p className="text-sm">Введите минимум 3 символа</p>
                </div>
              ) : null}
            </div>
          ) : mode === 'group' ? (
            /* Create Group */
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl">
                  {groupName.trim().charAt(0).toUpperCase() || 'G'}
                </div>
              </div>
              <input
                type="text"
                placeholder="Название группы"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
                autoFocus
                maxLength={50}
              />
              <p className="text-xs text-zinc-500 text-center">
                Участники могут быть добавлены позже через настройки группы
              </p>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || isCreating}
                className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Users size={16} />
                    Создать группу
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Create Channel */
            <div className="p-4 space-y-4">
              {/* Avatar upload */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full bg-surface-tertiary border-2 border-dashed border-border hover:border-accent transition-colors flex items-center justify-center overflow-hidden group"
                >
                  {channelAvatarPreview ? (
                    <>
                      <img src={channelAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={24} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera size={32} className="text-zinc-500" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
              </div>
              {channelAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setChannelAvatar(null);
                    setChannelAvatarPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="w-full text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Удалить аватарку
                </button>
              )}
              
              <input
                type="text"
                placeholder="Название канала"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
                autoFocus
                maxLength={50}
              />
              <input
                type="text"
                placeholder="Юзернейм @"
                value={channelUsername}
                onChange={(e) => setChannelUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
                required
                maxLength={32}
              />
              <textarea
                placeholder="Описание канала (необязательно)"
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors resize-none h-20"
                maxLength={200}
              />
              <p className="text-xs text-zinc-500 text-center">
                Подписчики могут быть добавлены позже через настройки канала
              </p>
              <button
                onClick={handleCreateChannel}
                disabled={!groupName.trim() || !channelUsername.trim() || isCreating}
                className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Megaphone size={16} />
                    Создать канал
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
