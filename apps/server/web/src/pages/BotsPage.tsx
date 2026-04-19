import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot as BotIcon, Plus, Edit3, Trash2, Copy, RefreshCw, Power, PowerOff, Terminal, X } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface Bot {
  id: string;
  name: string;
  username: string;
  token: string;
  avatar?: string;
  description?: string;
  webhookUrl?: string;
  isActive: boolean;
  commands: Array<{
    id: string;
    command: string;
    description: string;
  }>;
}

export default function BotsPage() {
  const { success, error } = useToastStore();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api.get('/bots/my');
      setBots(data);
    } catch (err) {
      console.error('Error loading bots:', err);
      error('Ошибка загрузки ботов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBot = async (data: { name: string; username: string; description: string }) => {
    try {
      await api.post('/bots/create', data);
      success('Бот создан');
      loadBots();
      setShowCreateModal(false);
    } catch (err: any) {
      error(err.response?.data?.error || 'Ошибка создания бота');
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Удалить бота? Это действие нельзя отменить.')) return;
    
    try {
      await api.delete(`/bots/${botId}`);
      success('Бот удалён');
      loadBots();
    } catch (err) {
      error('Ошибка удаления бота');
    }
  };

  const handleToggleActive = async (bot: Bot) => {
    try {
      await api.put(`/bots/${bot.id}`, { isActive: !bot.isActive });
      success(bot.isActive ? 'Бот деактивирован' : 'Бот активирован');
      loadBots();
    } catch (err) {
      error('Ошибка изменения статуса');
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    success('Токен скопирован');
  };

  const regenerateToken = async (botId: string) => {
    if (!confirm('Регенерировать токен? Старый токен перестанет работать.')) return;
    
    try {
      const data = await api.post(`/bots/${botId}/regenerate-token`, {});
      success('Токен обновлён');
      setSelectedBot(prev => prev ? { ...prev, token: data.token } : null);
      loadBots();
    } catch (err) {
      error('Ошибка регенерации токена');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-nexo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <BotIcon size={32} className="text-nexo-400" />
              Мои боты
            </h1>
            <p className="text-zinc-400">Создавайте и управляйте ботами для автоматизации</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Создать бота
          </button>
        </div>

        {/* Bots Grid */}
        {bots.length === 0 ? (
          <div className="text-center py-20">
            <BotIcon size={64} className="mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400 mb-4">У вас пока нет ботов</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
            >
              Создать первого бота
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
                      <BotIcon size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{bot.name}</h3>
                      <p className="text-xs text-zinc-500">@{bot.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleActive(bot)}
                    className={`p-2 rounded-lg transition-colors ${
                      bot.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700'
                    }`}
                    title={bot.isActive ? 'Деактивировать' : 'Активировать'}
                  >
                    {bot.isActive ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                </div>

                {bot.description && (
                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{bot.description}</p>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-zinc-500">Команд:</span>
                  <span className="text-sm text-white font-medium">{bot.commands.length}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedBot(bot);
                      setShowTokenModal(true);
                    }}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Terminal size={14} />
                    API
                  </button>
                  <button
                    onClick={() => setSelectedBot(bot)}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 size={14} />
                    Настройки
                  </button>
                  <button
                    onClick={() => handleDeleteBot(bot.id)}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Bot Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <CreateBotModal
              onClose={() => setShowCreateModal(false)}
              onCreate={handleCreateBot}
            />
          )}
        </AnimatePresence>

        {/* Token Modal */}
        <AnimatePresence>
          {showTokenModal && selectedBot && (
            <TokenModal
              bot={selectedBot}
              onClose={() => {
                setShowTokenModal(false);
                setSelectedBot(null);
              }}
              onCopy={copyToken}
              onRegenerate={regenerateToken}
            />
          )}
        </AnimatePresence>

        {/* Bot Settings Modal */}
        <AnimatePresence>
          {selectedBot && !showTokenModal && (
            <BotSettingsModal
              bot={selectedBot}
              onClose={() => setSelectedBot(null)}
              onUpdate={loadBots}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Create Bot Modal Component
function CreateBotModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ name, username, description });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Создать бота</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Имя бота</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мой бот"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-nexo-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="mybot"
              required
              pattern="[a-zA-Z0-9_]{3,20}"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-nexo-500/50 focus:outline-none"
            />
            <p className="text-xs text-zinc-600 mt-1">3-20 символов, только латиница, цифры и _</p>
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Описание (необязательно)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что делает ваш бот?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-nexo-500/50 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
          >
            Создать
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// Token Modal Component
function TokenModal({ bot, onClose, onCopy, onRegenerate }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-2xl rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">API токен</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2">Bot Token:</p>
            <code className="text-sm text-nexo-400 break-all font-mono">{bot.token}</code>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onCopy(bot.token)}
              className="flex-1 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Copy size={16} />
              Скопировать
            </button>
            <button
              onClick={() => onRegenerate(bot.id)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Обновить
            </button>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-300 mb-2 font-semibold">📚 Документация API</p>
            <p className="text-xs text-zinc-400 mb-3">Используйте этот токен для отправки сообщений от имени бота:</p>
            <code className="text-xs text-zinc-300 block bg-black/30 p-3 rounded-lg">
              POST /api/bots/api/{'{token}'}/sendMessage<br/>
              {'{'} "chatId": "...", "text": "Hello!" {'}'}
            </code>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Bot Settings Modal Component
function BotSettingsModal({ bot, onClose, onUpdate }: any) {
  const { success, error } = useToastStore();
  const [commands, setCommands] = useState(bot.commands || []);
  const [newCommand, setNewCommand] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const addCommand = async () => {
    if (!newCommand || !newDescription) return;

    try {
      await api.post(`/bots/${bot.id}/commands`, {
        command: newCommand,
        description: newDescription
      });
      success('Команда добавлена');
      setNewCommand('');
      setNewDescription('');
      onUpdate();
    } catch (err: any) {
      error(err.response?.data?.error || 'Ошибка добавления команды');
    }
  };

  const deleteCommand = async (commandId: string) => {
    try {
      await api.delete(`/bots/${bot.id}/commands/${commandId}`);
      success('Команда удалена');
      setCommands(commands.filter((c: any) => c.id !== commandId));
    } catch (err) {
      error('Ошибка удаления команды');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-2xl rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Команды бота</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add Command */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-white font-medium mb-3">Добавить команду</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                placeholder="start"
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-nexo-500/50"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Описание команды"
                className="flex-[2] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-nexo-500/50"
              />
              <button
                onClick={addCommand}
                className="px-4 py-2 rounded-lg bg-nexo-500 hover:bg-nexo-600 text-white text-sm font-medium transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Commands List */}
          <div className="space-y-2">
            {commands.map((cmd: any) => (
              <div key={cmd.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <code className="text-sm text-nexo-400 font-mono">/{cmd.command}</code>
                <p className="flex-1 text-sm text-zinc-300">{cmd.description}</p>
                <button
                  onClick={() => deleteCommand(cmd.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {commands.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-8">Нет команд</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
