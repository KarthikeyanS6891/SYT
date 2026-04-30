import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { registerThunk } from '@/store/slices/authSlice';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Logo } from '@/components/common/Logo';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

interface FormData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
}

export default function Register() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, error } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (data: FormData) => {
    const result = await dispatch(registerThunk(data));
    if (registerThunk.fulfilled.match(result)) {
      toast.success('Welcome to SYT!');
    } else {
      toast.error((result.payload as string) || 'Registration failed');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <Logo size={64} showWordmark={false} />
        <div style={{ marginTop: 10, fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>
          S<span style={{ color: 'var(--color-primary)' }}>↑</span>T
        </div>
        <div className="muted text-xs" style={{ letterSpacing: 2, marginTop: 2 }}>SELL YOUR THINGS</div>
      </div>
      <div className="card">
        <h2 className="title">Create your account</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Full name"
            error={errors.name?.message}
            {...register('name', { required: 'Name is required', minLength: 2 })}
          />
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
            })}
          />
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Min 6 characters' },
            })}
          />
          <Input label="Phone (optional)" {...register('phone')} />
          <Input label="Location (optional)" {...register('location')} />

          {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}
          <Button type="submit" block loading={isSubmitting}>Create account</Button>
        </form>

        <div className="row" style={{ margin: '16px 0', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span className="text-xs muted">OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>
        <GoogleSignInButton text="signup_with" />

        <div className="text-sm" style={{ marginTop: 12, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)' }}>Login</Link>
        </div>
      </div>
    </div>
  );
}
