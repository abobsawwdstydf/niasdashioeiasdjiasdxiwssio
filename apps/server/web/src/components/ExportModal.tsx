import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, FileText, FileJson, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface ExportModalProps {
  chatId: string;
  chatName: string;
  onClose: () => void;
}

export default function ExportModal({ chatId, chatName, onClose }: ExportModalProps) {
  const { success, error } = useToastStore();
  const [format, setFormat] = useState<'json' | 'txt' | 'html'>('json');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);

      if (format === 'json') {
        // Export as JSON
        const data = await api.get(`/utilities/export/chat/${chatId}?format=json`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chatName}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        success('Чат экспортирован в JSON');
      } else if (format === 'txt') {
        // Export as TXT
        const response = await fetch(`/api/utilities/export/chat/${chatId}?format=txt`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chatName}-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        success('Чат экспортирован в TXT');
      } else if (format === 'html') {
        // Export as HTML
        const data = await api.get(`/utilities/export/chat/${chatId}?format=json`);
        const html = generateHTML(data.messages, chatName);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chatName}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        success('Чат экспортирован в HTML');
      }

      onClose();
    } catch (err) {
      console.error('Export error:', err);
      error('Ошибка экспорта чата');
    } finally {
      setIsExporting(false);
    }
  };

  const generateHTML = (messages: any[], chatName: string) => {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${chatName} - Экспорт чата</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .messages {
      padding: 20px;
      max-height: 600px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 12px;
      border-left: 4px solid #667eea;
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: #666;
    }
    .sender { font-weight: 600; color: #667eea; }
    .timestamp { color: #999; }
    .content {
      color: #333;
      line-height: 1.6;
      word-wrap: break-word;
    }
    .media-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #667eea;
      color: white;
      border-radius: 4px;
      font-size: 11px;
      margin-top: 8px;
    }
    .footer {
      padding: 20px;
      text-align: center;
      background: #f8f9fa;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 ${chatName}</h1>
      <p>Экспорт чата • ${new Date().toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })}</p>
    </div>
    <div class="messages">
      ${messages.map(msg => `
        <div class="message">
          <div class="message-header">
            <span class="sender">${msg.sender.displayName || msg.sender.username}</span>
            <span class="timestamp">${new Date(msg.createdAt).toLocaleString('ru-RU')}</span>
          </div>
          <div class="content">
            ${msg.content || ''}
            ${msg.media && msg.media.length > 0 ? `<span class="media-badge">📎 ${msg.media.length} файл(ов)</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="footer">
      Экспортировано из Nexo Messenger • ${messages.length} сообщений
    </div>
  </div>
</body>
</html>`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={20} className="text-nexo-400" />
            <h3 className="text-lg font-semibold text-white">Экспорт чата</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-3 block">Выберите формат экспорта:</label>
            <div className="space-y-2">
              <button
                onClick={() => setFormat('json')}
                className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                  format === 'json'
                    ? 'bg-nexo-500/20 border-nexo-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <FileJson size={20} />
                <div className="flex-1 text-left">
                  <p className="font-medium">JSON</p>
                  <p className="text-xs text-zinc-500">Полный дамп данных</p>
                </div>
              </button>

              <button
                onClick={() => setFormat('txt')}
                className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                  format === 'txt'
                    ? 'bg-nexo-500/20 border-nexo-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <FileText size={20} />
                <div className="flex-1 text-left">
                  <p className="font-medium">TXT</p>
                  <p className="text-xs text-zinc-500">Простой текстовый файл</p>
                </div>
              </button>

              <button
                onClick={() => setFormat('html')}
                className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                  format === 'html'
                    ? 'bg-nexo-500/20 border-nexo-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <div className="flex-1 text-left">
                  <p className="font-medium">HTML</p>
                  <p className="text-xs text-zinc-500">Красивая веб-страница</p>
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <Download size={18} />
                Экспортировать
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
