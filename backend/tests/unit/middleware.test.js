import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { query as q } from 'express-validator';
import supertest from 'supertest';

import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from '../../src/middleware/auth.js';
import { validate } from '../../src/middleware/validate.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { AppError } from '../../src/utils/AppError.js';
import { createUser, createAdmin, tokenFor } from '../helpers/index.js';

// --- helpers for unit-calling middleware directly ----------------------------

/** A bare fake response object; the unit-tested middlewares never touch it. */
const fakeRes = () => ({});

/** Run an async middleware and resolve once `next` has been invoked. */
const runMiddleware = (mw, req) =>
  new Promise((resolve) => {
    const next = vi.fn(() => resolve(next));
    const maybe = mw(req, fakeRes(), next);
    // optionalAuth/authenticate are async; if next wasn't called synchronously,
    // wait for the returned promise to settle then resolve with the spy.
    if (maybe && typeof maybe.then === 'function') {
      maybe.then(() => resolve(next));
    }
  });

// =============================================================================
// requireAdmin (synchronous)
// =============================================================================

describe('requireAdmin', () => {
  it('passes a 401 AppError to next when there is no req.user', () => {
    const next = vi.fn();
    requireAdmin({}, fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    // AppError.unauthorized() default message
    expect(err.message).toBe('Unauthorized');
  });

  it('passes a 403 AppError to next when the user is not an admin', () => {
    const next = vi.fn();
    requireAdmin({ user: { role: 'user' } }, fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Admin only');
  });

  it('calls next() with no argument for an admin user', () => {
    const next = vi.fn();
    requireAdmin({ user: { role: 'admin' } }, fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
    expect(next).toHaveBeenCalledWith();
  });
});

// =============================================================================
// optionalAuth (async, swallows errors)
// =============================================================================

describe('optionalAuth', () => {
  it('calls next() and leaves req.user undefined when no Authorization header', async () => {
    const req = { headers: {} };
    const next = await runMiddleware(optionalAuth, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error
    expect(req.user).toBeUndefined();
  });

  it('calls next() and leaves req.user undefined for an invalid token (error swallowed)', async () => {
    const req = { headers: { authorization: 'Bearer not.a.real.jwt' } };
    const next = await runMiddleware(optionalAuth, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('sets req.user for a valid token of an existing enabled user', async () => {
    const user = await createUser();
    const req = { headers: { authorization: `Bearer ${tokenFor(user)}` } };
    const next = await runMiddleware(optionalAuth, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user._id.toString()).toBe(user._id.toString());
    // password must never be attached (middleware selects -password)
    expect(req.user.password).toBeUndefined();
  });

  it('leaves req.user undefined for a valid token of a DISABLED user', async () => {
    const user = await createUser({ disabled: true });
    const req = { headers: { authorization: `Bearer ${tokenFor(user)}` } };
    const next = await runMiddleware(optionalAuth, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('leaves req.user undefined for a valid token whose user no longer exists', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const { User } = await import('../../src/models/User.js');
    await User.deleteOne({ _id: user._id });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = await runMiddleware(optionalAuth, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('ignores a header without the "Bearer " prefix and calls next()', async () => {
    const user = await createUser();
    // raw token, no "Bearer " => treated as no token
    const req = { headers: { authorization: tokenFor(user) } };
    const next = await runMiddleware(optionalAuth, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});

// =============================================================================
// authenticate (async)
// =============================================================================

describe('authenticate', () => {
  it('passes a 401 AppError to next for a header without the "Bearer " prefix', async () => {
    const user = await createUser();
    const req = { headers: { authorization: tokenFor(user) } }; // missing "Bearer "
    const next = await runMiddleware(authenticate, req);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/token missing/i);
    expect(req.user).toBeUndefined();
  });

  it('passes a 401 AppError to next when no Authorization header is present', async () => {
    const req = { headers: {} };
    const next = await runMiddleware(authenticate, req);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('sets req.user and calls next() with no error for a valid token', async () => {
    const user = await createUser();
    const req = { headers: { authorization: `Bearer ${tokenFor(user)}` } };
    const next = await runMiddleware(authenticate, req);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user._id.toString()).toBe(user._id.toString());
  });

  it('passes a 403 AppError to next for a disabled user', async () => {
    const user = await createUser({ disabled: true });
    const req = { headers: { authorization: `Bearer ${tokenFor(user)}` } };
    const next = await runMiddleware(authenticate, req);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch(/disabled/i);
  });

  it('passes a 401 AppError to next when the user no longer exists', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const { User } = await import('../../src/models/User.js');
    await User.deleteOne({ _id: user._id });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = await runMiddleware(authenticate, req);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/no longer exists/i);
  });

  it('forwards a JsonWebTokenError to next for a malformed token', async () => {
    const req = { headers: { authorization: 'Bearer not.a.jwt' } };
    const next = await runMiddleware(authenticate, req);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    // jwt.verify throws JsonWebTokenError, which errorHandler maps to 401
    expect(err.name).toBe('JsonWebTokenError');
  });
});

// =============================================================================
// validate (via an inline express app + supertest)
// =============================================================================

describe('validate', () => {
  const buildApp = () => {
    const app = express();
    app.get('/t', [q('x').isInt()], validate, (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    return app;
  };

  it('returns 400 with details (path, message) when validation fails', async () => {
    const res = await supertest(buildApp()).get('/t?x=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
    expect(res.body.details[0]).toHaveProperty('path', 'x');
    expect(res.body.details[0]).toHaveProperty('message');
    expect(typeof res.body.details[0].message).toBe('string');
  });

  it('passes through to the handler and returns 200 when validation succeeds', async () => {
    const res = await supertest(buildApp()).get('/t?x=5');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// =============================================================================
// errorHandler (via an inline express app + supertest)
// =============================================================================

describe('errorHandler', () => {
  /** Build an app whose single route throws `err` into next(). */
  const appThatThrows = (err) => {
    const app = express();
    app.get('/boom', (_req, _res, next) => next(err));
    app.use(errorHandler); // mounted LAST
    return supertest(app);
  };

  it('handles an AppError with custom status and details', async () => {
    const res = await appThatThrows(
      new AppError('m', 418, [{ path: 'a', message: 'b' }])
    ).get('/boom');

    expect(res.status).toBe(418);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('m');
    expect(res.body.details).toEqual([{ path: 'a', message: 'b' }]);
  });

  it('maps a mongoose-style ValidationError to 400 with details', async () => {
    const err = {
      name: 'ValidationError',
      errors: { f: { path: 'f', message: 'bad' } },
    };
    const res = await appThatThrows(err).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation error');
    expect(res.body.details).toEqual([{ path: 'f', message: 'bad' }]);
  });

  it('maps a CastError to 400 with an "Invalid <path>: <value>" message', async () => {
    const err = { name: 'CastError', path: 'id', value: 'x' };
    const res = await appThatThrows(err).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid id: x');
  });

  it('maps a duplicate-key (11000) error to 409', async () => {
    const err = { code: 11000, keyValue: { email: 'a' } };
    const res = await appThatThrows(err).get('/boom');

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Duplicate value for field: email/);
  });

  it('maps a LIMIT_FILE_SIZE multer error to 413', async () => {
    const res = await appThatThrows({ code: 'LIMIT_FILE_SIZE' }).get('/boom');

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/File too large/i);
  });

  it('maps a LIMIT_FILE_COUNT multer error to 400', async () => {
    const res = await appThatThrows({ code: 'LIMIT_FILE_COUNT' }).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Too many files/i);
  });

  it('maps a LIMIT_UNEXPECTED_FILE multer error to 400 with the field name', async () => {
    const res = await appThatThrows({
      code: 'LIMIT_UNEXPECTED_FILE',
      field: 'f',
    }).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unexpected file field: f');
  });

  it('maps a JsonWebTokenError to 401 "Invalid token"', async () => {
    const res = await appThatThrows({ name: 'JsonWebTokenError' }).get('/boom');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });

  it('maps a TokenExpiredError to 401 "Token expired"', async () => {
    const res = await appThatThrows({ name: 'TokenExpiredError' }).get('/boom');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token expired');
  });

  it('handles a plain Error with status 500', async () => {
    const res = await appThatThrows(new Error('boom')).get('/boom');

    expect(res.status).toBe(500);
    // err.message is truthy, so it is preserved; fallback is the generic string
    expect(['boom', 'Internal server error']).toContain(res.body.message);
    expect(res.body.success).toBe(false);
  });

  it('omits the stack in test mode (config.env === "test")', async () => {
    const res = await appThatThrows(new Error('boom')).get('/boom');
    // stack is only added when config.env === 'development'
    expect(res.body.stack).toBeUndefined();
  });
});
