import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw AppError.unauthorized('Authentication token missing');

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('-password');
    if (!user) throw AppError.unauthorized('User no longer exists');
    if (user.disabled) throw AppError.forbidden('Account disabled');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('-password');
    if (user && !user.disabled) req.user = user;
    next();
  } catch {
    next();
  }
};

export const requireAdmin = (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'admin') return next(AppError.forbidden('Admin only'));
  next();
};
