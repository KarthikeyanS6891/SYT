import { userService } from '../services/userService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';

export const getProfile = asyncHandler(async (req, res) => {
  const data = await userService.getProfile(req.user._id);
  success(res, { user: data });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const data = await userService.updateProfile(req.user._id, req.body);
  success(res, { user: data }, 'Profile updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  const data = await userService.changePassword(req.user._id, req.body);
  success(res, data, 'Password changed');
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const data = await userService.getPublicProfile(req.params.id);
  success(res, { user: data });
});
