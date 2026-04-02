// Nexo App Configuration
// Change this to your server URL
export const API_URL = 'https://твоё-приложение.onrender.com';

// For development use localhost
// export const API_URL = 'http://localhost:3001';

// Socket.io configuration
export const SOCKET_CONFIG = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

// App settings
export const APP_CONFIG = {
  name: 'Nexo Messenger',
  version: '1.0.0',
  maxFileSize: 25 * 1024 * 1024 * 1024, // 25GB
  maxFilesPerMessage: 1200,
};
