import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  makeUser,
  makeCategory,
  makeListing,
  authedState,
  screen,
  within,
  waitFor,
  fireEvent,
  userEvent,
} from '@/test/utils';

// ---------------------------------------------------------------------------
// Shared module mocks
// ---------------------------------------------------------------------------

// react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

// messageService (used by Chat)
vi.mock('@/services/messageService', () => ({
  messageApi: {
    conversations: vi.fn(),
    start: vi.fn(),
    messages: vi.fn(),
    send: vi.fn(),
    markRead: vi.fn(),
  },
}));
import { messageApi } from '@/services/messageService';

// socket (used by Chat) — return a stable fake socket with on/off/emit
const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};
vi.mock('@/services/socket', () => ({
  getSocket: vi.fn(() => fakeSocket),
  disconnectSocket: vi.fn(),
  reconnectSocketWithToken: vi.fn(() => fakeSocket),
}));
import { getSocket } from '@/services/socket';

// listingService (used by AdminDashboard)
vi.mock('@/services/listingService', () => ({
  listingApi: {
    list: vi.fn(),
    get: vi.fn(),
    similar: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleBoost: vi.fn(),
  },
  categoryApi: { list: vi.fn() },
}));
import { listingApi } from '@/services/listingService';

// api.ts — keep the real unwrap/errorMessage but stub the axios instance so
// AdminDashboard's direct api.get / api.patch calls hit our fakes.
vi.mock('@/services/api', async (orig) => {
  const actual: any = await orig();
  const api: any = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return { ...actual, default: api };
});
import api from '@/services/api';

import Chat from './Chat';
import AdminDashboard from './AdminDashboard';
import { CategoryMegaMenu } from '@/components/listings/CategoryMegaMenu';

// Helper: an axios-shaped response that unwrap() can peel: r.data.data, etc.
const apiResp = <T,>(data: T, message = 'OK', meta: any = null) => ({
  data: { data, meta, message },
});

beforeEach(() => {
  fakeSocket.on.mockReset();
  fakeSocket.off.mockReset();
  fakeSocket.emit.mockReset();
});

// ===========================================================================
// Chat
// ===========================================================================
describe('Chat', () => {
  const me = makeUser({ _id: 'me', name: 'Me' });
  const other = makeUser({ _id: 'other', name: 'Alice' });

  const listing = makeListing({
    _id: 'lst1',
    title: 'Vintage Camera',
    price: 5000,
    images: [{ url: 'http://example.com/cam.jpg', key: 'cam.jpg' }],
  });

  const convo = {
    _id: 'c1',
    listing,
    participants: [me, other],
    lastMessage: null,
    lastMessageAt: new Date('2024-01-01').toISOString(),
    unread: { me: 2 },
  };

  const messages = [
    {
      _id: 'm1',
      conversation: 'c1',
      sender: other,
      body: 'Is this still available?',
      readBy: [],
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    },
    {
      _id: 'm2',
      conversation: 'c1',
      sender: me,
      body: 'Yes it is!',
      readBy: [],
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    },
  ];

  beforeEach(() => {
    (messageApi.conversations as any).mockResolvedValue({
      data: { items: [convo] },
      meta: null,
      message: 'OK',
    });
    (messageApi.messages as any).mockResolvedValue({
      data: { conversation: convo, items: messages },
      meta: null,
      message: 'OK',
    });
  });

  it('shows a loader then renders the conversation list', async () => {
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat',
    });

    // conversation list shows the other participant + listing title
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Vintage Camera')).toBeInTheDocument();
    expect(messageApi.conversations).toHaveBeenCalled();
  });

  it('shows an empty-state prompt when no conversation is selected', async () => {
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat',
    });

    expect(
      await screen.findByText(/select a conversation to start chatting/i)
    ).toBeInTheDocument();
  });

  it('renders messages for the active conversation id', async () => {
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat/c1',
      path: '/chat/:id',
    });

    expect(await screen.findByText('Is this still available?')).toBeInTheDocument();
    expect(screen.getByText('Yes it is!')).toBeInTheDocument();
    // header reflects active conversation listing
    expect(screen.getAllByText('Vintage Camera').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/with Alice/i)).toBeInTheDocument();
    expect(messageApi.messages).toHaveBeenCalledWith('c1');
  });

  it('sending a message emits chat:send over the socket and clears the draft', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat/c1',
      path: '/chat/:id',
    });

    const input = await screen.findByPlaceholderText('Type a message');
    await user.type(input, 'Hello there');

    const sendBtn = screen.getByRole('button', { name: 'Send' });
    expect(sendBtn).not.toBeDisabled();
    await user.click(sendBtn);

    // NOTE: Chat sends via the socket (getSocket().emit('chat:send', ...)),
    // NOT via messageApi.send. Assert the actual behavior.
    expect(getSocket).toHaveBeenCalled();
    const sendCall = fakeSocket.emit.mock.calls.find((c) => c[0] === 'chat:send');
    expect(sendCall).toBeTruthy();
    expect(sendCall![1]).toEqual({ conversationId: 'c1', body: 'Hello there' });
    expect(messageApi.send).not.toHaveBeenCalled();

    // draft cleared
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('Send button is disabled when the draft is empty', async () => {
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat/c1',
      path: '/chat/:id',
    });

    const sendBtn = await screen.findByRole('button', { name: 'Send' });
    expect(sendBtn).toBeDisabled();
  });

  it('subscribes to socket chat events and joins the room for the active id', async () => {
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat/c1',
      path: '/chat/:id',
    });

    await screen.findByText('Is this still available?');
    const events = fakeSocket.on.mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining(['chat:message', 'chat:notify', 'chat:typing'])
    );
    const joinCall = fakeSocket.emit.mock.calls.find((c) => c[0] === 'chat:join');
    expect(joinCall).toBeTruthy();
    expect(joinCall![1]).toEqual({ conversationId: 'c1' });
  });

  it('shows an error toast and stops loading when conversations fail', async () => {
    (messageApi.conversations as any).mockRejectedValue(
      new Error('network down')
    );
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat',
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('network down')
    );
    expect(await screen.findByText(/no conversations yet/i)).toBeInTheDocument();
  });

  it('typing in the input emits a chat:typing event', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat/c1',
      path: '/chat/:id',
    });

    const input = await screen.findByPlaceholderText('Type a message');
    await user.type(input, 'H');

    const typingCall = fakeSocket.emit.mock.calls.find(
      (c) => c[0] === 'chat:typing'
    );
    expect(typingCall).toBeTruthy();
    expect(typingCall![1]).toMatchObject({ conversationId: 'c1', isTyping: true });
  });

  it('does not emit a stale chat:typing(false) after the component unmounts (regression: pending timer left running)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderWithProviders(<Chat />, {
      preloadedState: authedState({ _id: 'me', name: 'Me' }),
      route: '/chat/c1',
      path: '/chat/:id',
    });

    const input = await screen.findByPlaceholderText('Type a message');
    await user.type(input, 'H');
    fakeSocket.emit.mockClear();

    unmount();
    vi.advanceTimersByTime(2000);

    const staleTypingCall = fakeSocket.emit.mock.calls.find((c) => c[0] === 'chat:typing');
    expect(staleTypingCall).toBeUndefined();
    vi.useRealTimers();
  });
});

