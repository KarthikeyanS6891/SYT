import { describe, it, expect } from 'vitest';
import { api, createUser, authFor } from '../helpers/index.js';
import { User } from '../../src/models/User.js';

describe('GET /users/me', () => {
  it('returns the current profile without password or refreshTokens', async () => {
    const user = await createUser({
      name: 'Profile Owner',
      phone: '+910000000000',
      location: 'Mumbai',
    });
    const res = await api().get('/api/v1/users/me').set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user._id).toBe(user._id.toString());
    expect(res.body.data.user.name).toBe('Profile Owner');
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshTokens).toBeUndefined();
  });

  it('rejects a missing token with 401', async () => {
    const res = await api().get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /users/me', () => {
  it('updates name, phone, location and avatar', async () => {
    const user = await createUser();
    const res = await api()
      .patch('/api/v1/users/me')
      .set(authFor(user))
      .send({
        name: 'New Name',
        phone: '+919999999999',
        location: 'Chennai',
        avatar: 'http://example.com/a.png',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile updated');
    expect(res.body.data.user.name).toBe('New Name');
    expect(res.body.data.user.phone).toBe('+919999999999');
    expect(res.body.data.user.location).toBe('Chennai');
    expect(res.body.data.user.avatar).toBe('http://example.com/a.png');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshTokens).toBeUndefined();
  });

  it('ignores disallowed fields like role and email', async () => {
    const user = await createUser({ role: 'user' });
    const originalEmail = user.email;
    const res = await api()
      .patch('/api/v1/users/me')
      .set(authFor(user))
      .send({
        name: 'Sanitized',
        role: 'admin',
        email: 'hacker@evil.com',
        disabled: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Sanitized');
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.user.email).toBe(originalEmail);
    expect(res.body.data.user.disabled).toBe(false);

    // confirm nothing leaked into the DB either
    const fresh = await User.findById(user._id);
    expect(fresh.role).toBe('user');
    expect(fresh.email).toBe(originalEmail);
    expect(fresh.disabled).toBe(false);
  });

  it('rejects a name shorter than 2 chars with 400', async () => {
    const user = await createUser();
    const res = await api()
      .patch('/api/v1/users/me')
      .set(authFor(user))
      .send({ name: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.some((d) => d.path === 'name')).toBe(true);
  });

  it('rejects a location longer than 120 chars with 400', async () => {
    const user = await createUser();
    const res = await api()
      .patch('/api/v1/users/me')
      .set(authFor(user))
      .send({ location: 'x'.repeat(121) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(res.body.details.some((d) => d.path === 'location')).toBe(true);
  });

  it('rejects a phone longer than 20 chars with 400', async () => {
    const user = await createUser();
    const res = await api()
      .patch('/api/v1/users/me')
      .set(authFor(user))
      .send({ phone: '1'.repeat(21) });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.path === 'phone')).toBe(true);
  });

  it('rejects a missing token with 401', async () => {
    const res = await api().patch('/api/v1/users/me').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });
});

describe('POST /users/me/password', () => {
  it('changes the password with the correct currentPassword and clears refreshTokens', async () => {
    const user = await createUser();
    // seed some refresh tokens to prove they get cleared
    await User.updateOne(
      { _id: user._id },
      { refreshTokens: ['tok-a', 'tok-b'] }
    );

    const res = await api()
      .post('/api/v1/users/me/password')
      .set(authFor(user))
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password changed');
    expect(res.body.data.ok).toBe(true);

    const fresh = await User.findById(user._id).select('+refreshTokens');
    expect(fresh.refreshTokens).toHaveLength(0);
  });

  it('lets the user log in with the new password and rejects the old one', async () => {
    const user = await createUser();
    const email = user.email;

    const change = await api()
      .post('/api/v1/users/me/password')
      .set(authFor(user))
      .send({ currentPassword: 'password123', newPassword: 'brandnewpass' });
    expect(change.status).toBe(200);

    const withNew = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'brandnewpass' });
    expect(withNew.status).toBe(200);
    expect(withNew.body.data.accessToken).toBeTruthy();

    const withOld = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    expect(withOld.status).toBe(401);
  });

  it('rejects with 400 (not a 500) for a Google-only account with no password set', async () => {
    const user = await createUser({ password: null, googleId: 'google-sub-123' });
    const res = await api()
      .post('/api/v1/users/me/password')
      .set(authFor(user))
      .send({ currentPassword: 'anything', newPassword: 'newpassword456' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no password set/i);
  });

  it('rejects a wrong currentPassword with 401', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/users/me/password')
      .set(authFor(user))
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/current password incorrect/i);
  });

  it('rejects a newPassword shorter than 6 chars with 400', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/users/me/password')
      .set(authFor(user))
      .send({ currentPassword: 'password123', newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(res.body.details.some((d) => d.path === 'newPassword')).toBe(true);
  });

  it('rejects a missing currentPassword with 400', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/users/me/password')
      .set(authFor(user))
      .send({ newPassword: 'newpassword456' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(res.body.details.some((d) => d.path === 'currentPassword')).toBe(true);
  });

  it('rejects a missing token with 401', async () => {
    const res = await api()
      .post('/api/v1/users/me/password')
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/:id (public profile)', () => {
  it('returns only public fields and no auth required', async () => {
    const user = await createUser({
      name: 'Public Person',
      avatar: 'http://example.com/p.png',
      location: 'Delhi',
      phone: '+910000000001',
    });

    const res = await api().get(`/api/v1/users/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const u = res.body.data.user;
    expect(u._id).toBe(user._id.toString());
    expect(u.name).toBe('Public Person');
    expect(u.avatar).toBe('http://example.com/p.png');
    expect(u.location).toBe('Delhi');
    expect(u.createdAt).toBeTruthy();

    // only the whitelisted public keys are present
    expect(Object.keys(u).sort()).toEqual(
      ['_id', 'avatar', 'createdAt', 'location', 'name'].sort()
    );
    expect(u.email).toBeUndefined();
    expect(u.phone).toBeUndefined();
    expect(u.role).toBeUndefined();
    expect(u.password).toBeUndefined();
    expect(u.refreshTokens).toBeUndefined();
  });

  it('returns 404 for a non-existent valid id', async () => {
    const res = await api().get('/api/v1/users/64b7f9a2f1c2a3b4c5d6e7f8');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('returns 404 for a disabled user', async () => {
    const user = await createUser({ disabled: true });
    const res = await api().get(`/api/v1/users/${user._id}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await api().get('/api/v1/users/not-a-valid-id');
    expect(res.status).toBe(400);
  });
});
