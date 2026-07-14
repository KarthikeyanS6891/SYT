import { FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store';
import { logoutThunk } from '@/store/slices/authSlice';
import { openAuthModal } from '@/store/slices/uiSlice';
import { initials } from '@/utils/format';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { SearchAutocomplete } from './SearchAutocomplete';

export const Navbar: FC = () => {
  const { user, isAdmin } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const unread = useAppSelector((s) => s.ui.unreadCount);

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/');
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
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/post" className="btn sm">+ Post Ad</Link>
              <Link to="/favorites" className="icon-link" title="Favorites" aria-label="Favorites">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </Link>
              <Link
                to="/chat"
                className="icon-link"
                title="Chat"
                aria-label={unread > 0 ? `Chat, ${unread} unread messages` : 'Chat'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                </svg>
                {unread > 0 && <span className="badge">{unread}</span>}
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
              <button
                type="button"
                onClick={() => dispatch(openAuthModal('login'))}
                className="btn ghost sm"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => dispatch(openAuthModal('register'))}
                className="btn sm"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
