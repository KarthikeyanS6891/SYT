import { describe, it, expect, afterEach, vi } from 'vitest';

// The default (test-mode) config module is already loaded and cached by
// tests/setup.js with NODE_ENV=test, so these tests re-import the module
// fresh (with a unique query string + vi.resetModules()) to exercise the
// NODE_ENV=production startup guard against default/weak JWT secrets.
describe('config — production JWT secret guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws at import time when NODE_ENV=production and JWT_ACCESS_SECRET is left at its dev default', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', 'dev_access_secret_change_me');
    vi.stubEnv('JWT_REFRESH_SECRET', 'a-real-production-refresh-secret');

    await expect(import('../../src/config/index.js?prod=1')).rejects.toThrow(
      /JWT_ACCESS_SECRET/i
    );
  });

  it('throws at import time when NODE_ENV=production and JWT_REFRESH_SECRET is left at its dev default', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', 'a-real-production-access-secret');
    vi.stubEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me');

    await expect(import('../../src/config/index.js?prod=2')).rejects.toThrow(
      /JWT_REFRESH_SECRET/i
    );
  });

  it('throws at import time when NODE_ENV=production and the access/refresh secrets are equal', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', 'same-secret-both-tokens');
    vi.stubEnv('JWT_REFRESH_SECRET', 'same-secret-both-tokens');

    await expect(import('../../src/config/index.js?prod=3')).rejects.toThrow(
      /must not be equal/i
    );
  });

  it('boots normally when NODE_ENV=production with distinct, non-default secrets', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', 'a-real-production-access-secret');
    vi.stubEnv('JWT_REFRESH_SECRET', 'a-real-production-refresh-secret');

    const mod = await import('../../src/config/index.js?prod=4');
    expect(mod.config.env).toBe('production');
    expect(mod.config.jwt.accessSecret).toBe('a-real-production-access-secret');
  });

  it('does not enforce the guard outside production (e.g. development with default secrets)', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_ACCESS_SECRET', 'dev_access_secret_change_me');
    vi.stubEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me');

    const mod = await import('../../src/config/index.js?prod=5');
    expect(mod.config.env).toBe('development');
  });
});
