// Nexo App Configuration
export const API_URL = 'https://nexo-0hs3.onrender.com';
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
