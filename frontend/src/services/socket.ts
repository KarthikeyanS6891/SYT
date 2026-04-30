import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './api';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export const getSocket = (): Socket => {
  if (socket && socket.connected) return socket;
  socket = io(SOCKET_URL, {
    auth: { token: tokenStorage.getAccess() },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const reconnectSocketWithToken = () => {
  disconnectSocket();
  return getSocket();
};