// ===========================================================================
// AdminDashboard
// ===========================================================================
describe('AdminDashboard', () => {
  const stats = { users: 12, listings: 30, published: 25, disabled: 5 };

  const adminListing = makeListing({
    _id: 'al1',
    title: 'Admin Listing',
    status: 'published',
    location: 'Mumbai',
  });

  const adminUsers = [
    makeUser({ _id: 'u1', name: 'Bob', email: 'bob@x.com', role: 'user' }),
    makeUser({
      _id: 'u2',
      name: 'Carol',
      email: 'carol@x.com',
      role: 'user',
      disabled: true,
    }),
  ];

  beforeEach(() => {
    // api.get is dispatched by URL
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/admin/stats') return Promise.resolve(apiResp(stats));
      if (url === '/admin/users')
        return Promise.resolve(apiResp({ items: adminUsers }));
      return Promise.resolve(apiResp({}));
    });
    (api.patch as any).mockResolvedValue(apiResp({}));
    (listingApi.list as any).mockResolvedValue({
      data: { items: [adminListing] },
      meta: { page: 1, pages: 1, total: 1, limit: 50 },
      message: 'OK',
    });
  });

  it('renders the stats cards from the admin stats endpoint', async () => {
    renderWithProviders(<AdminDashboard />, {
      preloadedState: authedState({ role: 'admin', name: 'A' }),
    });

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument(); // users
    expect(screen.getByText('30')).toBeInTheDocument(); // listings
    expect(screen.getByText('25')).toBeInTheDocument(); // published
    expect(screen.getByText('5')).toBeInTheDocument(); // disabled
    expect(api.get).toHaveBeenCalledWith('/admin/stats');
  });

  it('loads and renders listings in the default Listings tab', async () => {
    renderWithProviders(<AdminDashboard />, {
      preloadedState: authedState({ role: 'admin' }),
    });

    expect(await screen.findByText('Admin Listing')).toBeInTheDocument();
    expect(listingApi.list).toHaveBeenCalledWith({ limit: 50, sort: 'latest' });
    // status badge
    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('switching to the Users tab loads and renders users', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />, {
      preloadedState: authedState({ role: 'admin' }),
    });

    await screen.findByText('Admin Listing');
    await user.click(screen.getByRole('button', { name: 'Users' }));

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/users', {
      params: { q: '', limit: 50 },
    });
    // active/disabled badges (note: "Disabled" also appears as a stats-card
    // label, so scope the badge assertion to the badge class)
    expect(screen.getByText('Active')).toBeInTheDocument();
    const disabledBadge = document.querySelector('.badge.warn');
    expect(disabledBadge).toHaveTextContent('Disabled');
  });

  it('disabling a listing patches the admin status endpoint and toasts success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />, {
      preloadedState: authedState({ role: 'admin' }),
    });

    await screen.findByText('Admin Listing');
    await user.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/listings/al1/status', {
        status: 'disabled',
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Listing updated');
  });

  it('enabling a disabled user patches the admin user endpoint', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />, {
      preloadedState: authedState({ role: 'admin' }),
    });

    await screen.findByText('Admin Listing');
    await user.click(screen.getByRole('button', { name: 'Users' }));
    await screen.findByText('Carol');

    // Carol is disabled -> shows an "Enable" button
    await user.click(screen.getByRole('button', { name: 'Enable' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/users/u2', {
        disabled: false,
      })
    );
    expect(toast.success).toHaveBeenCalledWith('User enabled');
  });

  it('shows an error toast when stats fail to load', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/admin/stats') return Promise.reject(new Error('boom'));
      if (url === '/admin/users')
        return Promise.resolve(apiResp({ items: adminUsers }));
      return Promise.resolve(apiResp({}));
    });
    renderWithProviders(<AdminDashboard />, {
      preloadedState: authedState({ role: 'admin' }),
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
    // dashes shown when stats are null
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});

