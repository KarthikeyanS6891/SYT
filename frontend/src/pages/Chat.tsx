import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { messageApi } from '@/services/messageService';
import { errorMessage } from '@/services/api';
import { getSocket } from '@/services/socket';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store';
import { setUnread } from '@/store/slices/uiSlice';
import { initials, timeAgo, formatPrice } from '@/utils/format';
import type { Conversation, Message } from '@/types';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  const refreshConversations = async () => {
    try {
      const { data } = await messageApi.conversations();
      setConversations(data.items);
      const total = data.items.reduce(
        (acc, c) => acc + (user ? Number((c.unread as any)?.[user._id] || 0) : 0),
        0
      );
      dispatch(setUnread(total));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) {
      setActiveConvo(null);
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    messageApi
      .messages(id)
      .then(({ data }) => {
        setActiveConvo(data.conversation);
        setMessages(data.items);
        refreshConversations();
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        navigate('/chat');
      })
      .finally(() => setLoadingMsgs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const socket = getSocket();

    const onMessage = ({ message }: { message: Message }) => {
      if (message.conversation === id) {
        setMessages((prev) => [...prev, message]);
        socket.emit('chat:read', { conversationId: id });
      }
      refreshConversations();
    };
    const onNotify = () => refreshConversations();
    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      if (userId !== user?._id) setOtherTyping(isTyping);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:notify', onNotify);
    socket.on('chat:typing', onTyping);

    if (id) socket.emit('chat:join', { conversationId: id });

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:notify', onNotify);
      socket.off('chat:typing', onTyping);
      if (id) socket.emit('chat:leave', { conversationId: id });
    };
  }, [id, user?._id]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onTypingChange = (val: string) => {
    setDraft(val);
    if (!id) return;
    const socket = getSocket();
    socket.emit('chat:typing', { conversationId: id, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      socket.emit('chat:typing', { conversationId: id, isTyping: false });
    }, 1500);
  };

  const send = async () => {
    if (!draft.trim() || !id) return;
    const socket = getSocket();
    socket.emit(
      'chat:send',
      { conversationId: id, body: draft.trim() },
      (resp: { ok: boolean; message?: Message; error?: string }) => {
        if (!resp?.ok) {
          toast.error(resp?.error || 'Could not send message');
        }
      }
    );
    setDraft('');
  };

  const otherParticipant = (c: Conversation) =>
    c.participants.find((p) => p._id !== user?._id);

  return (
    <div className="chat-shell">
      <div className="chat-list">
        {loadingList ? (
          <Loader />
        ) : conversations.length === 0 ? (
          <div className="empty-state text-sm">No conversations yet.</div>
        ) : (
          conversations.map((c) => {
            const other = otherParticipant(c);
            const unread = user ? Number((c.unread as any)?.[user._id] || 0) : 0;
            return (
              <div
                key={c._id}
                className={`item ${id === c._id ? 'active' : ''}`}
                onClick={() => navigate(`/chat/${c._id}`)}
              >
                <span
                  className="avatar"
                  style={other?.avatar ? { backgroundImage: `url(${other.avatar})` } : {}}
                >
                  {!other?.avatar && initials(other?.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between">
                    <span className="bold">{other?.name || 'User'}</span>
                    <span className="text-xs muted">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="text-xs muted" style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.listing?.title}
                  </div>
                  {unread > 0 && <span className="badge" style={{ marginTop: 4 }}>{unread}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-window">
        {!activeConvo ? (
          <div className="empty-state" style={{ flex: 1 }}>
            Select a conversation to start chatting.
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div
                style={{
                  width: 50, height: 38, borderRadius: 6, background: '#f3f4f6',
                  backgroundImage: activeConvo.listing.images?.[0]
                    ? `url(${activeConvo.listing.images[0].url})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}
              />
              <div style={{ flex: 1 }}>
                <div className="bold">{activeConvo.listing.title}</div>
                <div className="text-xs muted">
                  {formatPrice(activeConvo.listing.price)} ·
                  with {otherParticipant(activeConvo)?.name}
                </div>
              </div>
              <a className="btn ghost sm" href={`/listings/${activeConvo.listing._id}`}>View ad</a>
            </div>

            <div className="chat-messages" ref={messagesContainerRef}>
              {loadingMsgs ? <Loader inline /> : messages.map((m) => {
                const mine = m.sender._id === user?._id;
                return (
                  <div key={m._id} className={`bubble ${mine ? 'mine' : ''}`}>
                    {m.body}
                    <span className="time">{timeAgo(m.createdAt)}</span>
                  </div>
                );
              })}
              {otherTyping && (
                <div className="bubble" style={{ opacity: .7 }}>typing…</div>
              )}
            </div>

            <div className="chat-input">
              <input
                className="input"
                placeholder="Type a message"
                value={draft}
                onChange={(e) => onTypingChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <Button onClick={send} disabled={!draft.trim()}>Send</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
