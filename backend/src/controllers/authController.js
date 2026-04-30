import { authService } from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success, created } from '../utils/response.js';

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  created(res, data, 'Registered');
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  success(res, data, 'Logged in');
});

export const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body);
  success(res, data, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout({
    userId: req.user._id,
    refreshToken: req.body.refreshToken,
  });
  success(res, { ok: true }, 'Logged out');
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll({ userId: req.user._id });
  success(res, { ok: true }, 'Logged out from all devices');
});

export const me = asyncHandler(async (req, res) => {
  success(res, { user: req.user.toPublicJSON() });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const data = await authService.loginWithGoogle({ credential: req.body.credential });
  success(res, data, 'Logged in with Google');
});
