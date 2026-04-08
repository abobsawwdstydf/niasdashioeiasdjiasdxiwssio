import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

let socket: Socket | null = null;
let connectAttempts = 0;
const MAX_CONNECT_ATTEMPTS = 10;
const CONNECT_TIMEOUT = 30000; // 30 seconds for Render.com cold starts

// Get socket URL - use API_URL for mobile/desktop, relative for web
const getSocketUrl = () => {
  if (typeof window === 'undefined') return API_URL;
  // For mobile/desktop apps or production, use API_URL
  if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168')) {
    return API_URL;
  }
  // For local development, use current origin
  return window.location.origin;
};

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  // Clean up old socket instance if it exists
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: { token },
    transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
    reconnection: true,
    reconnectionAttempts: MAX_CONNECT_ATTEMPTS,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: CONNECT_TIMEOUT,
    forceNew: true,
    upgrade: true,
  });

  socket.on('connect', () => {
    connectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, try to reconnect
      socket?.connect();
    }
  });

  socket.on('connect_error', (err) => {
    connectAttempts++;
    if (connectAttempts <= 3) {
      // Only log first few attempts to avoid console spam
    }
    if (connectAttempts >= MAX_CONNECT_ATTEMPTS) {
      setTimeout(() => {
        connectAttempts = 0;
        if (socket?.disconnected) {
          socket.connect();
        }
      }, 60000); // Wait 1 minute before retrying
    }
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
