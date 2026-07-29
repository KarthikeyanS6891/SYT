import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config, rootDir } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

const uploadPath = path.join(rootDir, config.storage.uploadDir);
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Extension is derived from the validated MIME type below, never from the
// client-supplied `originalname` — otherwise an attacker can send a real
// image mimetype (passes fileFilter) with originalname "evil.html" and get
// stored-XSS served from /static with an attacker-chosen Content-Type.
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const allowed = Object.keys(MIME_TO_EXT);

const fileFilter = (_req, file, cb) => {
  if (!allowed.includes(file.mimetype)) {
    return cb(AppError.badRequest('Only JPG, PNG, WEBP, GIF images allowed'));
  }
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) return cb(AppError.badRequest('Only JPG, PNG, WEBP, GIF images allowed'));
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10,
  },
});
