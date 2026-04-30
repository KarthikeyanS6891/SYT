import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing env variable: ${name}`);
  }
  return value;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  mongoUri: required('MONGODB_URI', 'mongodb://localhost:27017/syt_marketplace'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:5000',
    s3: {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: process.env.AWS_S3_BUCKET,
    },
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },
};

export const rootDir = path.resolve(__dirname, '../..');
