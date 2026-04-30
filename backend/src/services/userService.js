import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { userRepository } from '../repositories/userRepository.js';
import { AppError } from '../utils/AppError.js';

const sanitize = (input, allowed) =>
  Object.fromEntries(
    Object.entries(input).filter(([k, v]) => allowed.includes(k) && v !== undefined)
  );

export const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    return user.toPublicJSON();
  },

  async getPublicProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user || user.disabled) throw AppError.notFound('User not found');
    const { _id, name, avatar, location, createdAt } = user;
    return { _id, name, avatar, location, createdAt };
  },

  async updateProfile(userId, data) {
    const allowed = ['name', 'phone', 'location', 'avatar'];
    const update = sanitize(data, allowed);
    const user = await userRepository.updateById(userId, update);
    if (!user) throw AppError.notFound('User not found');
    return user.toPublicJSON();
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw AppError.notFound('User not found');
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw AppError.unauthorized('Current password incorrect');
    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();
    return { ok: true };
  },
};
