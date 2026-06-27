import { describe, it, expect, vi } from 'vitest';
import { AppError } from '../../src/utils/AppError.js';
import { success, created, noContent } from '../../src/utils/response.js';
import { asyncHandler } from '../../src/utils/asyncHandler.js';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../src/utils/jwt.js';

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------
describe('AppError', () => {
  it('is an instance of Error and AppError', () => {
    const err = new AppError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('sets message, statusCode, isOperational, and details from the constructor', () => {
    const details = [{ path: 'email', message: 'required' }];
    const err = new AppError('bad thing', 422, details);
    expect(err.message).toBe('bad thing');
    expect(err.statusCode).toBe(422);
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual(details);
  });

  it('defaults statusCode to 500 and details to undefined when omitted', () => {
    const err = new AppError('server error');
    expect(err.statusCode).toBe(500);
    expect(err.details).toBeUndefined();
    expect(err.isOperational).toBe(true);
  });

  it('captures a stack trace', () => {
    const err = new AppError('trace me');
    expect(typeof err.stack).toBe('string');
    expect(err.stack.length).toBeGreaterThan(0);
  });

  describe('static factories', () => {
    it('badRequest => 400 and carries details', () => {
      const details = [{ path: 'name', message: 'too short' }];
      const err = AppError.badRequest('Validation failed', details);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Validation failed');
      expect(err.details).toEqual(details);
      expect(err.isOperational).toBe(true);
    });

    it('badRequest uses a default message and undefined details when called bare', () => {
      const err = AppError.badRequest();
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Bad request');
      expect(err.details).toBeUndefined();
    });

    it('unauthorized => 401', () => {
      const err = AppError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Unauthorized');
      expect(err.details).toBeUndefined();
    });

    it('unauthorized accepts a custom message', () => {
      const err = AppError.unauthorized('Token missing');
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Token missing');
    });

    it('forbidden => 403', () => {
      const err = AppError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Forbidden');
    });

    it('notFound => 404', () => {
      const err = AppError.notFound();
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Not found');
    });

    it('conflict => 409', () => {
      const err = AppError.conflict();
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe('Conflict');
    });
  });
});

// ---------------------------------------------------------------------------
// response helpers
// ---------------------------------------------------------------------------
const fakeRes = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    send: vi.fn(() => res),
  };
  return res;
};

describe('response.success', () => {
  it('responds 200 with { success:true, message:"OK", data } by default', () => {
    const res = fakeRes();
    const data = { id: 1 };
    success(res, data);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'OK', data });
  });

  it('does NOT include meta when no meta is passed', () => {
    const res = fakeRes();
    success(res, { ok: true });
    const body = res.json.mock.calls[0][0];
    expect('meta' in body).toBe(false);
  });

  it('includes meta only when passed', () => {
    const res = fakeRes();
    const meta = { page: 1, total: 5 };
    success(res, [], 'OK', 200, meta);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'OK',
      data: [],
      meta,
    });
  });

  it('honors a custom message and statusCode', () => {
    const res = fakeRes();
    success(res, { a: 1 }, 'Custom', 207);
    expect(res.status).toHaveBeenCalledWith(207);
    expect(res.json.mock.calls[0][0].message).toBe('Custom');
  });

  it('returns the result of res.status(...).json(...) (chainable)', () => {
    const res = fakeRes();
    const out = success(res, {});
    expect(out).toBe(res);
  });

  it('omits meta when meta is falsy (e.g. 0 or null) — guard is truthiness', () => {
    const res = fakeRes();
    success(res, {}, 'OK', 200, null);
    expect('meta' in res.json.mock.calls[0][0]).toBe(false);
  });
});

describe('response.created', () => {
  it('responds 201 with message "Created" and the data', () => {
    const res = fakeRes();
    const data = { id: 42 };
    created(res, data);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Created', data });
  });

  it('accepts a custom created message', () => {
    const res = fakeRes();
    created(res, { id: 1 }, 'Listing created');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].message).toBe('Listing created');
  });
});

describe('response.noContent', () => {
  it('responds 204 and calls send() with no body', () => {
    const res = fakeRes();
    noContent(res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith();
    // 204 must not call json
    expect(res.json).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// asyncHandler
// ---------------------------------------------------------------------------
describe('asyncHandler', () => {
  it('returns a function with the (req,res,next) arity', () => {
    const wrapped = asyncHandler(async () => {});
    expect(typeof wrapped).toBe('function');
    expect(wrapped.length).toBe(3);
  });

  it('does not call next when the wrapped fn resolves', async () => {
    const next = vi.fn();
    const handler = vi.fn(async () => 'done');
    const wrapped = asyncHandler(handler);

    await wrapped({}, {}, next);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes the rejection error to next', async () => {
    const next = vi.fn();
    const boom = new Error('rejected');
    const wrapped = asyncHandler(async () => {
      throw boom;
    });

    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(boom);
  });

  // CURRENT BEHAVIOR (see bugsFound): a SYNCHRONOUS throw escapes the wrapper
  // because `fn(req,res,next)` is evaluated before `Promise.resolve(...)` wraps
  // it, so `.catch(next)` never runs. The error propagates to the caller and
  // `next` is NOT invoked. Async rejections (the common case) ARE forwarded.
  it('lets a SYNCHRONOUS throw escape instead of forwarding it to next', async () => {
    const next = vi.fn();
    const boom = new Error('sync throw');
    const wrapped = asyncHandler(() => {
      throw boom;
    });

    expect(() => wrapped({}, {}, next)).toThrow(boom);
    expect(next).not.toHaveBeenCalled();
  });

  it('invokes the wrapped fn with the same req/res/next', async () => {
    const next = vi.fn();
    const req = { id: 'req' };
    const res = { id: 'res' };
    const handler = vi.fn(async () => {});
    await asyncHandler(handler)(req, res, next);
    expect(handler).toHaveBeenCalledWith(req, res, next);
  });
});

// ---------------------------------------------------------------------------
// jwt
// ---------------------------------------------------------------------------
describe('jwt', () => {
  it('signAccessToken/verifyAccessToken round-trips the payload', () => {
    const token = signAccessToken({ sub: 'user-123', role: 'admin' });
    expect(typeof token).toBe('string');
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.role).toBe('admin');
    // standard JWT claims are present
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
  });

  it('verifyAccessToken throws on garbage input', () => {
    expect(() => verifyAccessToken('garbage')).toThrow();
  });

  it('signRefreshToken/verifyRefreshToken round-trips the payload', () => {
    const token = signRefreshToken({ sub: 'user-456', role: 'user' });
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe('user-456');
    expect(decoded.role).toBe('user');
  });

  it('verifyRefreshToken throws on garbage input', () => {
    expect(() => verifyRefreshToken('garbage')).toThrow();
  });

  it('verifyRefreshToken rejects an ACCESS token (distinct secrets)', () => {
    const access = signAccessToken({ sub: 'u', role: 'user' });
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it('verifyAccessToken rejects a REFRESH token (distinct secrets)', () => {
    const refresh = signRefreshToken({ sub: 'u', role: 'user' });
    expect(() => verifyAccessToken(refresh)).toThrow();
  });
});
