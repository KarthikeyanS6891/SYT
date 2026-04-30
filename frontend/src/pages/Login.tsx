import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { loginThunk } from '@/store/slices/authSlice';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

interface FormData {
  email: string;
  password: string;
}

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, error } = useAuth();
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const onSubmit = async (data: FormData) => {
    const result = await dispatch(loginThunk(data));
    if (loginThunk.fulfilled.match(result)) {
      toast.success('Welcome back!');
    } else {
      toast.error((result.payload as string) || 'Login failed');
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: '40px auto' }}>
      <div className="card">
        <h2 className="title">Login</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
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
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Min 6 characters' },
            })}
          />
          {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}
          <Button type="submit" block loading={isSubmitting}>Login</Button>
        </form>

        <div className="row" style={{ margin: '16px 0', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span className="text-xs muted">OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>
        <GoogleSignInButton text="signin_with" />

        <div className="text-sm" style={{ marginTop: 12, textAlign: 'center' }}>
          New here? <Link to="/register" style={{ color: 'var(--color-primary)' }}>Create account</Link>
        </div>
      </div>
    </div>
  );
}
