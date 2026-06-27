import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep the REAL unwrap/errorMessage/tokenStorage, but replace the default
// axios instance with a stub whose methods we can assert against.
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
import { listingApi, categoryApi } from '@/services/listingService';
import { authApi } from '@/services/authService';
import { favoriteApi } from '@/services/favoriteService';
import { messageApi } from '@/services/messageService';
import { searchApi } from '@/services/searchService';
import { uploadApi } from '@/services/uploadService';
import { userApi } from '@/services/userService';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// The shape the real `unwrap` expects: an axios-like response whose `.data`
// is the API envelope { data, meta, message }.
const envelope = (data: any = {}, meta: any = { page: 1 }, message = 'OK') => ({
  data: { data, meta, message },
});

// Make every verb resolve to a valid envelope by default so unwrap never throws.
const resolveAll = () => {
  mockApi.get.mockResolvedValue(envelope());
  mockApi.post.mockResolvedValue(envelope());
  mockApi.patch.mockResolvedValue(envelope());
  mockApi.delete.mockResolvedValue(envelope());
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAll();
});

describe('listingApi', () => {
  it('list() -> GET /listings with filters as params', async () => {
    await listingApi.list({ category: 'cat-1' });
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/listings', {
      params: { category: 'cat-1' },
    });
  });

  it('list() defaults to empty params object', async () => {
    await listingApi.list();
    expect(mockApi.get).toHaveBeenCalledWith('/listings', { params: {} });
  });

  it('mine() -> GET /listings/mine with params', async () => {
    await listingApi.mine({ status: 'published', page: 2, limit: 10 });
    expect(mockApi.get).toHaveBeenCalledWith('/listings/mine', {
      params: { status: 'published', page: 2, limit: 10 },
    });
  });

  it('get(id) -> GET /listings/:id', async () => {
    await listingApi.get('abc');
    expect(mockApi.get).toHaveBeenCalledWith('/listings/abc');
  });

  it('similar(id) -> GET /listings/:id/similar', async () => {
    await listingApi.similar('abc');
    expect(mockApi.get).toHaveBeenCalledWith('/listings/abc/similar');
  });

  it('create(payload) -> POST /listings with body', async () => {
    const payload = { category: 'cat-1', images: [{ url: 'u', key: 'k' }], title: 'X' } as any;
    await listingApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/listings', payload);
  });

  it('update(id, payload) -> PATCH /listings/:id with body', async () => {
    const payload = { title: 'New', latitude: null, longitude: null } as any;
    await listingApi.update('abc', payload);
    expect(mockApi.patch).toHaveBeenCalledWith('/listings/abc', payload);
  });

  it('remove(id) -> DELETE /listings/:id', async () => {
    await listingApi.remove('abc');
    expect(mockApi.delete).toHaveBeenCalledWith('/listings/abc');
  });

  it('toggleBoost(id) -> POST /listings/:id/boost (no body)', async () => {
    await listingApi.toggleBoost('abc');
    expect(mockApi.post).toHaveBeenCalledWith('/listings/abc/boost');
  });

  it('returns the unwrapped { data, meta, message }', async () => {
    const listing = { _id: 'abc' };
    mockApi.get.mockResolvedValueOnce(envelope({ listing, isFavorite: true }, { page: 1 }, 'fetched'));
    const res = await listingApi.get('abc');
    expect(res).toEqual({
      data: { listing, isFavorite: true },
      meta: { page: 1 },
      message: 'fetched',
    });
  });
});

describe('categoryApi', () => {
  it('list() -> GET /categories', async () => {
    await categoryApi.list();
    expect(mockApi.get).toHaveBeenCalledWith('/categories');
  });

  it('returns the unwrapped envelope', async () => {
    const items = [{ _id: 'c1', name: 'Electronics' }];
    mockApi.get.mockResolvedValueOnce(envelope({ items }, { total: 1 }, 'OK'));
    const res = await categoryApi.list();
    expect(res.data).toEqual({ items });
    expect(res.meta).toEqual({ total: 1 });
    expect(res.message).toBe('OK');
  });
});

