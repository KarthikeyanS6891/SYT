import { describe, it, expect, beforeEach } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/utils';

import Login from './Login';
import Register from './Register';
import NotFound from './NotFound';

/**
 * NOTE on actual behavior (verified against source, NOT the prose scenario):
 * - src/pages/Login.tsx and src/pages/Register.tsx do NOT render their own
 *   email/password forms. Instead each is a thin route that, on mount,
 *   dispatches openAuthModal('login' | 'register') and immediately renders
 *   <Navigate to="/" replace />. The actual auth form lives in a modal driven
 *   by the ui slice (uiSlice.authModal). loginThunk / registerThunk are NOT
 *   referenced by these page components.
 * - These tests therefore assert the real behavior: the ui.authModal state is
 *   opened with the correct mode and the user is redirected to "/".
 */

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens the auth modal in "login" mode on mount', () => {
    const { store } = renderWithProviders(<Login />, {
      route: '/login',
      path: '/login',
    });
    const { authModal } = store.getState().ui;
    expect(authModal.open).toBe(true);
    expect(authModal.mode).toBe('login');
  });

  it('redirects to the home page (renders nothing of its own)', () => {
    // Register both routes so the <Navigate to="/"> resolves to an element.
    const { container } = renderWithProviders(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div data-testid="home">Home</div>} />
      </Routes>,
      { route: '/login' }
    );
    // After redirect we land on the home element, and Login renders no form.
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });

  it('does not render its own login form (email/password inputs)', () => {
    const { container } = renderWithProviders(<Login />, {
      route: '/login',
      path: '/login',
    });
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('Register page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens the auth modal in "register" mode on mount', () => {
    const { store } = renderWithProviders(<Register />, {
      route: '/register',
      path: '/register',
    });
    const { authModal } = store.getState().ui;
    expect(authModal.open).toBe(true);
    expect(authModal.mode).toBe('register');
  });

  it('redirects to the home page (renders nothing of its own)', () => {
    const { container } = renderWithProviders(
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<div data-testid="home">Home</div>} />
      </Routes>,
      { route: '/register' }
    );
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it('does not render its own registration form (name/email/password inputs)', () => {
    const { container } = renderWithProviders(<Register />, {
      route: '/register',
      path: '/register',
    });
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('NotFound page', () => {
  it('renders the 404 heading and the "not found" message', () => {
    renderWithProviders(<NotFound />, { route: '/does-not-exist' });
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(
      screen.getByText(/the page you're looking for doesn't exist/i)
    ).toBeInTheDocument();
  });

  it('renders a "Go home" link pointing at "/"', () => {
    renderWithProviders(<NotFound />, { route: '/does-not-exist' });
    const link = screen.getByRole('link', { name: /go home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveClass('btn');
  });
});
