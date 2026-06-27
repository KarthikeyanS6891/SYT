import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError } from 'axios';
import api, {
  tokenStorage,
  unwrap,
  errorMessage,
  TOKEN_KEY,
  REFRESH_KEY,
} from './api';

beforeEach(() => {
  localStorage.clear();
});

describe('tokenStorage', () => {
  it('exports the expected localStorage keys', () => {
    expect(TOKEN_KEY).toBe('syt:accessToken');
    expect(REFRESH_KEY).toBe('syt:refreshToken');
  });

  it('set() stores both access + refresh under the exported keys', () => {
    tokenStorage.set('access-1', 'refresh-1');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-1');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1');
  });

  it('getAccess/getRefresh read the stored values', () => {
    localStorage.setItem(TOKEN_KEY, 'a-token');
    localStorage.setItem(REFRESH_KEY, 'r-token');
    expect(tokenStorage.getAccess()).toBe('a-token');
    expect(tokenStorage.getRefresh()).toBe('r-token');
  });

  it('getAccess/getRefresh return null when nothing is stored', () => {
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it('setAccess() updates only the access token, leaving refresh untouched', () => {
    tokenStorage.set('access-1', 'refresh-1');
    tokenStorage.setAccess('access-2');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-2');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1');
  });

  it('clear() removes both tokens', () => {
    tokenStorage.set('access-1', 'refresh-1');
    tokenStorage.clear();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});

describe('unwrap', () => {
  it('flattens { data: { data, meta, message } } to { data, meta, message }', async () => {
    const meta = { page: 1, pages: 2, total: 20, limit: 12 };
    const promise = Promise.resolve({
      data: { data: [{ _id: 'x' }], meta, message: 'OK' },
    });
    const result = await unwrap(promise);
    expect(result).toEqual({ data: [{ _id: 'x' }], meta, message: 'OK' });
  });

  it('passes through an undefined meta', async () => {
    const promise = Promise.resolve({
      data: { data: { hello: 'world' }, message: 'done' },
    });
    const result = await unwrap(promise as any);
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.meta).toBeUndefined();
    expect(result.message).toBe('done');
  });

  it('rejects when the underlying promise rejects', async () => {
    const boom = new Error('network down');
    await expect(unwrap(Promise.reject(boom) as any)).rejects.toThrow('network down');
  });
});

describe('errorMessage', () => {
  it('returns err.response.data.message when present', () => {
    const err = {
      response: { data: { message: 'Email already in use' } },
      message: 'Request failed with status code 409',
    } as AxiosError<{ message?: string }>;
    expect(errorMessage(err)).toBe('Email already in use');
  });

  it('falls back to err.message when there is no response message', () => {
    const err = { message: 'Network Error' } as AxiosError;
    expect(errorMessage(err)).toBe('Network Error');
  });

  it('falls back to err.message when response exists but has no message', () => {
    const err = {
      response: { data: { details: [] } },
      message: 'Request failed with status code 500',
    } as AxiosError<{ message?: string; details?: any[] }>;
    expect(errorMessage(err)).toBe('Request failed with status code 500');
  });

  it('uses the default fallback string when nothing else is available', () => {
    expect(errorMessage({})).toBe('Something went wrong');
    expect(errorMessage(undefined)).toBe('Something went wrong');
    expect(errorMessage(null)).toBe('Something went wrong');
  });

  it('honours a custom fallback string', () => {
    expect(errorMessage({}, 'Could not load listings')).toBe('Could not load listings');
  });

  it('prefers response.data.message over the custom fallback', () => {
    const err = { response: { data: { message: 'Forbidden' } } } as AxiosError<{ message?: string }>;
    expect(errorMessage(err, 'fallback')).toBe('Forbidden');
  });
});

describe('request interceptor', () => {
  it('attaches a Bearer Authorization header when an access token is stored', async () => {
    localStorage.setItem(TOKEN_KEY, 'my-access-token');
    // Drive the real request interceptor and capture the outgoing config via a custom adapter.
    const adapter = vi.fn(async (config: any) => ({
      data: { data: { ok: true }, message: 'OK' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    const res = await api.get('/listings', { adapter });
    expect(adapter).toHaveBeenCalledTimes(1);
    const sentConfig = adapter.mock.calls[0][0] as any;
    expect(sentConfig.headers.Authorization).toBe('Bearer my-access-token');
    expect(res.data).toEqual({ data: { ok: true }, message: 'OK' });
  });

  it('does not attach an Authorization header when no token is stored', async () => {
    const adapter = vi.fn(async (config: any) => ({
      data: { data: {}, message: 'OK' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    await api.get('/categories', { adapter });
    const sentConfig = adapter.mock.calls[0][0] as any;
    expect(sentConfig.headers.Authorization).toBeUndefined();
  });
});

describe('response interceptor (401 handling)', () => {
  let logoutSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logoutSpy = vi.fn();
    window.addEventListener('auth:logout', logoutSpy);
  });

  afterEach(() => {
    window.removeEventListener('auth:logout', logoutSpy);
  });

  const reject401 = (url: string) =>
    vi.fn(async (config: any) => {
      const err: any = new Error('Request failed with status code 401');
      err.config = config;
      err.response = { status: 401, data: { message: 'Unauthorized' }, headers: {}, config };
      err.isAxiosError = true;
      throw err;
    });

  it('on a 401 with no stored refresh token: clears storage and dispatches auth:logout', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-access');
    // No refresh token stored -> refreshAccess() returns null without any network call.
    const adapter = reject401('/listings');

    await expect(api.get('/listings', { adapter })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT attempt refresh / logout for a 401 on an /auth/ request', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-access');
    localStorage.setItem(REFRESH_KEY, 'stale-refresh');
    const adapter = reject401('/auth/login');

    await expect(api.post('/auth/login', {}, { adapter })).rejects.toMatchObject({
      response: { status: 401 },
    });

    // /auth/ requests are skipped: storage untouched, no logout event.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('stale-access');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('stale-refresh');
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-401 error without touching storage or dispatching logout', async () => {
    localStorage.setItem(TOKEN_KEY, 'keep-access');
    localStorage.setItem(REFRESH_KEY, 'keep-refresh');
    const adapter = vi.fn(async (config: any) => {
      const err: any = new Error('Request failed with status code 500');
      err.config = config;
      err.response = { status: 500, data: { message: 'Server error' }, headers: {}, config };
      err.isAxiosError = true;
      throw err;
    });

    await expect(api.get('/listings', { adapter })).rejects.toMatchObject({
      response: { status: 500 },
    });

    expect(localStorage.getItem(TOKEN_KEY)).toBe('keep-access');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('keep-refresh');
    expect(logoutSpy).not.toHaveBeenCalled();
  });
});