// ===========================================================================
// CategoryMegaMenu
// ===========================================================================
describe('CategoryMegaMenu', () => {
  // parents + children + quick-pick slugs
  const cars = makeCategory({ _id: 'cars', name: 'Cars', slug: 'cars', order: 0 });
  const mobiles = makeCategory({
    _id: 'mob',
    name: 'Mobile Phones',
    slug: 'mobile-phones',
    order: 1,
  });
  const electronics = makeCategory({
    _id: 'elec',
    name: 'Electronics',
    slug: 'electronics',
    order: 2,
  });
  const tvs = makeCategory({
    _id: 'tvs',
    name: 'TVs',
    slug: 'tvs-video-audio',
    parent: 'elec',
    order: 0,
  });

  const categories = [cars, mobiles, electronics, tvs];

  it('renders quick-pick pills for known slugs', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <CategoryMegaMenu categories={categories} onSelect={onSelect} />
    );

    expect(screen.getByText('ALL CATEGORIES')).toBeInTheDocument();
    // quick picks: cars, mobile-phones, tvs-video-audio are present in fixtures
    expect(screen.getByRole('button', { name: 'Cars' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mobile Phones' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TVs' })).toBeInTheDocument();
  });

  it('clicking a quick-pick pill selects that category', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CategoryMegaMenu categories={categories} onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: 'Cars' }));
    expect(onSelect).toHaveBeenCalledWith('cars');
  });

  it('clicking the already-selected pill deselects it (passes undefined)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CategoryMegaMenu
        categories={categories}
        selectedCategory="cars"
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cars' }));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('opens the mega menu and shows parent groups + child categories', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CategoryMegaMenu categories={categories} onSelect={onSelect} />
    );

    // mega menu dialog not present until opened
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /all categories/i }));

    const dialog = await screen.findByRole('dialog', { name: /all categories/i });
    expect(dialog).toBeInTheDocument();
    // parent group title
    expect(within(dialog).getByText('Electronics')).toBeInTheDocument();
    // child under Electronics
    expect(within(dialog).getByText('TVs')).toBeInTheDocument();
  });

  it('selecting a parent group from the mega menu chooses it and closes the menu', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CategoryMegaMenu categories={categories} onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /all categories/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByText('Electronics'));

    expect(onSelect).toHaveBeenCalledWith('elec');
    // menu closes after a selection
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('selecting a child category from the mega menu chooses the child id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CategoryMegaMenu categories={categories} onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /all categories/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByText('TVs'));

    expect(onSelect).toHaveBeenCalledWith('tvs');
  });

  it('pressing Escape closes the open mega menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CategoryMegaMenu categories={categories} onSelect={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /all categories/i }));
    await screen.findByRole('dialog');

    // The Escape handler is a document-level listener; the resulting state
    // update emits an act() warning that is harmless here (test still passes).
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('renders nothing extra (no pills) when categories are empty', () => {
    renderWithProviders(<CategoryMegaMenu categories={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('ALL CATEGORIES')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cars' })).not.toBeInTheDocument();
  });
});
