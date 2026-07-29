import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { api, createUser, authFor } from '../helpers/index.js';
import { storageService } from '../../src/services/storageService.js';
import { config, rootDir } from '../../src/config/index.js';

const uploadDir = path.join(rootDir, config.storage.uploadDir);

/** Filenames currently sitting in the upload directory (ignoring .gitkeep). */
const listUploads = () => {
  try {
    return fs.readdirSync(uploadDir).filter((f) => f !== '.gitkeep');
  } catch {
    return [];
  }
};

// A minimal but valid 1x1 PNG. Used as the happy-path image payload.
const PNG = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489' +
    '0000000A49444154789C6360000002000154A24F5F0000000049454E44AE426082',
  'hex'
);

const attachPng = (req, name = 'a.png') =>
  req.attach('images', PNG, { filename: name, contentType: 'image/png' });

/** Remove every uploaded file so the working tree stays clean. */
const cleanup = async (images = []) => {
  await Promise.all(images.map((img) => storageService.delete(img.key)));
};

describe('POST /uploads/images', () => {
  it('uploads a valid PNG and returns image descriptors (200)', async () => {
    const user = await createUser();
    let images = [];
    try {
      const res = await attachPng(
        api().post('/api/v1/uploads/images').set(authFor(user))
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Uploaded');
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(res.body.data.images).toHaveLength(1);

      images = res.body.data.images;
      const [img] = images;
      expect(img).toEqual({
        url: expect.any(String),
        key: expect.any(String),
      });
      expect(img.url).toContain('/static/');
      // The public url ends with the storage key (the generated filename).
      expect(img.url.endsWith(`/static/${img.key}`)).toBe(true);
      expect(img.key).toMatch(/\.png$/);
    } finally {
      await cleanup(images);
    }
  });

  it('accepts multiple images in one request', async () => {
    const user = await createUser();
    let images = [];
    try {
      const res = await attachPng(
        attachPng(api().post('/api/v1/uploads/images').set(authFor(user)), 'one.png'),
        'two.png'
      );

      expect(res.status).toBe(200);
      images = res.body.data.images;
      expect(images).toHaveLength(2);
      for (const img of images) {
        expect(img.url).toContain('/static/');
        expect(img.key).toBeTruthy();
      }
      // Keys are unique even when original filenames collide.
      expect(images[0].key).not.toBe(images[1].key);
    } finally {
      await cleanup(images);
    }
  });

  it('rejects a request with no file attached (400)', async () => {
    const user = await createUser();
    const res = await api().post('/api/v1/uploads/images').set(authFor(user));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No files uploaded');
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await attachPng(api().post('/api/v1/uploads/images'));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/token missing/i);
  });

  it('rejects an unauthenticated request even with no file (401)', async () => {
    // Auth runs before the controller's "no files" check.
    const res = await api().post('/api/v1/uploads/images');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/token missing/i);
  });

  it('derives the saved extension from the validated mimetype, ignoring a spoofed originalname (stored-XSS regression)', async () => {
    const user = await createUser();
    let images = [];
    try {
      // Attacker-controlled: real image/png mimetype (passes fileFilter) paired
      // with an .html originalname. The saved key must never end in .html —
      // otherwise express.static would serve it back as text/html.
      const res = await api()
        .post('/api/v1/uploads/images')
        .set(authFor(user))
        .attach('images', PNG, { filename: 'evil.html', contentType: 'image/png' });

      expect(res.status).toBe(200);
      images = res.body.data.images;
      expect(images[0].key).toMatch(/\.png$/);
      expect(images[0].key).not.toMatch(/\.html$/);
    } finally {
      await cleanup(images);
    }
  });

  it('rejects a disallowed mimetype via the multer fileFilter (400)', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/uploads/images')
      .set(authFor(user))
      .attach('images', Buffer.from('hello world'), {
        filename: 'x.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/JPG, PNG, WEBP, GIF/);
  });

  it('rejects more than 10 images (400, LIMIT_FILE_COUNT)', async () => {
    const user = await createUser();
    let req = api().post('/api/v1/uploads/images').set(authFor(user));
    for (let i = 0; i < 11; i++) {
      req = attachPng(req, `img-${i}.png`);
    }
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/too many files/i);
  });

  it('rejects a single file larger than 8MB (413, LIMIT_FILE_SIZE)', async () => {
    const user = await createUser();
    // multer's diskStorage writes the partial stream to disk before it aborts
    // on the size limit, and nothing in the request pipeline removes it. Snapshot
    // the directory so we can delete whatever this request leaves behind.
    const before = new Set(listUploads());
    try {
      // 9MB of zero bytes with an image extension/mimetype so the fileFilter
      // passes and the size limit is what trips.
      const big = Buffer.alloc(9 * 1024 * 1024, 0);
      const res = await api()
        .post('/api/v1/uploads/images')
        .set(authFor(user))
        .attach('images', big, { filename: 'big.png', contentType: 'image/png' });

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/file too large/i);
    } finally {
      const leftovers = listUploads().filter((f) => !before.has(f));
      await Promise.all(leftovers.map((key) => storageService.delete(key)));
    }
  });

  it('rejects an unexpected file field name (400, LIMIT_UNEXPECTED_FILE)', async () => {
    const user = await createUser();
    // Route is upload.array('images', ...); any other field is unexpected.
    const res = await api()
      .post('/api/v1/uploads/images')
      .set(authFor(user))
      .attach('photo', PNG, { filename: 'wrong-field.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/unexpected file field/i);
  });

  it('rejects a malformed token (401)', async () => {
    const res = await attachPng(
      api().post('/api/v1/uploads/images').set('Authorization', 'Bearer not.a.jwt')
    );
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