describe('authApi', () => {
  it('register() -> POST /auth/register with body', async () => {
    const payload = { name: 'A', email: 'a@b.com', password: 'pw' };
    await authApi.register(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', payload);
  });

  it('login() -> POST /auth/login with body', async () => {
    const payload = { email: 'a@b.com', password: 'pw' };
    await authApi.login(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', payload);
  });

  it('googleLogin() -> POST /auth/google with { credential }', async () => {
    await authApi.googleLogin('cred-123');
    expect(mockApi.post).toHaveBeenCalledWith('/auth/google', { credential: 'cred-123' });
  });

  it('me() -> GET /auth/me', async () => {
    await authApi.me();
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
  });

  it('logout(token) -> POST /auth/logout with { refreshToken }', async () => {
    await authApi.logout('refresh-tok');
    expect(mockApi.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-tok' });
  });

  it('login returns the unwrapped auth response', async () => {
    const auth = { user: { _id: 'u1' }, accessToken: 'a', refreshToken: 'r' };
    mockApi.post.mockResolvedValueOnce(envelope(auth, {}, 'Logged in'));
    const res = await authApi.login({ email: 'a@b.com', password: 'pw' });
    expect(res.data).toEqual(auth);
    expect(res.message).toBe('Logged in');
  });
});

describe('favoriteApi', () => {
  it('list() -> GET /favorites with params', async () => {
    await favoriteApi.list({ page: 1, limit: 12 });
    expect(mockApi.get).toHaveBeenCalledWith('/favorites', { params: { page: 1, limit: 12 } });
  });

  it('list() defaults params to {}', async () => {
    await favoriteApi.list();
    expect(mockApi.get).toHaveBeenCalledWith('/favorites', { params: {} });
  });

  it('add(id) -> POST /favorites/:id (no body)', async () => {
    await favoriteApi.add('lst-1');
    expect(mockApi.post).toHaveBeenCalledWith('/favorites/lst-1');
  });

  it('remove(id) -> DELETE /favorites/:id', async () => {
    await favoriteApi.remove('lst-1');
    expect(mockApi.delete).toHaveBeenCalledWith('/favorites/lst-1');
  });
});

describe('messageApi', () => {
  it('conversations() -> GET /messages/conversations', async () => {
    await messageApi.conversations();
    expect(mockApi.get).toHaveBeenCalledWith('/messages/conversations');
  });

  it('start() -> POST /messages/conversations with body', async () => {
    const payload = { listingId: 'lst-1', message: 'hi' };
    await messageApi.start(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/messages/conversations', payload);
  });

  it('messages(id) -> GET /messages/conversations/:id with params', async () => {
    await messageApi.messages('conv-1', { page: 2 });
    expect(mockApi.get).toHaveBeenCalledWith('/messages/conversations/conv-1', {
      params: { page: 2 },
    });
  });

  it('messages(id) defaults params to {}', async () => {
    await messageApi.messages('conv-1');
    expect(mockApi.get).toHaveBeenCalledWith('/messages/conversations/conv-1', { params: {} });
  });

  it('send(id, body) -> POST .../messages with { body }', async () => {
    await messageApi.send('conv-1', 'hello there');
    expect(mockApi.post).toHaveBeenCalledWith('/messages/conversations/conv-1/messages', {
      body: 'hello there',
    });
  });

  it('markRead(id) -> POST .../read (no body)', async () => {
    await messageApi.markRead('conv-1');
    expect(mockApi.post).toHaveBeenCalledWith('/messages/conversations/conv-1/read');
  });
});

describe('searchApi', () => {
  it('suggest(q) -> GET /search/suggest with { q, limit } default limit 6', async () => {
    await searchApi.suggest('phone');
    expect(mockApi.get).toHaveBeenCalledWith('/search/suggest', {
      params: { q: 'phone', limit: 6 },
    });
  });

  it('suggest(q, limit) honours a custom limit', async () => {
    await searchApi.suggest('phone', 3);
    expect(mockApi.get).toHaveBeenCalledWith('/search/suggest', {
      params: { q: 'phone', limit: 3 },
    });
  });
});

describe('userApi', () => {
  it('getPublicProfile(id) -> GET /users/:id', async () => {
    await userApi.getPublicProfile('u1');
    expect(mockApi.get).toHaveBeenCalledWith('/users/u1');
  });
});

describe('uploadApi', () => {
  it('images(files) -> POST /uploads/images with FormData + multipart header', async () => {
    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });
    await uploadApi.images([fileA, fileB]);

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const [url, fd, config] = mockApi.post.mock.calls[0];
    expect(url).toBe('/uploads/images');
    expect(fd).toBeInstanceOf(FormData);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });

  it('appends every file under the "images" field', async () => {
    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });
    await uploadApi.images([fileA, fileB]);

    const fd = mockApi.post.mock.calls[0][1] as FormData;
    const appended = fd.getAll('images');
    expect(appended).toHaveLength(2);
    expect((appended[0] as File).name).toBe('a.png');
    expect((appended[1] as File).name).toBe('b.png');
  });

  it('returns the unwrapped { data } with uploaded images', async () => {
    const images = [{ url: 'http://x/a.png', key: 'a.png' }];
    mockApi.post.mockResolvedValueOnce(envelope({ images }, {}, 'uploaded'));
    const res = await uploadApi.images([new File(['a'], 'a.png')]);
    expect(res.data).toEqual({ images });
    expect(res.message).toBe('uploaded');
  });
});
