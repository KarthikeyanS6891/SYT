import path from 'path';
import fs from 'fs';
import { config, rootDir } from '../config/index.js';

class LocalStorage {
  constructor() {
    this.uploadDir = path.join(rootDir, config.storage.uploadDir);
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  toPublicUrl(filename) {
    return `${config.storage.publicUrl}/static/${filename}`;
  }

  fromMulter(file) {
    return {
      url: this.toPublicUrl(file.filename),
      key: file.filename,
    };
  }

  async delete(key) {
    if (!key) return;
    const filePath = path.join(this.uploadDir, key);
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

class S3Storage {
  constructor() {
    const { s3 } = config.storage;
    if (!s3.bucket) throw new Error('S3 bucket not configured');
    this.bucket = s3.bucket;
    this.region = s3.region;
  }

  toPublicUrl(key) {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async fromMulter(_file) {
    throw new Error('S3 multer integration: install multer-s3 and inject here');
  }

  async delete(_key) {
    throw new Error('S3 delete: install @aws-sdk/client-s3 and inject here');
  }
}

export const storageService =
  config.storage.driver === 's3' ? new S3Storage() : new LocalStorage();
