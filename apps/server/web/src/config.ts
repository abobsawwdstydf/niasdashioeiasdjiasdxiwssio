// Nexo App Configuration
// In production (same origin), use relative URLs
// In development, use localhost
export const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001');
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
