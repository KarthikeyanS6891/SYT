import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errorMessage, unwrap } from '@/services/api';
import { useAppDispatch } from '@/store';
import { setUser } from '@/store/slices/authSlice';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { initials } from '@/utils/format';
import type { User } from '@/types';

interface ProfileForm {
  name: string;
  phone?: string;
  location?: string;
  avatar?: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
}

export default function Profile() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      location: user?.location || '',
      avatar: user?.avatar || '',
    },
  });

  const passwordForm = useForm<PasswordForm>();

  const saveProfile = async (data: ProfileForm) => {
    try {
      const { data: res } = await unwrap<{ user: User }>(api.patch('/users/me', data));
      dispatch(setUser(res.user));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changePassword = async (data: PasswordForm) => {
    try {
      await unwrap(api.post('/users/me/password', data));
      toast.success('Password changed. Please log in again.');
      passwordForm.reset();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16 }}>
          <span
            className="avatar"
            style={{
              width: 64, height: 64, fontSize: 20,
              ...(user.avatar ? { backgroundImage: `url(${user.avatar})` } : {}),
            }}
          >
            {!user.avatar && initials(user.name)}
          </span>
          <div>
            <h2 style={{ margin: 0 }}>{user.name}</h2>
            <div className="muted text-sm">{user.email}</div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <Link to="/my-listings" className="btn ghost sm">My Listings</Link>
              <Link to="/favorites" className="btn ghost sm">Favorites</Link>
              <Link to="/post" className="btn sm">+ New Listing</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12, gap: 4 }}>
        <button
          className={`btn ${tab === 'profile' ? '' : 'ghost'} sm`}
          onClick={() => setTab('profile')}
        >Profile</button>
        <button
          className={`btn ${tab === 'password' ? '' : 'ghost'} sm`}
          onClick={() => setTab('password')}
        >Change password</button>
      </div>

      {tab === 'profile' ? (
        <form className="card" onSubmit={profileForm.handleSubmit(saveProfile)}>
          <Input label="Name" {...profileForm.register('name', { required: 'Required' })}
            error={profileForm.formState.errors.name?.message} />
          <Input label="Phone" {...profileForm.register('phone')} />
          <Input label="Location" {...profileForm.register('location')} />
          <Input label="Avatar URL" {...profileForm.register('avatar')} />
          <Button type="submit" loading={profileForm.formState.isSubmitting}>Save</Button>
        </form>
      ) : (
        <form className="card" onSubmit={passwordForm.handleSubmit(changePassword)}>
          <Input
            label="Current password"
            type="password"
            {...passwordForm.register('currentPassword', { required: 'Required' })}
            error={passwordForm.formState.errors.currentPassword?.message}
          />
          <Input
            label="New password"
            type="password"
            {...passwordForm.register('newPassword', {
              required: 'Required',
              minLength: { value: 6, message: 'Min 6 chars' },
            })}
            error={passwordForm.formState.errors.newPassword?.message}
          />
          <Button type="submit" loading={passwordForm.formState.isSubmitting}>Change password</Button>
        </form>
      )}
    </div>
  );
}
