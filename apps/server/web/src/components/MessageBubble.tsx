import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Play,
  Pause,
  Download,
  FileText,
  Copy,
  Pencil,
  Trash2,
  Reply,
  Smile,
  MoreHorizontal,
  X,
  Volume2,
  Pin,
  Clock,
  Eye,
  Phone,
  PhoneMissed,
  Video,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import { extractWaveform } from '../lib/utils';
import type { Message, MediaItem, Reaction, ChatMember } from '../lib/types';
import ImageLightbox from './ImageLightbox';
import VideoPlayer from './VideoPlayer';
import Avatar from './Avatar';
import YouTubePreview from './YouTubePreview';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  onViewProfile?: (userId: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onStartSelectionMode?: (id: string) => void;
}

function MessageBubble({
  message,
  isMine,
  showAvatar,
  onViewProfile,
  selectionMode,
  isSelected,
  onToggleSelect,
  onStartSelectionMode
}: MessageBubbleProps) {
  const { user } = useAuthStore();
  const { setReplyTo, setEditingMessage, pinnedMessages, chats, messages } = useChatStore();
  const chatMessages = messages[message.chatId] || [];
  const chat = chats.find(c => c.id === message.chatId);
  const isChannel = chat?.type === 'channel';
  const { t, lang } = useLang();
  
  // For channels, show channel name instead of sender name
  const senderName = isChannel ? (chat?.name || chat?.username || 'Канал') : (message.sender?.displayName || message.sender?.username || '');
  const senderAvatar = isChannel ? chat?.avatar : message.sender?.avatar;
  const [showContext, setShowContext] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [deleteMenuMode, setDeleteMenuMode] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState<string | null>(null);
  const [videoCirclePlaying, setVideoCirclePlaying] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[] | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCollapse, setShowCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Format call duration
  const formatCallDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Check if content is too long and needs collapsing
  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setShowCollapse(height > 300);
      if (height > 300) setIsCollapsed(true);
    }
  }, [message.content]);

  // Прочитано
  const isRead = message.readBy?.some((r) => r.userId !== user?.id);

  const timeStr = new Date(message.createdAt).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Avoid triggering window listener instantly for other menus
    if (selectionMode) {
      onToggleSelect?.(message.id);
      return;
    }
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Check if text is selected inside this bubble
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && bubbleRef.current?.contains(selection?.anchorNode || null)) {
      setQuotedText(text);
    } else {
      setQuotedText(null);
    }

    const menuWidth = 208;
    const menuHeight = 350; // estimate
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;

    setContextPos({ x, y });
    setShowContext(true);
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setShowContext(false);
  };

  const handleReply = () => {
    setReplyTo({ ...message, quote: quotedText });
    setShowContext(false);
    setQuotedText(null);
  };

  const handleEdit = () => {
    setEditingMessage(message);
    setShowContext(false);
  };

  const handleDeleteForAll = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('delete_messages', {
        messageIds: [message.id],
        chatId: message.chatId,
        deleteForAll: true,
      });
    }
    setShowContext(false);
    setDeleteMenuMode(false);
  };

  const handleDeleteForMe = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('delete_messages', {
        messageIds: [message.id],
        chatId: message.chatId,
        deleteForAll: false,
      });
    }
    // Optimistic hide
    useChatStore.getState().hideMessages([message.id], message.chatId);
    setShowContext(false);
    setDeleteMenuMode(false);
  };

  // Имя собеседника для кнопки «Удалить также для ...»
  const chatForDelete = chats.find(c => c.id === message.chatId);
  const otherMemberName = chatForDelete?.type === 'personal'
    ? chatForDelete.members.find(m => m.user.id !== user?.id)?.user.displayName
      || chatForDelete.members.find(m => m.user.id !== user?.id)?.user.username
      || ''
    : '';

  const isPinned = pinnedMessages[message.chatId]?.id === message.id;

  const handlePin = () => {
    const socket = getSocket();
    if (socket) {
      if (isPinned) {
        socket.emit('unpin_message', { messageId: message.id, chatId: message.chatId });
      } else {
        socket.emit('pin_message', { messageId: message.id, chatId: message.chatId });
      }
    }
    setShowContext(false);
  };

  const handleReaction = (emoji: string) => {
    const socket = getSocket();
    if (socket) {
      const existingReaction = message.reactions?.find(
        (r) => r.userId === user?.id && r.emoji === emoji
      );
      if (existingReaction) {
        socket.emit('remove_reaction', { messageId: message.id, chatId: message.chatId, emoji });
      } else {
        socket.emit('add_reaction', { messageId: message.id, chatId: message.chatId, emoji });
      }
    }
    setShowContext(false);
  };

  // Аудио плеер
  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          if (err.name === 'AbortError') {
            // Ignore AbortError - happens when switching between audio
            setIsPlaying(false);
          } else if (err.name === 'NotSupportedError') {
            console.error('Audio format not supported');
            setIsPlaying(false);
          } else {
            setIsPlaying(false);
          }
        });
      } catch (e) {
        setIsPlaying(false);
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setAudioProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // Extract real waveform from voice audio  
  useEffect(() => {
    const voiceUrl = message.media?.find((m) => m.type === 'voice')?.url;
    if (!voiceUrl) return;
    extractWaveform(voiceUrl, 28).then(setWaveformBars);
  }, [message.media]);

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Close context menu logic
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showContext) return;
    const hideMenu = (e: MouseEvent) => {
      // Don't close if clicking inside the context menu
      if (contextMenuRef.current?.contains(e.target as Node)) {
        return;
      }
      setShowContext(false);
      setDeleteMenuMode(false);
    };
    window.addEventListener('click', hideMenu, true);
    window.addEventListener('contextmenu', hideMenu, true);
    return () => {
      window.removeEventListener('click', hideMenu, true);
      window.removeEventListener('contextmenu', hideMenu, true);
    };
  }, [showContext]);

  // Deleted message — auto-hide after 5 seconds
  const [deletedVisible, setDeletedVisible] = useState(true);
  useEffect(() => {
    if (message.isDeleted) {
      const timer = setTimeout(() => setDeletedVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [message.isDeleted]);

  if (message.isDeleted) {
    if (!deletedVisible) return null;
    return (
      <motion.div
        initial={{ opacity: 1, height: 'auto' }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, height: 0 }}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}
      >
        <div className="px-4 py-2 rounded-2xl text-sm italic text-zinc-600 bg-surface-tertiary/50">
          {t('messageDeleted')}
        </div>
      </motion.div>
    );
  }

  const media = message.media || [];
  const hasImage = media.some((m) => m.type === 'image');
  const hasVoice = message.type === 'voice' || media.some((m) => m.type === 'voice');
  const hasAudio = !hasVoice && (message.type === 'audio' || media.some((m) => m.type === 'audio'));
  const hasFile = media.some((m) => m.type !== 'image' && m.type !== 'voice' && m.type !== 'video' && m.type !== 'audio');
  const hasVideo = media.some((m) => m.type === 'video');

  // Группировка реакций
  const reactionGroups: Record<string, { count: number; users: string[]; isMine: boolean }> = {};
  (message.reactions || []).forEach((r) => {
    if (!reactionGroups[r.emoji]) {
      reactionGroups[r.emoji] = { count: 0, users: [], isMine: false };
    }
    reactionGroups[r.emoji].count++;
    reactionGroups[r.emoji].users.push(r.user?.displayName || r.user?.username || '');
    if (r.userId === user?.id) reactionGroups[r.emoji].isMine = true;
  });

  // Simple Markdown formatter
  const renderFormattedText = (text: string): React.ReactNode => {
    if (!text) return text;

    // First, extract and render URLs
    const urlRegex = /(https?:\/\/[^\s<]+)/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        parts.push(textBefore);
      }
      // Add URL as clickable
      parts.push(
        <a
          key={`url-${match.index}`}
          href={match[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {match[0]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    // If no URLs found, fall back to markdown formatting
    if (parts.length === 1 && typeof parts[0] === 'string') {
      const markdownParts = (text as string).split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|_[\s\S]*?_|~[\s\S]*?~|`[\s\S]*?`|@\w+)/g);
      return markdownParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('_') && part.endsWith('_')) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        if (part.startsWith('~') && part.endsWith('~')) return <del key={i} className="line-through opacity-80">{part.slice(1, -1)}</del>;
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="font-mono text-[13px] bg-black/20 px-1 py-0.5 rounded-[0.35rem]">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('@') && part.length > 1) {
          const mentionUsername = part.slice(1);
          return (
            <span
              key={i}
              className="font-semibold text-sky-300 cursor-pointer hover:underline"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const channels = await api.searchChannels(mentionUsername);
                  const channel = channels.find(c => c.username === mentionUsername);
                  if (channel) {
                    const event = new CustomEvent('open-channel-by-username', { detail: { channel } });
                    window.dispatchEvent(event);
                    return;
                  }
                  const users = await api.searchUsers(mentionUsername);
                  const user = users.find(u => u.username === mentionUsername);
                  if (user) {
                    const event = new CustomEvent('open-chat-by-username', { detail: { user } });
                    window.dispatchEvent(event);
                  }
                } catch (err) {
                  console.error('Failed to open mention:', err);
                }
              }}
            >{part}</span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    }

    // Render parts - process markdown in string parts
    return parts.map((part, i) => {
      if (typeof part === 'string') {
        const markdownParts = part.split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|_[\s\S]*?_|~[\s\S]*?~|`[\s\S]*?`|@\w+)/g);
        return markdownParts.map((mp, j) => {
          if (mp.startsWith('**') && mp.endsWith('**')) return <strong key={`${i}-${j}`} className="font-bold">{mp.slice(2, -2)}</strong>;
          if (mp.startsWith('_') && mp.endsWith('_')) return <em key={`${i}-${j}`} className="italic">{mp.slice(1, -1)}</em>;
          if (mp.startsWith('*') && mp.endsWith('*')) return <em key={`${i}-${j}`} className="italic">{mp.slice(1, -1)}</em>;
          if (mp.startsWith('~') && mp.endsWith('~')) return <del key={`${i}-${j}`} className="line-through opacity-80">{mp.slice(1, -1)}</del>;
          if (mp.startsWith('`') && mp.endsWith('`')) return <code key={`${i}-${j}`} className="font-mono text-[13px] bg-black/20 px-1 py-0.5 rounded-[0.35rem]">{mp.slice(1, -1)}</code>;
          if (mp.startsWith('@') && mp.length > 1) {
            const mentionUsername = mp.slice(1);
            return (
              <span
                key={`${i}-${j}`}
                className="font-semibold text-sky-300 cursor-pointer hover:underline"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const channels = await api.searchChannels(mentionUsername);
                    const channel = channels.find(c => c.username === mentionUsername);
                    if (channel) {
                      const event = new CustomEvent('open-channel-by-username', { detail: { channel } });
                      window.dispatchEvent(event);
                      return;
                    }
                    const users = await api.searchUsers(mentionUsername);
                    const user = users.find(u => u.username === mentionUsername);
                    if (user) {
                      const event = new CustomEvent('open-chat-by-username', { detail: { user } });
                      window.dispatchEvent(event);
                    }
                  } catch (err) {
                    console.error('Failed to open mention:', err);
                  }
                }}
              >{mp}</span>
            );
          }
          return <span key={`${i}-${j}`}>{mp}</span>;
        });
      }
      return part;
    });
  };

  return (
    <>
      <div
        ref={bubbleRef}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} group mb-0.5 relative transition-colors duration-200 ${selectionMode ? 'px-4 -mx-4 cursor-pointer hover:bg-white/5 rounded-xl' : ''
          } ${isSelected ? 'bg-nexo-500/10 hover:bg-nexo-500/20' : ''}`}
        onClick={() => {
          if (selectionMode) onToggleSelect?.(message.id);
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Selection Checkbox */}
        {selectionMode && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-white/30 flex items-center justify-center transition-colors">
            {isSelected && <div className="w-5 h-5 rounded-full bg-nexo-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>}
          </div>
        )}

        {/* Avatar spacing for others - only show on first message */}
        {!isMine && (
          <div className={`${showAvatar ? 'w-8 mr-2' : 'w-0 mr-0'} flex-shrink-0 self-end transition-all`}>
            {showAvatar ? (
              <button onClick={() => {
                // In channels, open channel profile instead of sender profile
                if (isChannel) {
                  const event = new CustomEvent('open-channel-profile', { detail: { channelId: message.chatId } });
                  window.dispatchEvent(event);
                } else {
                  onViewProfile?.(message.senderId);
                }
              }} className="relative inline-block">
                <Avatar 
                  src={senderAvatar} 
                  name={senderName} 
                  size="sm"
                  isVerified={message.sender?.isVerified}
                  verifiedBadgeUrl={message.sender?.verifiedBadgeUrl}
                  verifiedBadgeType={message.sender?.verifiedBadgeType}
                />
              </button>
            ) : null}
          </div>
        )}

        {/* Avatar spacing for own messages - hidden */}
        {isMine && (
          <div className="w-0 flex-shrink-0 ml-0 self-end" />
        )}

        <div className={`max-w-[65%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
          {/* Name (only for others, only on first message with avatar) */}
          {!isMine && showAvatar && (
            <button
              className="text-xs font-medium text-nexo-400 ml-3 mb-0.5 hover:underline"
              onClick={() => onViewProfile?.(message.senderId)}
            >
              {senderName}
            </button>
          )}

          {/* Reply */}
          {message.replyTo && (
            <button
              className={`w-full mx-3 mb-1 px-3 py-1.5 rounded-lg border-l-2 border-nexo-500 bg-nexo-500/10 max-w-full text-left hover:bg-nexo-500/20 transition-colors group`}
              onClick={(e) => {
                e.stopPropagation();
                // Scroll to the replied message
                const repliedMsg = chatMessages.find(m => m.id === message.replyToId);
                if (repliedMsg) {
                  const el = document.getElementById(`msg-${repliedMsg.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('bg-nexo-500/30', 'ring-2', 'ring-nexo-500');
                    setTimeout(() => {
                      el.classList.remove('bg-nexo-500/30', 'ring-2', 'ring-nexo-500');
                    }, 2000);
                  }
                }
              }}
            >
              <p className="text-xs font-medium text-nexo-400 truncate">
                {message.replyTo.sender?.displayName || message.replyTo.sender?.username}
              </p>
              <p className="text-xs text-zinc-400 truncate">{message.quote || message.replyTo.content || t('media')}</p>
            </button>
          )}

          {/* Пузырь */}
          <div
            onContextMenu={handleContextMenu}
            onDoubleClick={handleReply}
            title={t('reply') ? `${t('reply')} (Double Click)` : 'Double click to reply'}
            className={`cursor-pointer rounded-[1.25rem] overflow-hidden transition-all duration-300 ${
              hasImage && !message.content
                ? 'p-0 shadow-none border-none'
                : isMine
                  ? 'bubble-sent text-white shadow-sm px-4 py-2.5 hover:shadow-md hover:brightness-105'
                  : 'bubble-received text-zinc-100 shadow-sm px-4 py-2.5 hover:shadow-md hover:brightness-105'
            }`}
          >
            {/* Рендер пересланного сообщения */}
            {message.forwardedFrom && (
              <div className="mb-2 text-xs opacity-90 border-l-[3px] border-white/30 pl-2">
                <span className="font-medium">{t('forwardedFrom')}: </span>
                {message.forwardedFrom.displayName || message.forwardedFrom.username}
              </div>
            )}

            {/* Call Message */}
            {message.type === 'call' && (
              <div className="flex items-center gap-3 py-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  message.callStatus === 'missed' || message.callStatus === 'declined' 
                    ? 'bg-red-500/20' 
                    : 'bg-emerald-500/20'
                }`}>
                  {message.callStatus === 'missed' ? (
                    <PhoneMissed size={18} className="text-red-400" />
                  ) : message.callStatus === 'declined' ? (
                    <PhoneMissed size={18} className="text-red-400" />
                  ) : message.callType === 'video' ? (
                    <Video size={18} className="text-emerald-400" />
                  ) : (
                    <Phone size={18} className="text-emerald-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    message.callStatus === 'missed' || message.callStatus === 'declined'
                      ? 'text-red-400'
                      : 'text-zinc-200'
                  }`}>
                    {message.callStatus === 'missed' 
                      ? 'Пропущенный вызов'
                      : message.callStatus === 'declined'
                      ? 'Отменённый вызов'
                      : message.callStatus === 'completed'
                      ? `${message.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'} (${formatCallDuration(message.callDuration || 0)})`
                      : message.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Изображения */}
            {hasImage && (
              <div className={`${message.content ? 'mb-2' : ''}`}>
                <div className="grid grid-cols-2 gap-1">
                  {media
                    .filter((m) => m.type === 'image')
                    .map((m) => (
                      <div key={m.id} className="relative aspect-square overflow-hidden rounded-lg bg-black">
                        <img
                          src={m.url}
                          alt=""
                          className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition-all select-none"
                          onClick={() => setLightboxUrl(m.url)}
                          draggable={false}
                          onError={(e) => {
                            // Show broken image indicator
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent && !parent.querySelector('.broken-img')) {
                              const div = document.createElement('div');
                              div.className = 'broken-img absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500';
                              div.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                              parent.appendChild(div);
                            }
                          }}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Видео - Telegram style */}
            {hasVideo &&
              media
                .filter((m) => m.type === 'video')
                .map((m, idx) => {
                  const size = m.size || 0;
                  const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`;
                  const dur = m.duration || 0;
                  const durStr = dur ? `${Math.floor(dur / 60)}:${Math.floor(dur % 60).toString().padStart(2, '0')}` : '';
                  return (
                    <div key={m.id} className={`${message.content ? 'mb-2 -mx-3 -mt-2' : ''}`}>
                      <div
                        className="relative rounded-2xl overflow-hidden bg-black group cursor-pointer shadow-lg"
                        onClick={() => setShowVideoPlayer(m.url)}
                      >
                        <video
                          src={m.url}
                          poster={m.thumbnail || ''}
                          className="w-full max-w-[320px] max-h-64 object-contain"
                          preload="metadata"
                          onError={(e) => {
                            (e.target as HTMLVideoElement).style.display = 'none';
                            const parent = (e.target as HTMLVideoElement).parentElement;
                            if (parent && !parent.querySelector('.broken-video')) {
                              const div = document.createElement('div');
                              div.className = 'broken-video absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500';
                              div.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
                              parent.appendChild(div);
                            }
                          }}
                        />
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-all">
                          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform border border-white/30">
                            <Play size={24} className="text-white ml-1" />
                          </div>
                        </div>
                        {/* Duration badge - bottom right */}
                        {(durStr || sizeStr) && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                            {durStr && (
                              <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-xs text-white font-mono">
                                {durStr}
                              </span>
                            )}
                            {sizeStr && (
                              <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/70">
                                {sizeStr}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

            {/* Video Player Modal */}
            {showVideoPlayer && (
              <VideoPlayer
                src={showVideoPlayer}
                onClose={() => setShowVideoPlayer(null)}
              />
            )}

            {/* Видео-кружок */}
            {message.type === 'video_circle' && media[0]?.url && (
              <div className="flex items-center justify-center py-2">
                <button
                  onClick={() => {
                    const videoEl = document.getElementById(`vc-${message.id}`) as HTMLVideoElement;
                    if (!videoEl) return;
                    if (videoCirclePlaying === message.id) {
                      setVideoCirclePlaying(null);
                      videoEl.pause();
                      videoEl.currentTime = 0;
                    } else {
                      setVideoCirclePlaying(message.id);
                      videoEl.play().catch(() => {});
                    }
                  }}
                  className="relative w-56 h-56 rounded-full overflow-hidden border-2 border-white/10 hover:border-white/30 transition-all active:scale-95 bg-black"
                >
                  <video
                    id={`vc-${message.id}`}
                    src={media[0].url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    loop
                    onEnded={() => setVideoCirclePlaying(null)}
                  />
                  {videoCirclePlaying !== message.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center backdrop-blur-sm">
                        <Play size={20} className="text-black ml-0.5" />
                      </div>
                    </div>
                  )}
                  {/* Duration badge - bottom right corner */}
                  <div className="absolute bottom-3 right-3 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm">
                    <span className="text-[10px] text-white font-mono">
                      {media[0].duration
                        ? `${Math.floor(media[0].duration / 60)}:${Math.floor(media[0].duration % 60).toString().padStart(2, '0')}`
                        : '0:00'}
                    </span>
                  </div>
                </button>
              </div>
            )}

            {/* Опрос */}
            {message.type === 'poll' && message.content && (() => {
              try {
                const poll = JSON.parse(message.content);
                if (poll.question && poll.options) {
                  return (
                    <div className="min-w-[260px]">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 size={16} className={isMine ? 'text-white/60' : 'text-nexo-400'} />
                        <span className="text-xs font-medium opacity-60">Опрос</span>
                      </div>
                      <p className="text-sm font-semibold mb-3">{poll.question}</p>
                      <div className="space-y-2">
                        {poll.options.map((option: string, i: number) => (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-sm ${
                              isMine ? 'bg-white/10 hover:bg-white/15' : 'bg-nexo-500/10 hover:bg-nexo-500/20'
                            } transition-colors`}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                      {poll.quiz && (
                        <div className="mt-3 text-xs text-emerald-400">Викторина</div>
                      )}
                    </div>
                  );
                }
              } catch (e) {
                // Если не JSON - показать как текст
                return <p className="text-sm">{message.content}</p>;
              }
              return null;
            })()}

            {/* Геолокация */}
            {message.type === 'location' && message.content && (() => {
              try {
                const loc = JSON.parse(message.content);
                if (loc.lat && loc.lng) {
                  return (
                    <div className="min-w-[260px]">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className={isMine ? 'text-white/60' : 'text-nexo-400'} />
                        <span className="text-xs font-medium opacity-60">Геолокация</span>
                      </div>
                      {loc.name && (
                        <p className="text-xs mb-2 opacity-80">{loc.name}</p>
                      )}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-3 rounded-lg ${
                          isMine ? 'bg-white/10 hover:bg-white/15' : 'bg-nexo-500/10 hover:bg-nexo-500/20'
                        } transition-colors`}
                      >
                        <p className="text-xs font-mono">
                          {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                        </p>
                        {loc.accuracy && (
                          <p className="text-xs opacity-60 mt-1">
                            Точность: ±{loc.accuracy < 1000 ? `${Math.round(loc.accuracy)} м` : `${(loc.accuracy / 1000).toFixed(1)} км`}
                          </p>
                        )}
                      </a>
                    </div>
                  );
                }
              } catch (e) {
                // ignore
              }
              return null;
            })()}

            {/* Голосовое - Telegram style */}
            {hasVoice && (() => {
              const voiceMedia = media.find((m) => m.type === 'voice');
              if (!voiceMedia?.url) return null;
              const duration = voiceMedia.duration || 0;
              const size = voiceMedia.size || 0;
              const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`;

              return (
                <div className="flex items-center gap-3 min-w-[220px] max-w-[300px]">
                  {/* Hidden audio element */}
                  <audio
                    ref={audioRef}
                    src={isPlaying || audioDuration > 0 ? voiceMedia.url : undefined}
                    preload="none"
                  />
                  {/* Play button - Telegram style circle */}
                  <button
                    onClick={toggleAudio}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isMine
                        ? 'bg-white/25 hover:bg-white/35'
                        : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause size={18} className="text-white" />
                    ) : (
                      <Play size={18} className="text-white ml-0.5" />
                    )}
                  </button>

                  {/* Waveform + info */}
                  <div className="flex-1 min-w-0">
                    {/* Waveform */}
                    <div
                      className="flex items-end gap-[2px] h-7 cursor-pointer mb-1"
                      onClick={(e) => {
                        const audio = audioRef.current;
                        if (!audio || !audio.duration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        audio.currentTime = pct * audio.duration;
                        setAudioProgress(pct * 100);
                        if (!isPlaying) toggleAudio();
                      }}
                    >
                      {(waveformBars || Array(28).fill(0.5)).map((val, i) => {
                        const barHeight = Math.max(8, val * 100);
                        const progress = audioProgress / 100;
                        const barProgress = i / 28;
                        const isActive = barProgress < progress;
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-colors duration-100 ${
                              isActive
                                ? isMine ? 'bg-white' : 'bg-blue-300'
                                : isMine ? 'bg-white/30' : 'bg-white/20'
                            }`}
                            style={{ height: `${barHeight}%` }}
                          />
                        );
                      })}
                    </div>
                    {/* Duration + size row */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isMine ? 'text-white/70' : 'text-blue-200'}`}>
                        {isPlaying
                          ? formatDuration(audioRef.current?.currentTime || 0)
                          : formatDuration(duration || audioDuration || 0)}
                      </span>
                      <span className={`text-[10px] ${isMine ? 'text-white/40' : 'text-blue-300/60'}`}>
                        {sizeStr}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Аудио (mp3 файлы) */}
            {hasAudio && (() => {
              const audioMedia = media.find((m) => m.type === 'audio');
              return (
                <div className="min-w-[220px]">
                  {audioMedia?.filename && (
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 size={14} className={isMine ? 'text-white/60' : 'text-nexo-400'} />
                      <span className={`text-xs truncate ${isMine ? 'text-white/70' : 'text-zinc-400'}`}>{audioMedia.filename}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <audio
                      ref={audioRef}
                      src={isPlaying || audioDuration > 0 ? audioMedia?.url : undefined}
                      preload="none"
                    />
                    <button
                      onClick={toggleAudio}
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-nexo-500/20 hover:bg-nexo-500/30'
                        } transition-colors`}
                    >
                      {isPlaying ? (
                        <Pause size={16} className={isMine ? 'text-white' : 'text-nexo-400'} />
                      ) : (
                        <Play size={16} className={`${isMine ? 'text-white' : 'text-nexo-400'} ml-0.5`} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[2px] h-6">
                        {Array.from({ length: 28 }).map((_, i) => {
                          const barHeight = [40, 65, 35, 80, 50, 90, 45, 70, 55, 85, 30, 75, 60, 95, 40, 80, 50, 70, 35, 90, 55, 65, 45, 85, 60, 75, 50, 40][i] || 50;
                          const progress = audioProgress / 100;
                          const barProgress = i / 28;
                          const isActive = barProgress < progress;
                          return (
                            <div
                              key={i}
                              className={`flex-1 rounded-full transition-colors duration-150 ${isActive
                                ? isMine ? 'bg-white/80' : 'bg-nexo-400'
                                : isMine ? 'bg-white/20' : 'bg-white/10'
                                }`}
                              style={{ height: `${barHeight}%` }}
                            />
                          );
                        })}
                      </div>
                      <span className={`text-xs mt-0.5 block ${isMine ? 'text-white/60' : 'text-zinc-500'}`}>
                        {isPlaying
                          ? formatDuration(audioRef.current?.currentTime || 0)
                          : formatDuration(audioDuration || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Файлы (Album support) */}
            {hasFile && (
              <div className={`${message.content ? 'mb-2' : ''}`}>
                {/* Grid: 1 column on mobile, 3 columns on desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                  {media
                    .filter((m) => m.type !== 'image' && m.type !== 'voice' && m.type !== 'video')
                    .map((m) => {
                      // Shorten long filenames (>11 chars → 5 + ... + extension)
                      let displayName = m.filename || t('fileLabel');
                      if (displayName.length > 11) {
                        const lastDot = displayName.lastIndexOf('.');
                        if (lastDot > 0) {
                          const ext = displayName.slice(lastDot);
                          const name = displayName.slice(0, 5);
                          displayName = `${name}...${ext}`;
                        } else {
                          displayName = `${displayName.slice(0, 5)}...`;
                        }
                      }
                      
                      return (
                        <a
                          key={m.id}
                          href={m.url}
                          download={m.filename || 'file'}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={m.filename || undefined} // Show full name on hover
                          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl min-h-[80px] ${
                            isMine ? 'bg-white/10 hover:bg-white/15' : 'bg-surface-tertiary hover:bg-surface-hover'
                          } transition-colors`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isMine ? 'bg-white/20' : 'bg-nexo-500/20'
                          }`}>
                            <FileText size={20} className={isMine ? 'text-white' : 'text-nexo-400'} />
                          </div>
                          <p className="text-xs text-center truncate w-full" title={m.filename || undefined}>
                            {displayName}
                          </p>
                          <p className={`text-[10px] ${isMine ? 'text-white/50' : 'text-zinc-500'}`}>
                            {m.size ? `${(m.size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </a>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Текст */}
            {message.content && (
              <div ref={contentRef} className="flex items-end gap-2">
                <div className={`text-sm flex-1 leading-relaxed overflow-hidden ${isCollapsed ? 'max-h-[300px]' : ''}`}>
                  <p className="whitespace-pre-wrap break-all word-break">
                    {renderFormattedText(message.content)}
                  </p>
                </div>
                {showCollapse && (
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-[10px] text-nexo-400 hover:text-nexo-300 transition-colors flex-shrink-0 self-end"
                  >
                    {isCollapsed ? '▼' : '▲'}
                  </button>
                )}
                <span className={`text-[10px] flex-shrink-0 flex items-center gap-0.5 self-end select-none ${isMine ? 'text-white/50' : 'text-zinc-500'
                  }`}>
                  {message.isEdited && <span>{t('edited')}</span>}
                  {message.scheduledAt && <Clock size={11} className="text-amber-400 mr-0.5" />}
                  {timeStr}
                  {isMine && !message.scheduledAt && (
                    isChannel ? (
                      <span className="flex items-center gap-1 ml-0.5 text-xs">
                        <Eye size={11} className="text-zinc-400" />
                        {message.viewCount || 0}
                      </span>
                    ) : isRead ? (
                      <CheckCheck size={13} className="text-sky-300 ml-0.5" />
                    ) : (
                      <Check size={13} className="ml-0.5" />
                    )
                  )}
                </span>
              </div>
            )}

            {/* YouTube Preview - detect URLs in content */}
            {message.content && (() => {
              const ytPattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/g;
              const ytUrls = message.content.match(ytPattern);
              if (ytUrls && ytUrls.length > 0) {
                return (
                  <>
                    {Array.from(new Set(ytUrls)).map((url, i) => (
                      <YouTubePreview key={i} url={url} />
                    ))}
                  </>
                );
              }
              return null;
            })()}

            {/* Время для медиа без текста */}
            {!message.content && (hasImage || hasVideo) && (
              <div className={`flex justify-end px-3 py-1 ${hasImage ? '-mt-8 relative z-10' : ''}`}>
                <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm select-none">
                  {timeStr}
                  {isMine && (
                    isChannel ? (
                      <span className="flex items-center gap-1">
                        <Eye size={11} className="text-zinc-400" />
                        {message.viewCount || 0}
                      </span>
                    ) : (
                      isRead ? (
                        <CheckCheck size={13} className="text-sky-300" />
                      ) : (
                        <Check size={13} />
                      )
                    )
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Реакции */}
          {Object.keys(reactionGroups).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 mx-1">
              {Object.entries(reactionGroups).map(([emoji, data]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${data.isMine
                    ? 'bg-nexo-500/30 border border-nexo-500/50'
                    : 'bg-surface-tertiary border border-border hover:border-zinc-600'
                    }`}
                  title={data.users.join(', ')}
                >
                  <span>{emoji}</span>
                  <span className="text-zinc-400">{data.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Own avatar - hidden (user's own messages don't show avatar) */}
        {isMine && (
          <div className="w-0 flex-shrink-0 ml-0 self-end" />
        )}
      </div>

      {/* Контекстное меню */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showContext && (
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[9999] w-[280px] max-w-[calc(100vw-16px)] rounded-[1.25rem] glass-strong shadow-2xl py-1.5 overflow-hidden border border-white/10"
              style={{ 
                left: Math.min(contextPos.x, window.innerWidth - 296), 
                top: Math.min(contextPos.y, window.innerHeight - 400) 
              }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {deleteMenuMode ? (
                <>
                  {/* Delete submenu */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                    <button
                      onClick={() => setDeleteMenuMode(false)}
                      className="p-1 rounded-lg hover:bg-surface-hover transition-colors text-zinc-400 hover:text-white"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <span className="text-sm font-medium text-zinc-300">{t('delete')}</span>
                  </div>
                  <button
                    onClick={handleDeleteForMe}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                  >
                    <Trash2 size={16} className="text-zinc-400" />
                    {t('deleteForMe')}
                  </button>
                  <button
                    onClick={handleDeleteForAll}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={16} />
                    {chatForDelete?.type === 'personal' && otherMemberName
                      ? `${t('deleteAlsoFor')} ${otherMemberName}`
                      : t('deleteForAll')}
                  </button>
                </>
              ) : (
                <>
              {/* Быстрые реакции */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
                {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                onClick={handleReply}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <Reply size={16} />
                {quotedText ? t('replyWithQuote') : t('reply')}
              </button>

              <button
                onClick={() => {
                  setShowContext(false);
                  onStartSelectionMode?.(message.id);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <CheckCheck size={16} />
                {t('select')}
              </button>

              <button
                onClick={handlePin}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <Pin size={16} />
                {isPinned ? t('unpinMessage') : t('pinMessage')}
              </button>

              {message.content && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                >
                  <Copy size={16} />
                  {t('copy')}
                </button>
              )}

              {isMine && message.content && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                >
                  <Pencil size={16} />
                  {t('edit')}
                </button>
              )}

              <div className="border-t border-border my-1" />
              <button
                onClick={() => setDeleteMenuMode(true)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={16} />
                {t('delete')}
              </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(MessageBubble);
