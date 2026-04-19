import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Palette, Type, Layout, Image, Check } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

const COLOR_SCHEMES = [
  { id: 'default', name: 'Индиго', color: '#6366f1' },
  { id: 'blue', name: 'Синий', color: '#3b82f6' },
  { id: 'purple', name: 'Фиолетовый', color: '#a855f7' },
  { id: 'green', name: 'Зелёный', color: '#22c55e' },
  { id: 'red', name: 'Красный', color: '#ef4444' },
  { id: 'orange', name: 'Оранжевый', color: '#f97316' },
];

const BACKGROUNDS = [
  { id: 'default', name: 'По умолчанию', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'blue', name: 'Синий', preview: 'linear-gradient(135deg, #667eea 0%, #4c63d2 100%)' },
  { id: 'purple', name: 'Фиолетовый', preview: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' },
  { id: 'green', name: 'Зелёный', preview: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)' },
  { id: 'sunset', name: 'Закат', preview: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)' },
  { id: 'ocean', name: 'Океан', preview: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)' },
  { id: 'forest', name: 'Лес', preview: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { id: 'night', name: 'Ночь', preview: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
];

export default function ThemeSettings() {
  const { mode, colorScheme, fontSize, density, setMode, setColorScheme, setFontSize, setDensity } = useThemeStore();
  const [selectedBg, setSelectedBg] = useState('default');

  return (
    <div className="space-y-6">
      {/* Режим темы */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-nexo-500/20 flex items-center justify-center">
            {mode === 'dark' ? <Moon size={16} className="text-nexo-400" /> : <Sun size={16} className="text-nexo-400" />}
          </div>
          <h3 className="text-sm font-semibold text-white">Режим темы</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('dark')}
            className={`p-3 rounded-xl border transition-all ${
              mode === 'dark'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Moon size={20} className="mx-auto mb-1" />
            <div className="text-xs font-medium">Тёмная</div>
          </button>
          <button
            onClick={() => setMode('light')}
            className={`p-3 rounded-xl border transition-all ${
              mode === 'light'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sun size={20} className="mx-auto mb-1" />
            <div className="text-xs font-medium">Светлая</div>
          </button>
        </div>
      </div>

      {/* Цветовая схема */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-nexo-500/20 flex items-center justify-center">
            <Palette size={16} className="text-nexo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Цветовая схема</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => setColorScheme(scheme.id as any)}
              className={`p-3 rounded-xl border transition-all relative ${
                colorScheme === scheme.id
                  ? 'border-white/20'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              style={{
                backgroundColor: colorScheme === scheme.id ? scheme.color + '20' : undefined,
                borderColor: colorScheme === scheme.id ? scheme.color : undefined,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg mx-auto mb-1"
                style={{ backgroundColor: scheme.color }}
              />
              <div className="text-xs font-medium text-white">{scheme.name}</div>
              {colorScheme === scheme.id && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <Check size={12} style={{ color: scheme.color }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Размер шрифта */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-nexo-500/20 flex items-center justify-center">
            <Type size={16} className="text-nexo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Размер шрифта</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFontSize('small')}
            className={`p-3 rounded-xl border transition-all ${
              fontSize === 'small'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="text-xs font-medium mb-1">Маленький</div>
            <div className="text-[10px] text-zinc-500">14px</div>
          </button>
          <button
            onClick={() => setFontSize('medium')}
            className={`p-3 rounded-xl border transition-all ${
              fontSize === 'medium'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="text-xs font-medium mb-1">Средний</div>
            <div className="text-[10px] text-zinc-500">16px</div>
          </button>
          <button
            onClick={() => setFontSize('large')}
            className={`p-3 rounded-xl border transition-all ${
              fontSize === 'large'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="text-xs font-medium mb-1">Большой</div>
            <div className="text-[10px] text-zinc-500">18px</div>
          </button>
        </div>
      </div>

      {/* Плотность */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-nexo-500/20 flex items-center justify-center">
            <Layout size={16} className="text-nexo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Плотность интерфейса</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setDensity('compact')}
            className={`p-3 rounded-xl border transition-all ${
              density === 'compact'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="text-xs font-medium">Компактный</div>
          </button>
          <button
            onClick={() => setDensity('comfortable')}
            className={`p-3 rounded-xl border transition-all ${
              density === 'comfortable'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="text-xs font-medium">Комфортный</div>
          </button>
          <button
            onClick={() => setDensity('spacious')}
            className={`p-3 rounded-xl border transition-all ${
              density === 'spacious'
                ? 'bg-nexo-500/20 border-nexo-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="text-xs font-medium">Просторный</div>
          </button>
        </div>
      </div>

      {/* Фоны для чатов */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-nexo-500/20 flex items-center justify-center">
            <Image size={16} className="text-nexo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Фон для чатов</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setSelectedBg(bg.id)}
              className={`aspect-square rounded-xl border-2 transition-all relative overflow-hidden ${
                selectedBg === bg.id
                  ? 'border-nexo-500 scale-105'
                  : 'border-white/10 hover:border-white/20'
              }`}
              style={{ background: bg.preview }}
              title={bg.name}
            >
              {selectedBg === bg.id && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Check size={20} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Фон будет применён к текущему чату
        </p>
      </div>
    </div>
  );
}
