import { create } from 'zustand';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../lib/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string, bio?: string, birthday?: string) => Promise<void>;
  // Новые методы для авторизации по телефону
  loginByPhone: (phone: string, password: string) => Promise<{ require2FA?: boolean; availableMethods?: string[] }>;
  loginByPhone2FA: (phone: string, code: string) => Promise<void>;
  registerByPhone: (data: {
    phone: string;
    code: string;
    username: string;
    displayName: string;
    password: string;
    email?: string;
    bio?: string;
    birthday?: string;
  }) => Promise<{ required: boolean; token?: string }>;
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

  login: async (username, password) => {
    try {
      set({ error: null, isLoading: true });
      const { token, user } = await api.login(username, password);
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

  register: async (username, displayName, password, bio, birthday) => {
    try {
      set({ error: null, isLoading: true });
      const { token, user } = await api.register(username, displayName, password, bio);
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

  loginByPhone: async (phone, password) => {
    try {
      set({ error: null, isLoading: true });
      const result = await api.loginStart(phone, password);
      // Если 2FA не требуется — результат уже содержит токен
      if ('token' in result) {
        localStorage.setItem('nexo_token', result.token);
        api.setToken(result.token);
        connectSocket(result.token);
        set({ token: result.token, user: result.user, isLoading: false });
        return {};
      }
      // Требуется 2FA
      set({ isLoading: false });
      return { require2FA: true as const, availableMethods: (result as { require2FA: true; user: Omit<User, 'password'>; availableMethods: string[] }).availableMethods };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  loginByPhone2FA: async (phone, code) => {
    try {
      set({ error: null, isLoading: true });
      const { token, user } = await api.loginComplete2FA(phone, code);
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

  registerByPhone: async (data) => {
    try {
      set({ error: null, isLoading: true });
      const result = await api.registerComplete(data);
      localStorage.setItem('nexo_token', result.token);
      api.setToken(result.token);
      connectSocket(result.token);
      set({ token: result.token, user: result.user, isLoading: false });
      return result.emailVerification;
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

    // Retry up to 3 times in case server is still starting
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
        // Only retry on network/server errors, not on auth errors (401/403)
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Требуется авторизация') || msg.includes('Недействительный токен')) {
          break;
        }
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    console.warn('checkAuth failed:', lastError);
    localStorage.removeItem('nexo_token');
    set({ token: null, user: null, isLoading: false });
  },

  updateUser: (data) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, ...data } });
    }
  },

  loginWithToken: (token, user) => {
    localStorage.setItem('nexo_token', token);
    api.setToken(token);
    connectSocket(token);
    set({ token, user, isLoading: false });
  },
}));
