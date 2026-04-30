import { messageService } from '../services/messageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success, created } from '../utils/response.js';

export const startConversation = asyncHandler(async (req, res) => {
  const data = await messageService.startOrSend({
    buyerId: req.user._id,
    listingId: req.body.listingId,
    body: req.body.message,
  });
  created(res, data, 'Message sent');
});

export const sendMessage = asyncHandler(async (req, res) => {
  const message = await messageService.send({
    conversationId: req.params.id,
    senderId: req.user._id,
    body: req.body.body,
  });
  created(res, { message }, 'Message sent');
});

export const listConversations = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const items = await messageService.listConversations(req.user._id, { page, limit });
  success(res, { items });
});

export const getMessages = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const data = await messageService.getMessages({
    conversationId: req.params.id,
    userId: req.user._id,
    page,
    limit,
  });
  success(res, data);
});

export const markRead = asyncHandler(async (req, res) => {
  const data = await messageService.markRead({
    conversationId: req.params.id,
    userId: req.user._id,
  });
  success(res, data);
});
