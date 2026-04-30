import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: function () {
        return !this.googleId;
      },
    },
    googleId: { type: String, index: true, sparse: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    disabled: { type: Boolean, default: false },
    refreshTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
