import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config, rootDir } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

const uploadPath = path.join(rootDir, config.storage.uploadDir);
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (_req, file, cb) => {
  if (!allowed.includes(file.mimetype)) {
    return cb(AppError.badRequest('Only JPG, PNG, WEBP, GIF images allowed'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10,
  },
});
