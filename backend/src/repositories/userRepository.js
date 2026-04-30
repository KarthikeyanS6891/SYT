import { User } from '../models/User.js';

export const userRepository = {
  findById: (id, options = {}) => User.findById(id, null, options),
  findByEmail: (email, { withPassword = false } = {}) => {
    const q = User.findOne({ email });
    if (withPassword) q.select('+password +refreshTokens');
    return q;
  },
  findByGoogleId: (googleId) => User.findOne({ googleId }),
  create: (data) => User.create(data),
  updateById: (id, update) =>
    User.findByIdAndUpdate(id, update, { new: true, runValidators: true }),
  pushRefreshToken: (id, token) =>
    User.findByIdAndUpdate(id, { $push: { refreshTokens: token } }),
  pullRefreshToken: (id, token) =>
    User.findByIdAndUpdate(id, { $pull: { refreshTokens: token } }),
  setRefreshTokens: (id, tokens) =>
    User.findByIdAndUpdate(id, { refreshTokens: tokens }),
  list: ({ page = 1, limit = 20, q } = {}) => {
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    return Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);
  },
};
