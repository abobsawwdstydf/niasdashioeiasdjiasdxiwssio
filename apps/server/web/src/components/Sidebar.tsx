import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Menu,
  MessageSquare,
  X,
  User,
  Users,
  Bell,
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

type BottomTab = 'chats' | 'search' | 'new' | 'profile';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { chats, activeChat, searchQuery, setSearchQuery, clearStore, addChat, setActiveChat } = useChatStore();
  const { t } = useLang();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const openingChatRef = useRef(false);

  // Bottom tab state
  const [activeTab, setActiveTab] = useState<BottomTab>('chats');

  // Unified search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [channelResults, setChannelResults] = useState<Chat[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Unified search - users and channels
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

  // Tab change handler
  const handleTabChange = (tab: BottomTab) => {
    setActiveTab(tab);
    if (tab === 'chats') {
      setSearchQuery('');
    } else if (tab === 'search') {
      // Focus search handled by effect
    } else if (tab === 'new') {
      setShowNewChat(true);
    } else if (tab === 'profile') {
      setShowProfile(true);
    }
  };

  // Unread count
  const unreadCount = chats.reduce((acc, chat) => acc + chat.unreadCount, 0);

  return (
    <>
      <div className="w-full sm:w-[360px] h-full flex flex-col bg-[#0a0a0f] sm:rounded-3xl overflow-hidden border border-white/5 relative z-10">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-nexo-950/20 via-transparent to-transparent pointer-events-none" />

        {/* Header - Liquid Glass */}
        <div className="relative h-[72px] px-4 flex items-center gap-3 flex-shrink-0 liquid-glass-header">
          <button
            onClick={() => setShowSideMenu(true)}
            className="liquid-glass-button w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300"
            title={t('menu')}
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 bg-nexo-500/40 blur-xl rounded-full" />
              <img src="/logo.png" alt="Nexo" className="relative w-8 h-8 rounded-xl object-cover" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent truncate">
              Nexo
            </h1>
          </div>

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            className="relative liquid-glass-button w-10 h-10 rounded-xl overflow-hidden"
          >
            {user?.avatar ? (
              <img src={`${API_URL}${user.avatar}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-nexo-500 to-purple-600 text-white text-sm font-bold">
                {(user?.displayName || user?.username || '?')[0].toUpperCase()}
              </div>
            )}
            {user?.isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0a0a0f]" />
            )}
          </button>
        </div>

        {/* Search bar - Liquid Glass */}
        <div className="relative p-4 flex-shrink-0">
          <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-nexo-400 transition-colors pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm text-white placeholder-zinc-500 liquid-glass-input"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setActiveTab('chats'); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full liquid-glass-button flex items-center justify-center"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Stories - Liquid Glass */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowCreateStory(true)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="w-14 h-14 rounded-full liquid-glass-button flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plus size={18} className="text-nexo-400" />
              </div>
              <span className="text-[10px] text-zinc-500 truncate w-14 text-center">{t('newStory')}</span>
            </button>

            {storyGroups.map((group, idx) => {
              const avatarUrl = group.user.avatar ? `${API_URL}${group.user.avatar}` : null;
              const isMine = group.user.id === user?.id;
              return (
                <button
                  key={group.user.id}
                  onClick={() => setStoryViewerIndex(idx)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
                >
                  <div className={`w-14 h-14 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                    group.hasUnviewed
                      ? 'bg-gradient-to-tr from-nexo-400 via-purple-500 to-pink-500'
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

        {/* Divider */}
        <div className="mx-4 h-px liquid-glass-subtle flex-shrink-0" />

        {/* Content area */}
        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {/* Chats tab */}
            {activeTab === 'chats' && (
              <motion.div
                key="chats"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                {filteredChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 px-6">
                    <div className="w-20 h-20 rounded-full liquid-glass-subtle flex items-center justify-center">
                      <MessageSquare size={36} className="opacity-30" />
                    </div>
                    <p className="text-sm text-center">{t('noChats')}</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {filteredChats.map((chat) => (
                      <ChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChat} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Search results tab */}
            {activeTab === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="py-2"
              >
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : searchResults.length > 0 || channelResults.length > 0 ? (
                  <>
                    {searchResults.length > 0 && (
                      <div className="mb-4">
                        <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                          <User size={12} />
                          Пользователи
                        </div>
                        <div className="space-y-0.5">
                          {searchResults.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => handleOpenChatWithUser(u.id)}
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
                              <MessageSquare size={16} className="text-zinc-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {channelResults.length > 0 && (
                      <div className="mb-4">
                        <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                          <Bell size={12} />
                          Каналы
                        </div>
                        <div className="space-y-0.5">
                          {channelResults.map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => handleJoinChannel(channel)}
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
                              <MessageSquare size={16} className="text-zinc-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
                    <div className="w-16 h-16 rounded-full liquid-glass-subtle flex items-center justify-center">
                      <Search size={24} className="opacity-50" />
                    </div>
                    <p className="text-sm">Введите запрос для поиска</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom navigation - Liquid Glass */}
        <div className="relative flex-shrink-0 liquid-glass-header">
          <div className="flex items-center justify-around px-2 py-2">
            {/* Chats tab */}
            <button
              onClick={() => handleTabChange('chats')}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 ${
                activeTab === 'chats'
                  ? 'liquid-glass-active'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="relative">
                <MessageSquare size={20} />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-nexo-500 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium">Чаты</span>
            </button>

            {/* Search tab */}
            <button
              onClick={() => handleTabChange('search')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 ${
                activeTab === 'search'
                  ? 'liquid-glass-active'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Search size={20} />
              <span className="text-[10px] font-medium">Поиск</span>
            </button>

            {/* New chat button - Center floating */}
            <button
              onClick={() => handleTabChange('new')}
              className="relative -mt-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-nexo-500/40 hover:shadow-nexo-500/60 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
              <Plus size={24} className="relative" />
            </button>

            {/* Notifications */}
            <button
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl text-zinc-500 hover:text-zinc-300 transition-all duration-300"
            >
              <Bell size={20} />
              <span className="text-[10px] font-medium">Уведомления</span>
            </button>

            {/* Profile tab */}
            <button
              onClick={() => handleTabChange('profile')}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 ${
                activeTab === 'profile'
                  ? 'liquid-glass-active'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="relative">
                <User size={20} />
                {user?.isOnline && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              <span className="text-[10px] font-medium">Профиль</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
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
