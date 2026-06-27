import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { storageService } from '../../src/services/storageService.js';
import { config, rootDir } from '../../src/config/index.js';

// The active singleton during the test run is LocalStorage, because the test
// env (vitest.config.js + .env) leaves STORAGE_DRIVER at its default of 'local'.
describe('storageService — LocalStorage (active singleton)', () => {
  const uploadDir = path.join(rootDir, config.storage.uploadDir);

  it('uses the local driver in the test environment', () => {
    expect(config.storage.driver).toBe('local');
    expect(storageService.constructor.name).toBe('LocalStorage');
  });

  describe('toPublicUrl', () => {
    it('builds a /static/<filename> URL under the configured publicUrl', () => {
      const url = storageService.toPublicUrl('a.png');
      expect(url).toBe(`${config.storage.publicUrl}/static/a.png`);
      expect(url.endsWith('/static/a.png')).toBe(true);
    });
  });

  describe('fromMulter', () => {
    it('returns { url, key } derived from the multer filename', () => {
      const result = storageService.fromMulter({ filename: 'a.png' });
      expect(result).toEqual({
        url: storageService.toPublicUrl('a.png'),
        key: 'a.png',
      });
      expect(result.key).toBe('a.png');
      expect(result.url.endsWith('/static/a.png')).toBe(true);
    });
  });

  describe('delete', () => {
    it('removes an existing file from the upload directory', async () => {
      // Ensure the upload dir exists (the constructor also creates it on boot).
      fs.mkdirSync(uploadDir, { recursive: true });
      const key = `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const filePath = path.join(uploadDir, key);
      fs.writeFileSync(filePath, 'temp-bytes');
      expect(fs.existsSync(filePath)).toBe(true);

      await storageService.delete(key);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('resolves without throwing when the file does not exist (ENOENT swallowed)', async () => {
      const missing = `does-not-exist-${Date.now()}.png`;
      expect(fs.existsSync(path.join(uploadDir, missing))).toBe(false);
      await expect(storageService.delete(missing)).resolves.toBeUndefined();
    });

    it('resolves immediately when no key is provided', async () => {
      await expect(storageService.delete(undefined)).resolves.toBeUndefined();
      await expect(storageService.delete('')).resolves.toBeUndefined();
      await expect(storageService.delete(null)).resolves.toBeUndefined();
    });
  });
});

// Exercise the S3Storage branch by importing the module fresh with the S3 env
// stubbed in. vi.resetModules() guarantees the dynamic import re-evaluates the
// module (and re-reads config) instead of returning the cached LocalStorage one.
describe('storageService — S3Storage branch (fresh module import)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('constructs an S3 driver and builds region-scoped public URLs', async () => {
    vi.resetModules();
    vi.stubEnv('STORAGE_DRIVER', 's3');
    vi.stubEnv('AWS_S3_BUCKET', 'my-bucket');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    const mod = await import('../../src/services/storageService.js?s3=1');

    expect(mod.storageService.constructor.name).toBe('S3Storage');
    expect(mod.storageService.toPublicUrl('k')).toBe(
      'https://my-bucket.s3.us-east-1.amazonaws.com/k'
    );
  });

  it('rejects fromMulter (S3 multer integration not wired)', async () => {
    vi.resetModules();
    vi.stubEnv('STORAGE_DRIVER', 's3');
    vi.stubEnv('AWS_S3_BUCKET', 'my-bucket');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    const mod = await import('../../src/services/storageService.js?s3=2');

    await expect(mod.storageService.fromMulter({})).rejects.toThrow(
      /S3 multer integration/i
    );
  });

  it('rejects delete (S3 delete not wired)', async () => {
    vi.resetModules();
    vi.stubEnv('STORAGE_DRIVER', 's3');
    vi.stubEnv('AWS_S3_BUCKET', 'my-bucket');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    const mod = await import('../../src/services/storageService.js?s3=3');

    await expect(mod.storageService.delete('k')).rejects.toThrow(/S3 delete/i);
  });

  it('throws "S3 bucket not configured" at construction when no bucket is set', async () => {
    vi.resetModules();
    vi.stubEnv('STORAGE_DRIVER', 's3');
    // Force an empty bucket so the guard in the S3Storage constructor fires,
    // regardless of whatever .env / process.env might otherwise supply.
    vi.stubEnv('AWS_S3_BUCKET', '');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    await expect(
      import('../../src/services/storageService.js?s3=nobucket')
    ).rejects.toThrow(/S3 bucket not configured/i);
  });
});
