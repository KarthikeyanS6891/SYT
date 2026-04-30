import { FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store';
import { logoutThunk } from '@/store/slices/authSlice';
import { initials } from '@/utils/format';
import { Logo } from '@/components/common/Logo';
import { SearchAutocomplete } from './SearchAutocomplete';

export const Navbar: FC = () => {
  const { user, isAdmin } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const unread = useAppSelector((s) => s.ui.unreadCount);

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="SYT - Sell Your Things home">
          <Logo size={36} />
        </Link>

        <div className="search">
          <SearchAutocomplete />
        </div>

        <div className="spacer" />

        <div className="nav-links">
          {user ? (
            <>
              <Link to="/post" className="btn sm">+ Post Ad</Link>
              <Link to="/favorites" className="btn ghost sm" title="Favorites">♡</Link>
              <Link to="/chat" className="btn ghost sm" title="Chat">
                💬{unread > 0 && <span className="badge" style={{ marginLeft: 4 }}>{unread}</span>}
              </Link>
              {isAdmin && <Link to="/admin" className="btn ghost sm">Admin</Link>}
              <Link to="/profile" className="row" style={{ gap: 8 }}>
                <span
                  className="avatar"
                  style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : {}}
                >
                  {!user.avatar && initials(user.name)}
                </span>
              </Link>
              <button onClick={handleLogout} className="btn secondary sm">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn ghost sm">Login</Link>
              <Link to="/register" className="btn sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
