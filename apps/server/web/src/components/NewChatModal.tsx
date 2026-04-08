import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Users, Megaphone, Search, Check, UserPlus, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import type { UserPresence } from '../lib/types';
import Avatar from './Avatar';

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
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = await api.searchUsers(query);
        setUsers(results.filter(u => !selectedUsers.has(u.id)));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedUsers]);

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectUser = async (selectedUser: UserPresence) => {
    try {
      const chat = await api.createPersonalChat(selectedUser.id);
      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setIsCreating(true);
    try {
      const memberIds = Array.from(selectedUsers);
      const chat = await api.createGroupChat(groupName.trim(), memberIds);
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
      const chat = await api.createChannel(
        groupName.trim(),
        channelUsername.trim(),
        channelDescription.trim() || undefined
      );
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

  const modes: { key: Mode; icon: typeof MessageSquare; label: string; desc: string }[] = [
    { key: 'personal', icon: MessageSquare, label: 'Личный чат', desc: 'Написать сообщение' },
    { key: 'group', icon: Users, label: 'Группа', desc: 'Создать группу' },
    { key: 'channel', icon: Megaphone, label: 'Канал', desc: 'Создать канал' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-surface-secondary rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Новый чат</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-white/5">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => { setMode(m.key); setQuery(''); setUsers([]); setSelectedUsers(new Set()); }}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === m.key
                  ? 'text-nexo-400 border-b-2 border-nexo-400 bg-nexo-500/5'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <m.icon size={16} />
              {m.label}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {mode === 'personal' && (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Поиск по имени или username..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  autoFocus
                />
              </div>

              {/* Users list */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="text-nexo-400 animate-spin" />
                </div>
              ) : users.length > 0 ? (
                <div className="space-y-1">
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                    >
                      <Avatar src={user.avatar} name={user.displayName || user.username} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user.displayName || user.username}</p>
                        <p className="text-xs text-zinc-500">@{user.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.length >= 2 ? (
                <p className="text-center text-zinc-500 text-sm py-8">Никого не найдено</p>
              ) : (
                <p className="text-center text-zinc-500 text-sm py-8">Начните вводить имя или username</p>
              )}
            </div>
          )}

          {mode === 'group' && (
            <div className="space-y-4">
              {/* Group name */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Название группы
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Введите название..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  autoFocus
                />
              </div>

              {/* Members selection */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Участники ({selectedUsers.size})
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Поиск участников..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  />
                </div>

                {/* Selected users */}
                {selectedUsers.size > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Array.from(selectedUsers).map(id => {
                      const user = users.find(u => u.id === id);
                      if (!user) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => toggleUser(id)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-nexo-500/20 border border-nexo-500/30 text-nexo-300 text-sm hover:bg-nexo-500/30 transition-colors"
                        >
                          <Check size={12} />
                          {user.displayName || user.username}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Users list */}
                {users.length > 0 && (
                  <div className="space-y-1 mt-3 max-h-40 overflow-y-auto">
                    {users.map(user => (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left ${
                          selectedUsers.has(user.id) ? 'bg-nexo-500/10 border border-nexo-500/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <Avatar src={user.avatar} name={user.displayName || user.username} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.displayName || user.username}</p>
                          <p className="text-xs text-zinc-500">@{user.username}</p>
                        </div>
                        {selectedUsers.has(user.id) && (
                          <div className="w-5 h-5 rounded-full bg-nexo-500 flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create button */}
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || isCreating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium hover:from-nexo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nexo-500/25 flex items-center justify-center gap-2"
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                Создать группу
              </button>
            </div>
          )}

          {mode === 'channel' && (
            <div className="space-y-4">
              {/* Channel name */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Название канала
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Введите название..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  autoFocus
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                  <input
                    type="text"
                    value={channelUsername}
                    onChange={e => setChannelUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="username"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Только латинские буквы, цифры и _</p>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Описание (необязательно)
                </label>
                <textarea
                  value={channelDescription}
                  onChange={e => setChannelDescription(e.target.value)}
                  placeholder="О чём ваш канал..."
                  maxLength={255}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 resize-none h-20"
                />
              </div>

              {/* Create button */}
              <button
                onClick={handleCreateChannel}
                disabled={!groupName.trim() || !channelUsername.trim() || isCreating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium hover:from-nexo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nexo-500/25 flex items-center justify-center gap-2"
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />}
                Создать канал
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
