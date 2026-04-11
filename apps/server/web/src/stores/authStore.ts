import { create } from 'zustand';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../lib/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    displayName?: string;
    phone: string;
    password: string;
    bio?: string;
    birthday?: string;
    avatar?: File;
  }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  loginWithToken: (token: string, user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('nexo_token'),
  user: null,
  isLoading: true,
  error: null,

  login: async (phone, password) => {
    try {
      set({ error: null, isLoading: true });
      const { token, user } = await api.login(phone, password);
      localStorage.setItem('nexo_token', token);
      api.setToken(token);
      connectSocket(token);
      set({ token, user, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    try {
      set({ error: null, isLoading: true });
      const { token, user } = await api.register(data);
      localStorage.setItem('nexo_token', token);
      api.setToken(token);
      connectSocket(token);
      set({ token, user, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('nexo_token');
    api.setToken(null);
    disconnectSocket();
    set({ token: null, user: null });
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false });
      return;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        api.setToken(token);
        const { user } = await api.getMe();
        connectSocket(token);
        set({ user, isLoading: false });
        return;
      } catch (err) {
        lastError = err;
        if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
          localStorage.removeItem('nexo_token');
          api.setToken(null);
          set({ token: null, user: null, isLoading: false });
          return;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    set({ isLoading: false, error: lastError instanceof Error ? lastError.message : 'Ошибка' });
  },

  updateUser: (data) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...data } });
    }
  },

  loginWithToken: (token, user) => {
    localStorage.setItem('nexo_token', token);
    api.setToken(token);
    connectSocket(token);
    set({ token, user });
  },
}));
