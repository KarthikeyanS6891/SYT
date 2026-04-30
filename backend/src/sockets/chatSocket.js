import { messageService } from '../services/messageService.js';
import { Conversation } from '../models/Conversation.js';

const ensureParticipant = async (conversationId, userId) => {
  const convo = await Conversation.findById(conversationId).select('participants');
  if (!convo) return false;
  return convo.participants.some((p) => String(p) === String(userId));
};

export const registerChatHandlers = (io, socket) => {
  socket.on('chat:join', async ({ conversationId }, cb) => {
    try {
      const ok = await ensureParticipant(conversationId, socket.userId);
      if (!ok) return cb?.({ ok: false, error: 'Not a participant' });
      socket.join(`conversation:${conversationId}`);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('chat:leave', ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('chat:typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('chat:typing', {
      userId: socket.userId,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on('chat:send', async ({ conversationId, body }, cb) => {
    try {
      const message = await messageService.send({
        conversationId,
        senderId: socket.userId,
        body,
      });
      io.to(`conversation:${conversationId}`).emit('chat:message', { message });

      const convo = await Conversation.findById(conversationId).select('participants');
      convo?.participants.forEach((p) => {
        if (String(p) !== String(socket.userId)) {
          io.to(`user:${p}`).emit('chat:notify', {
            conversationId,
            message,
          });
        }
      });

      cb?.({ ok: true, message });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('chat:read', async ({ conversationId }, cb) => {
    try {
      await messageService.markRead({ conversationId, userId: socket.userId });
      socket.to(`conversation:${conversationId}`).emit('chat:read', {
        userId: socket.userId,
        conversationId,
      });
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });
};
