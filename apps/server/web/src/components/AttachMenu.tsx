import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, FileImage, FileText, BarChart3, MapPin } from 'lucide-react';

interface AttachMenuProps {
  onClose: () => void;
  onSelectFile: () => void;
  onSelectImage: () => void;
  onSelectCamera: () => void;
  onSelectPoll: () => void;
  onSelectLocation: () => void;
}

export default function AttachMenu({
  onClose,
  onSelectFile,
  onSelectImage,
  onSelectCamera,
  onSelectPoll,
  onSelectLocation
}: AttachMenuProps) {
  const items = [
    { icon: FileImage, label: 'Фото или видео', onClick: onSelectImage, color: 'from-blue-500 to-sky-500' },
    { icon: FileText, label: 'Файл', onClick: onSelectFile, color: 'from-zinc-500 to-zinc-600' },
    { icon: Camera, label: 'Камера', onClick: onSelectCamera, color: 'from-purple-500 to-pink-500' },
    { icon: BarChart3, label: 'Опрос', onClick: onSelectPoll, color: 'from-orange-500 to-amber-500' },
    { icon: MapPin, label: 'Геолокация', onClick: onSelectLocation, color: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[320px] max-w-[calc(100%-32px)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Прикрепить</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Menu items */}
          <div className="p-2 grid grid-cols-2 gap-1.5">
            {items.map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left group"
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform`}>
                  <item.icon size={18} />
                </div>
                <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
