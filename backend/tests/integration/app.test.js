import { describe, it, expect } from 'vitest';
import { api } from '../helpers/index.js';

// These tests exercise the top-level Express wiring in src/app.js:
//   - the root info route and the /api/v1/health route
//   - the notFound + errorHandler middleware chain (src/middleware/errorHandler.js)
//   - the CORS origin allow/deny callback configured in src/app.js
//
// In the vitest env (see vitest.config.js) CORS_ORIGINS is set to exactly
// "http://localhost:5173", so that is the only allowed origin.

describe('GET / (API info)', () => {
  it('returns 200 with the API name, version, and docs pointer', async () => {
    const res = await api().get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SYT Marketplace API');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.docs).toBe('/api/v1/health');
  });
});

describe('GET /api/v1/health', () => {
  it('returns 200 with status "ok" and a numeric uptime', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('unknown routes (notFound + errorHandler)', () => {
  it('returns 404 with a "Route not found" message for an unknown API route', async () => {
    const res = await api().get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
    // notFound embeds the method + original url in the message.
    expect(res.body.message).toMatch(/GET/);
    expect(res.body.message).toMatch(/\/api\/v1\/does-not-exist/);
  });

  it('returns 404 for an unknown top-level (non-API) route', async () => {
    const res = await api().post('/totally/unknown');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
    expect(res.body.message).toMatch(/POST/);
  });

  it('does not leak a stack trace in the test/non-development env', async () => {
    const res = await api().get('/api/v1/nope');
    expect(res.status).toBe(404);
    // errorHandler only attaches `stack` when config.env === 'development'.
    expect(res.body.stack).toBeUndefined();
  });
});

describe('CORS origin policy', () => {
  it('allows the configured origin and echoes it in access-control-allow-origin', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    // credentials: true is configured in the cors() options.
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('blocks a disallowed origin via the cors error path (500, "CORS blocked")', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://evil.example');
    // The cors origin callback throws `new Error("CORS blocked: ...")`, which has
    // no statusCode, so errorHandler falls back to 500.
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/CORS blocked/);
    expect(res.body.message).toMatch(/http:\/\/evil\.example/);
    // A blocked request must not carry an allow-origin header for the bad origin.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests with no Origin header (e.g. server-to-server / curl)', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('blocks a disallowed origin even on the root route', async () => {
    const res = await api().get('/').set('Origin', 'http://evil.example');
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/CORS blocked/);
  });
});
