import { FC, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeAuthModal, setAuthMode } from '@/store/slices/uiSlice';
import { loginThunk, registerThunk } from '@/store/slices/authSlice';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Logo } from '@/components/common/Logo';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

interface LoginFormData { email: string; password: string }
interface RegisterFormData {
  name: string; email: string; password: string; phone?: string; location?: string;
}

const LoginPanel: FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    const result = await dispatch(loginThunk(data));
    if (loginThunk.fulfilled.match(result)) {
      toast.success('Welcome back!');
      onSuccess();
    } else {
      toast.error((result.payload as string) || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        autoFocus
        error={errors.email?.message}
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
        })}
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 6, message: 'Min 6 characters' },
        })}
      />
      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      <Button type="submit" block loading={isSubmitting}>Login</Button>
    </form>
  );
};

const RegisterPanel: FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>();

  const onSubmit = async (data: RegisterFormData) => {
    const result = await dispatch(registerThunk(data));
    if (registerThunk.fulfilled.match(result)) {
      toast.success('Welcome to SYT!');
      onSuccess();
    } else {
      toast.error((result.payload as string) || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <Input
        label="Full name"
        autoComplete="name"
        autoFocus
        error={errors.name?.message}
        {...register('name', { required: 'Name is required', minLength: 2 })}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
        })}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 6, message: 'Min 6 characters' },
        })}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Phone (optional)" autoComplete="tel" {...register('phone')} />
        <Input label="Location (optional)" autoComplete="address-level2" {...register('location')} />
      </div>
      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      <Button type="submit" block loading={isSubmitting}>Create account</Button>
    </form>
  );
};

export const AuthModal: FC = () => {
  const dispatch = useAppDispatch();
  const { open, mode } = useAppSelector((s) => s.ui.authModal);

  const close = () => dispatch(closeAuthModal());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="auth-modal-backdrop" onClick={close} role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="auth-modal-close" onClick={close} aria-label="Close">
          ×
        </button>

        <div className="auth-modal-hero">
          <Logo size={56} showWordmark={false} />
          <div className="auth-modal-brand">
            S<span style={{ color: 'var(--color-primary)' }}>↑</span>T
          </div>
          <div className="auth-modal-tagline">Sell Your Things</div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => dispatch(setAuthMode('login'))}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => dispatch(setAuthMode('register'))}
          >
            Sign up
          </button>
          <span className={`auth-tab-indicator ${mode}`} aria-hidden="true" />
        </div>

        <h2 id="auth-modal-title" className="visually-hidden">
          {mode === 'login' ? 'Login' : 'Sign up'}
        </h2>

        {mode === 'login' ? (
          <LoginPanel onSuccess={close} />
        ) : (
          <RegisterPanel onSuccess={close} />
        )}

        <div className="auth-modal-divider">
          <span>OR</span>
        </div>
        <GoogleSignInButton
          text={mode === 'login' ? 'signin_with' : 'signup_with'}
          onSuccess={close}
        />

        <div className="auth-modal-foot">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="link-btn" onClick={() => dispatch(setAuthMode('register'))}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="link-btn" onClick={() => dispatch(setAuthMode('login'))}>
                Login instead
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
