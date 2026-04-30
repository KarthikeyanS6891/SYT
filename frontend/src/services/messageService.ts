import api, { unwrap } from './api';
import type { Conversation, Message } from '@/types';

export const messageApi = {
  conversations: () =>
    unwrap(api.get<{ data: { items: Conversation[] }; meta: any; message: string }>(
      '/messages/conversations'
    )),

  start: (payload: { listingId: string; message: string }) =>
    unwrap(api.post<{ data: { conversation: Conversation; message: Message }; meta: any; message: string }>(
      '/messages/conversations',
      payload
    )),

  messages: (id: string, params: { page?: number; limit?: number } = {}) =>
    unwrap(api.get<{ data: { conversation: Conversation; items: Message[] }; meta: any; message: string }>(
      `/messages/conversations/${id}`,
      { params }
    )),

  send: (id: string, body: string) =>
    unwrap(api.post<{ data: { message: Message }; meta: any; message: string }>(
      `/messages/conversations/${id}/messages`,
      { body }
    )),

  markRead: (id: string) =>
    unwrap(api.post<{ data: any; meta: any; message: string }>(
      `/messages/conversations/${id}/read`
    )),
};
