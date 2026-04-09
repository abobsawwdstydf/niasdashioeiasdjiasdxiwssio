import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Menu,
  X,
  MessageSquare,
  Users,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import { api } from '../lib/api';
import { saveEncrypted, loadDecrypted, saveTimestamp, loadTimestamp } from '../lib/storageEncryption';
import Avatar from './Avatar';
import { StoryGroup, Chat } from '../lib/types';
import ChatListItem from './ChatListItem';
import NewChatModal from './NewChatModal';
import UserProfile from './UserProfile';
import SideMenu from './SideMenu';
import StoryViewer, { CreateStoryModal } from './StoryViewer';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Sidebar({ onOpenAI }: { onOpenAI: () => void }) {
  const { user } = useAuthStore();
  const { chats, activeChat, searchQuery, setSearchQuery, addChat, setActiveChat } = useChatStore();
  const { t } = useLang();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const openingChatRef = useRef(false);

  // Результаты поиска
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [channelResults, setChannelResults] = useState<Chat[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  /** Определяем мобильное устройство */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Загрузка сторисов с кэшированием */
  const loadStories = () => {
    const now = Date.now();
    const cachedStories = loadDecrypted('nexo_stories');
    const cachedTimestamp = loadTimestamp('nexo_stories_timestamp');

    if (cachedStories && cachedTimestamp && (now - cachedTimestamp) < 2 * 60 * 1000) {
      setStoryGroups(cachedStories);
    }

    api.getStories()
      .then((stories) => {
        setStoryGroups(stories);
        saveEncrypted('nexo_stories', stories);
        saveTimestamp('nexo_stories_timestamp', now);
      })
      .catch(console.error);
  };

  /** Поиск пользователей и каналов */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setChannelResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [users, channels] = await Promise.all([
          api.searchUsers(searchQuery),
          api.searchChannels(searchQuery)
        ]);
        setSearchResults(users);
        setChannelResults(channels);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleJoinChannel = async (channel: Chat) => {
    try {
      const joined = await api.joinChannel(channel.username!);
      addChat(joined);
      setActiveChat(joined.id);
      setSearchQuery('');
    } catch (e) {
      console.error('Failed to join channel:', e);
    }
  };

  const handleOpenChatWithUser = async (userId: string) => {
    if (openingChatRef.current) return;
    openingChatRef.current = true;

    try {
      const store = useChatStore.getState();
      const existingChat = store.chats.find(c =>
        c.type === 'personal' && c.members.some(m => m.user.id === userId)
      );

      if (existingChat) {
        store.setActiveChat(existingChat.id);
        setSearchQuery('');
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
        const refreshedChats = store.chats;
        const stillExisting = refreshedChats.find(c =>
          c.type === 'personal' && c.members.some(m => m.user.id === userId)
        );

        if (stillExisting) {
          store.setActiveChat(stillExisting.id);
        } else {
          const chat = await api.createPersonalChat(userId);
          store.addChat(chat);
          store.setActiveChat(chat.id);
        }
        setSearchQuery('');
      }
    } catch (e) {
      console.error('Failed to open chat:', e);
    } finally {
      openingChatRef.current = false;
    }
  };

  const handleOpenChatFromStory = (userId: string) => {
    handleOpenChatWithUser(userId);
  };

  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 30000);
    return () => clearInterval(interval);
  }, []);

  /** Фильтрация чатов, избранные всегда наверху */
  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (chat.name?.toLowerCase().includes(q)) return true;
    return chat.members.some(
      (m) =>
        m.user.id !== user?.id &&
        (m.user.username.toLowerCase().includes(q) ||
          m.user.displayName.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (a.type === 'favorites') return -1;
    if (b.type === 'favorites') return 1;
    return 0;
  });

  return (
    <>
      <div className="w-full sm:w-[360px] h-full flex flex-col bg-[#0a0a0f] sm:rounded-3xl overflow-hidden border border-white/5 relative z-10">
        {/* Фоновый градиент */}
        <div className="absolute inset-0 bg-gradient-to-b from-nexo-950/10 via-transparent to-transparent pointer-events-none" />

        {/* ====== HEADER ====== */}
        <div className="relative h-[68px] px-4 flex items-center gap-3 flex-shrink-0 glass-strong">
          {/* Меню */}
          <button
            onClick={() => setShowSideMenu(true)}
            className="glass-btn w-10 h-10 rounded-xl text-zinc-300 hover:text-white"
            title={t('menu')}
          >
            <Menu size={18} />
          </button>

          {/* Логотип */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 bg-nexo-500/30 blur-xl rounded-xl" />
              <img src="/logo.png" alt="Nexo" className="relative w-8 h-8 rounded-xl object-cover" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent truncate">
              Nexo
            </h1>
          </div>

          {/* Новый чат (быстрая кнопка) */}
          <button
            onClick={() => setShowNewChat(true)}
            className="glass-btn w-10 h-10 rounded-xl text-nexo-400 hover:text-nexo-300 hidden sm:flex"
            title={t('newChat')}
          >
            <Plus size={18} />
          </button>

          {/* Nexo AI (только ПК) */}
          <button
            onClick={onOpenAI}
            className="glass-btn w-10 h-10 rounded-xl text-nexo-400 hover:text-nexo-300 hidden sm:flex"
            title="Nexo AI"
          >
            <Sparkles size={18} />
          </button>
        </div>

        {/* ====== ПОИСК ====== */}
        <div className="relative px-4 py-3 flex-shrink-0">
          <div className="relative group">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-nexo-400 transition-colors pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 glass-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ====== СТОРИСЫ ====== */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Создать сторис */}
            <button
              onClick={() => setShowCreateStory(true)}
              className="flex flex-col items-center gap-1 flex-shrink-0 group"
            >
              <div className="w-14 h-14 rounded-full glass-btn group-hover:scale-105 transition-transform">
                <Plus size={16} className="text-nexo-400" />
              </div>
              <span className="text-[10px] text-zinc-500 truncate w-14 text-center">{t('newStory')}</span>
            </button>

            {/* Список сторисов */}
            {storyGroups.map((group, idx) => {
              const avatarUrl = group.user.avatar ? `${API_URL}${group.user.avatar}` : null;
              const isMine = group.user.id === user?.id;
              return (
                <button
                  key={group.user.id}
                  onClick={() => setStoryViewerIndex(idx)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 group"
                >
                  <div className={`w-14 h-14 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                    group.hasUnviewed
                      ? 'bg-gradient-to-tr from-nexo-400 via-purple-500 to-pink-500 shadow-lg shadow-nexo-500/20'
                      : isMine
                        ? 'bg-gradient-to-tr from-zinc-500 to-zinc-600'
                        : 'bg-zinc-700'
                  }`}>
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0a0a0f]">
                      <Avatar src={avatarUrl} name={group.user.displayName || group.user.username} size="lg" className="w-full h-full" />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 truncate w-14 text-center">
                    {isMine ? t('myStory') : (group.user.displayName || group.user.username).split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Разделитель */}
        <div className="mx-4 h-px bg-white/5 flex-shrink-0" />

        {/* ====== СПИСОК ЧАТОВ / РЕЗУЛЬТАТЫ ПОИСКА ====== */}
        <div className={`flex-1 overflow-y-auto relative ${isMobile ? 'pb-28' : 'pb-2'}`}>
          <AnimatePresence mode="wait">
            {searchQuery.trim() ? (
              <motion.div
                key="search-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="py-2"
              >
                {/* Пользователи */}
                {searchResults.length > 0 && (
                  <div className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare size={10} />
                      Пользователи
                    </div>
                    <div className="space-y-0.5">
                      {searchResults.map((u) => (
                        <motion.button
                          key={u.id}
                          onClick={() => handleOpenChatWithUser(u.id)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors"
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                              {(u.displayName || u.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                            <p className="text-xs text-zinc-500">@{u.username}</p>
                          </div>
                          <MessageSquare size={14} className="text-zinc-600" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Каналы */}
                {channelResults.length > 0 && (
                  <div className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Каналы
                    </div>
                    <div className="space-y-0.5">
                      {channelResults.map((channel) => (
                        <motion.button
                          key={channel.id}
                          onClick={() => handleJoinChannel(channel)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors"
                        >
                          {channel.avatar ? (
                            <img src={channel.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold">
                              {(channel.name || channel.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                            <p className="text-xs text-zinc-500">@{channel.username}</p>
                          </div>
                          <MessageSquare size={14} className="text-zinc-600" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ничего не найдено */}
                {searchResults.length === 0 && channelResults.length === 0 && !isSearching && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3"
                  >
                    <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                      <Search size={24} className="opacity-50" />
                    </div>
                    <p className="text-sm">Ничего не найдено</p>
                  </motion.div>
                )}

                {/* Поиск */}
                {isSearching && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </motion.div>
            ) : filteredChats.length === 0 ? (
              <motion.div
                key="empty-chats"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 px-6"
              >
                <div className="w-20 h-20 rounded-full glass-subtle flex items-center justify-center">
                  <MessageSquare size={36} className="opacity-30" />
                </div>
                <p className="text-sm text-center">{t('noChats')}</p>
              </motion.div>
            ) : (
              <motion.div
                key="chat-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <div className="py-2">
                  {filteredChats.map((chat) => (
                    <ChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChat} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ====== НИЖНЯЯ НАВИГАЦИЯ (МОБИЛКИ) — овальная плавающая ====== */}
        {isMobile && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-2 pointer-events-none flex-shrink-0">
            <div className="pointer-events-auto glass-strong rounded-[2rem] flex items-center justify-around px-3 py-2 max-w-sm mx-auto relative">
              {/* Чаты */}
              <button
                onClick={() => {/* Уже на чатах */}}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-nexo-400 transition-colors"
              >
                <MessageSquare size={22} />
                <span className="text-[10px] font-medium">Чаты</span>
              </button>

              {/* Друзья */}
              <button
                onClick={() => setShowSideMenu(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-zinc-400 hover:text-white transition-colors"
              >
                <Users size={22} />
                <span className="text-[10px]">Друзья</span>
              </button>

              {/* Новый чат — выступающая центральная кнопка */}
              <div className="relative -mt-8">
                <button
                  onClick={() => setShowNewChat(true)}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-nexo-500/40 hover:shadow-nexo-500/60 hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  <Plus size={28} />
                </button>
              </div>

              {/* Nexo AI */}
              <button
                onClick={onOpenAI}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-zinc-400 hover:text-nexo-400 transition-colors"
              >
                <Sparkles size={22} />
                <span className="text-[10px]">Nexo AI</span>
              </button>

              {/* Меню */}
              <button
                onClick={() => setShowSideMenu(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-zinc-400 hover:text-white transition-colors"
              >
                <Menu size={22} />
                <span className="text-[10px]">Меню</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====== МОДАЛКИ ====== */}
      <AnimatePresence>
        {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showProfile && <UserProfile userId={user!.id} onClose={() => setShowProfile(false)} isSelf />}
      </AnimatePresence>
      <SideMenu
        isOpen={showSideMenu}
        onClose={() => setShowSideMenu(false)}
      />
      <AnimatePresence>
        {storyViewerIndex !== null && storyGroups.length > 0 && (
          <StoryViewer
            stories={storyGroups}
            initialUserIndex={storyViewerIndex}
            onClose={() => { setStoryViewerIndex(null); loadStories(); }}
            onRefresh={loadStories}
            onOpenChat={handleOpenChatFromStory}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCreateStory && (
          <CreateStoryModal
            onClose={() => setShowCreateStory(false)}
            onCreated={loadStories}
          />
        )}
      </AnimatePresence>
    </>
  );
}
