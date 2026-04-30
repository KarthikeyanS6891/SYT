import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { userRepository } from '../repositories/userRepository.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

const googleClient = config.google.clientId ? new OAuth2Client(config.google.clientId) : null;

const buildTokens = (user) => {
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

export const authService = {
  async register({ name, email, password, phone, location }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw AppError.conflict('Email already registered');
    const user = await userRepository.create({ name, email, password, phone, location });
    const tokens = buildTokens(user);
    await userRepository.pushRefreshToken(user._id, tokens.refreshToken);
    return { user: user.toPublicJSON(), ...tokens };
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email, { withPassword: true });
    if (!user) throw AppError.unauthorized('Invalid credentials');
    if (user.disabled) throw AppError.forbidden('Account disabled');
    const ok = await user.comparePassword(password);
    if (!ok) throw AppError.unauthorized('Invalid credentials');
    const tokens = buildTokens(user);
    await userRepository.pushRefreshToken(user._id, tokens.refreshToken);
    return { user: user.toPublicJSON(), ...tokens };
  },

  async refresh({ refreshToken }) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Invalid refresh token');
    }
    const user = await User.findById(decoded.sub).select('+refreshTokens');
    if (!user) throw AppError.unauthorized('User not found');
    if (user.disabled) throw AppError.forbidden('Account disabled');
    if (!user.refreshTokens.includes(refreshToken)) {
      throw AppError.unauthorized('Refresh token revoked');
    }
    const tokens = buildTokens(user);
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();
    return tokens;
  },

  async logout({ userId, refreshToken }) {
    if (!refreshToken) return;
    await userRepository.pullRefreshToken(userId, refreshToken);
  },

  async logoutAll({ userId }) {
    await userRepository.setRefreshTokens(userId, []);
  },

  async loginWithGoogle({ credential }) {
    if (!googleClient) {
      throw AppError.badRequest('Google Sign-In is not configured on the server');
    }
    if (!credential) throw AppError.badRequest('Missing Google credential');

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw AppError.unauthorized('Invalid Google token');
    }

    if (!payload?.email_verified) {
      throw AppError.unauthorized('Google email not verified');
    }

    const { sub: googleId, email, name, picture } = payload;

    let user = await userRepository.findByGoogleId(googleId);
    if (!user) {
      user = await userRepository.findByEmail(email);
      if (user) {
        user.googleId = googleId;
        user.authProvider = user.authProvider === 'local' ? 'local' : 'google';
        if (!user.avatar && picture) user.avatar = picture;
        await user.save();
      } else {
        user = await User.create({
          name: name || email.split('@')[0],
          email,
          googleId,
          avatar: picture || '',
          authProvider: 'google',
        });
      }
    }

    if (user.disabled) throw AppError.forbidden('Account disabled');

    const tokens = buildTokens(user);
    await userRepository.pushRefreshToken(user._id, tokens.refreshToken);
    return { user: user.toPublicJSON(), ...tokens };
  },
};
