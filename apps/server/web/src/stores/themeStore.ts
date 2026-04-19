import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';
export type ColorScheme = 'default' | 'blue' | 'purple' | 'green' | 'red' | 'orange';
export type FontSize = 'small' | 'medium' | 'large';
export type Density = 'compact' | 'comfortable' | 'spacious';

interface ChatBackground {
  chatId: string;
  type: 'color' | 'gradient' | 'image';
  value: string;
}

interface ThemeState {
  // Тема
  mode: ThemeMode;
  colorScheme: ColorScheme;
  
  // Шрифт
  fontSize: FontSize;
  
  // Плотность
  density: Density;
  
  // Фоны чатов
  chatBackgrounds: ChatBackground[];
  
  // Действия
  setMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setFontSize: (size: FontSize) => void;
  setDensity: (density: Density) => void;
  setChatBackground: (chatId: string, type: 'color' | 'gradient' | 'image', value: string) => void;
  removeChatBackground: (chatId: string) => void;
  getChatBackground: (chatId: string) => ChatBackground | undefined;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      colorScheme: 'default',
      fontSize: 'medium',
      density: 'comfortable',
      chatBackgrounds: [],

      setMode: (mode) => {
        set({ mode });
        applyTheme(mode, get().colorScheme, get().fontSize, get().density);
      },

      setColorScheme: (colorScheme) => {
        set({ colorScheme });
        applyTheme(get().mode, colorScheme, get().fontSize, get().density);
      },

      setFontSize: (fontSize) => {
        set({ fontSize });
        applyTheme(get().mode, get().colorScheme, fontSize, get().density);
      },

      setDensity: (density) => {
        set({ density });
        applyTheme(get().mode, get().colorScheme, get().fontSize, density);
      },

      setChatBackground: (chatId, type, value) => {
        set((state) => ({
          chatBackgrounds: [
            ...state.chatBackgrounds.filter((bg) => bg.chatId !== chatId),
            { chatId, type, value },
          ],
        }));
      },

      removeChatBackground: (chatId) => {
        set((state) => ({
          chatBackgrounds: state.chatBackgrounds.filter((bg) => bg.chatId !== chatId),
        }));
      },

      getChatBackground: (chatId) => {
        return get().chatBackgrounds.find((bg) => bg.chatId === chatId);
      },
    }),
    {
      name: 'nexo-theme',
    }
  )
);

// Применение темы к DOM
function applyTheme(mode: ThemeMode, colorScheme: ColorScheme, fontSize: FontSize, density: Density) {
  const root = document.documentElement;

  // Режим темы
  root.setAttribute('data-theme', mode);

  // Цветовая схема
  root.setAttribute('data-color-scheme', colorScheme);

  // Размер шрифта
  const fontSizes = {
    small: '14px',
    medium: '16px',
    large: '18px',
  };
  root.style.fontSize = fontSizes[fontSize];

  // Плотность
  const densities = {
    compact: '0.8',
    comfortable: '1',
    spacious: '1.2',
  };
  root.style.setProperty('--density', densities[density]);
}

// Инициализация темы при загрузке
if (typeof window !== 'undefined') {
  const state = useThemeStore.getState();
  applyTheme(state.mode, state.colorScheme, state.fontSize, state.density);
}
