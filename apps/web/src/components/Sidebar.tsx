import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Menu,
  MessageSquare,
  X,
  User as UserIcon,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import { api } from '../lib/api';
import { saveEncrypted, loadDecrypted, saveTimestamp, loadTimestamp } from '../lib/storageEncryption';
import { getInitials, generateAvatarColor } from '../lib/utils';
import Avatar from './Avatar';
import { StoryGroup, Chat } from '../lib/types';
import ChatListItem from './ChatListItem';
import NewChatModal from './NewChatModal';
import UserProfile from './UserProfile';
import SideMenu from './SideMenu';
import StoryViewer, { CreateStoryModal } from './StoryViewer';

const API_URL = import.meta.env.VITE_API_URL || '';

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
  
  // Unified search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [channelResults, setChannelResults] = useState<Chat[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadStories = () => {
    const now = Date.now();
    
    // Load from encrypted localStorage first
    const cachedStories = loadDecrypted('nexo_stories');
    const cachedTimestamp = loadTimestamp('nexo_stories_timestamp');
    
    if (cachedStories && cachedTimestamp && (now - cachedTimestamp) < 2 * 60 * 1000) {
      // Use cached data if less than 2 minutes old
      setStoryGroups(cachedStories);
    }
    
    // Fetch fresh data from server
    api.getStories()
      .then((stories) => {
        setStoryGroups(stories);
        // Save to encrypted localStorage
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
    // Prevent multiple simultaneous requests
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
        // Small delay to ensure store is synced
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-check after delay
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
    const interval = setInterval(loadStories, 30000); // refresh every 30s
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
    // Favorites chat always on top
    if (a.type === 'favorites') return -1;
    if (b.type === 'favorites') return 1;
    return 0;
  });

  const handleLogout = () => {
    clearStore();
    logout();
  };

  return (
    <>
      <div className="w-full sm:w-[360px] h-full flex flex-col bg-gradient-to-b from-[#0a0a0f] to-[#05050a] sm:rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative z-10">
        {/* Шапка с градиентом */}
        <div className="h-[80px] px-4 flex items-center gap-3 border-b border-white/5 bg-gradient-to-r from-nexo-500/10 to-purple-500/10 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => setShowSideMenu(true)}
            className="p-2.5 rounded-xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white hover:scale-105"
            title={t('menu')}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 bg-nexo-500/30 blur-lg rounded-lg" />
              <img src="/logo.png" alt="Nexo" className="relative w-9 h-9 rounded-xl object-cover" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent truncate">Nexo</h1>
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2.5 rounded-xl hover:bg-nexo-500/20 hover:text-nexo-400 transition-all text-zinc-400 hover:scale-105"
            title={t('newChat')}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Поиск с градиентом */}
        <div className="p-4 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl relative z-20">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-nexo-500/10 to-purple-500/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-nexo-400 transition-colors pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск чатов, пользователей, каналов..."
              value={searchQuery}
              onChange={(e) => {
                console.log('Search input changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              onClick={(e) => {
                console.log('Search input clicked!');
                e.stopPropagation();
              }}
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white/[0.03] text-[15px] font-medium text-white placeholder-zinc-500 border border-white/5 hover:border-white/10 focus:border-nexo-500/50 transition-all outline-none shadow-lg relative z-10"
              style={{ pointerEvents: 'auto' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all z-20"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Story circles */}
        {(storyGroups.length > 0 || true) && (
          <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-border/20 flex-shrink-0">
            {/* Add story circle */}
            <button
              onClick={() => setShowCreateStory(true)}
              className="flex flex-col items-center gap-1 flex-shrink-0 group"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center group-hover:border-nexo-400 transition-colors">
                <Plus size={20} className="text-zinc-400 group-hover:text-nexo-400 transition-colors" />
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
                  className="flex flex-col items-center gap-1 flex-shrink-0 group"
                >
                  <div className={`w-14 h-14 rounded-full p-[2.5px] transition-transform group-hover:scale-105 ${
                    group.hasUnviewed
                      ? 'bg-gradient-to-tr from-nexo-400 via-purple-500 to-pink-500 shadow-lg shadow-nexo-500/25'
                      : isMine
                        ? 'bg-gradient-to-tr from-zinc-500 to-zinc-600'
                        : 'bg-zinc-700'
                  }`}>
                    <div className="w-full h-full rounded-full overflow-hidden border-[2.5px] border-surface-secondary">
                      <Avatar
                        src={avatarUrl}
                        name={group.user.displayName || group.user.username}
                        size="lg"
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 truncate w-14 text-center">
                    {isMine ? t('myStory') : (group.user.displayName || group.user.username).split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Список чатов / Результаты поиска */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() ? (
            <div className="py-2">
              {/* Пользователи */}
              {searchResults.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Пользователи</div>
                  <div className="space-y-1">
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
                        <MessageSquare size={16} className="text-zinc-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Каналы */}
              {channelResults.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Каналы</div>
                  <div className="space-y-1">
                    {channelResults.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => handleJoinChannel(channel)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors"
                      >
                        {channel.avatar ? (
                          <img src={channel.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                            {(channel.name || channel.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                          <p className="text-xs text-zinc-500">@{channel.username}</p>
                        </div>
                        <MessageSquare size={16} className="text-zinc-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ничего не найдено */}
              {searchResults.length === 0 && channelResults.length === 0 && !isSearching && (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <p className="text-sm">Ничего не найдено</p>
                </div>
              )}

              {/* Поиск */}
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 px-6">
              <MessageSquare size={40} className="opacity-30" />
              <p className="text-sm text-center">
                {t('noChats')}
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <ChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChat} />
            ))
          )}
        </div>
      </div>

      {/* Модалки */}
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
