import { describe, it, expect } from 'vitest';
import {
  api,
  createUser,
  authFor,
  tokenFor,
  refreshTokenFor,
} from '../helpers/index.js';
import { User } from '../../src/models/User.js';

const registerBody = (over = {}) => ({
  name: 'Jane Doe',
  email: `jane_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
  password: 'password123',
  ...over,
});

describe('POST /auth/register', () => {
  it('registers a user and returns tokens without leaking secrets', async () => {
    const body = registerBody({ phone: '+910000000000', location: 'Mumbai' });
    const res = await api().post('/api/v1/auth/register').send(body);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(body.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshTokens).toBeUndefined();
    expect(res.body.data.user.location).toBe('Mumbai');
  });

  it('stores the refresh token on the user', async () => {
    const body = registerBody();
    const res = await api().post('/api/v1/auth/register').send(body);
    const fresh = await User.findById(res.body.data.user._id).select('+refreshTokens');
    expect(fresh.refreshTokens).toContain(res.body.data.refreshToken);
  });

  it('rejects a duplicate email with 409', async () => {
    const body = registerBody();
    await api().post('/api/v1/auth/register').send(body);
    const res = await api().post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it.each([
    ['short name', { name: 'a' }],
    ['invalid email', { email: 'not-an-email' }],
    ['short password', { password: '123' }],
  ])('rejects %s with 400', async (_label, over) => {
    const res = await api().post('/api/v1/auth/register').send(registerBody(over));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const body = registerBody();
    await api().post('/api/v1/auth/register').send(body);

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(body.email);
  });

  it('rejects a wrong password with 401', async () => {
    const body = registerBody();
    await api().post('/api/v1/auth/register').send(body);
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('rejects a disabled account with 403', async () => {
    const body = registerBody();
    await api().post('/api/v1/auth/register').send(body);
    await User.updateOne({ email: body.email }, { disabled: true });
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/disabled/i);
  });

  it('rejects missing fields with 400', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  const register = () => api().post('/api/v1/auth/register').send(registerBody());

  it('rotates the refresh token', async () => {
    const reg = await register();
    const oldToken = reg.body.data.refreshToken;

    // JWT `iat` has 1-second granularity, so a token minted in the same second
    // with the same payload is byte-identical. Wait so rotation is observable
    // (mirrors real usage, where refresh happens long after issuance).
    await new Promise((r) => setTimeout(r, 1100));

    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: oldToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(oldToken);

    // old token is now revoked
    const reuse = await api().post('/api/v1/auth/refresh').send({ refreshToken: oldToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toMatch(/revoked/i);
  });

  it('rejects a malformed token with 401', async () => {
    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid refresh token/i);
  });

  it('rejects a valid token for a deleted user with 401', async () => {
    const user = await createUser();
    const token = refreshTokenFor(user);
    await User.deleteOne({ _id: user._id });
    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('rejects refresh for a disabled user with 403', async () => {
    const reg = await register();
    await User.updateOne({ _id: reg.body.data.user._id }, { disabled: true });
    const res = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.data.refreshToken });
    expect(res.status).toBe(403);
  });

  it('rejects a missing token with 400', async () => {
    const res = await api().post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout & /auth/logout-all', () => {
  it('logout removes a single refresh token', async () => {
    const reg = await api().post('/api/v1/auth/register').send(registerBody());
    const { user, accessToken, refreshToken } = reg.body.data;

    const res = await api()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(res.status).toBe(200);

    const fresh = await User.findById(user._id).select('+refreshTokens');
    expect(fresh.refreshTokens).not.toContain(refreshToken);
  });

  it('logout without a refresh token still succeeds', async () => {
    const user = await createUser();
    const res = await api().post('/api/v1/auth/logout').set(authFor(user)).send({});
    expect(res.status).toBe(200);
  });

  it('logout requires authentication', async () => {
    const res = await api().post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(401);
  });

  it('logout-all clears every refresh token', async () => {
    const reg = await api().post('/api/v1/auth/register').send(registerBody());
    const { user, accessToken } = reg.body.data;

    const res = await api()
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(200);

    const fresh = await User.findById(user._id).select('+refreshTokens');
    expect(fresh.refreshTokens).toHaveLength(0);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user', async () => {
    const user = await createUser({ name: 'Me Myself' });
    const res = await api().get('/api/v1/auth/me').set(authFor(user));
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Me Myself');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('rejects a missing token with 401', async () => {
    const res = await api().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/token missing/i);
  });

  it('rejects a malformed token with 401', async () => {
    const res = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('rejects a token whose user no longer exists with 401', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await User.deleteOne({ _id: user._id });
    const res = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no longer exists/i);
  });

  it('rejects a disabled user with 403', async () => {
    const user = await createUser({ disabled: true });
    const res = await api().get('/api/v1/auth/me').set(authFor(user));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/disabled/i);
  });
});

describe('POST /auth/google', () => {
  it('returns 400 when Google Sign-In is not configured', async () => {
    const res = await api().post('/api/v1/auth/google').send({ credential: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not configured/i);
  });
});
