import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let connectAttempts = 0;
const MAX_CONNECT_ATTEMPS = 5;
const CONNECT_TIMEOUT = 10000; // 10 seconds

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

  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_CONNECT_ATTEMPS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: CONNECT_TIMEOUT,
    forceNew: false,
  });

  socket.on('connect', () => {
    console.log('✅ Socket подключён');
    connectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket отключён:', reason);
  });

  socket.on('connect_error', (err) => {
    connectAttempts++;
    console.error(`❌ Ошибка подключения Socket (${connectAttempts}/${MAX_CONNECT_ATTEMPS}):`, err.message);
    if (connectAttempts >= MAX_CONNECT_ATTEMPS) {
      console.error('Превышено количество попыток подключения, повтор через 30 сек...');
      setTimeout(() => {
        connectAttempts = 0;
        if (socket?.disconnected) {
          socket.connect();
        }
      }, 30000);
    }
  });

  socket.on('connect_timeout', () => {
    console.warn('⏱️ Превышено время подключения, повторная попытка...');
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
