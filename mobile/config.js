// Nexo App Configuration 
export const API_URL = 'http://localhost:5032'; 
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
