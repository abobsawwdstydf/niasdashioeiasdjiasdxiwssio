// Nexo App Configuration
// In production (same origin), use relative URLs
// In development, use localhost

// Get stored server URL or use default
const getStoredServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('nexo_server_url');
    if (stored) return stored;
  }
  return import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001');
};

export const API_URL = getStoredServerUrl();

export const setServerUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexo_server_url', url);
    // Reload to apply new URL
    window.location.reload();
  }
};

export const getServerUrl = (): string => {
  return getStoredServerUrl();
};

export const SOCKET_CONFIG = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

export const APP_CONFIG = {
  name: 'Nexo Messenger',
  version: '1.0.0',
  maxFileSize: 25 * 1024 * 1024 * 1024,
  maxFilesPerMessage: 1200,
};
