import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { config } from '../config/index.js';
import { registerChatHandlers } from './chatSocket.js';

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('No auth token'));
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.sub;
      socket.role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      // optional cleanup
    });
  });

  return io;
};
