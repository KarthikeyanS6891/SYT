import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  renderWithProviders,
  makeStore,
  makeUser,
  screen,
  render,
  waitFor,
  fireEvent,
  userEvent,
} from '@/test/utils';

// --- mocks -------------------------------------------------------------
// Mock the auth service so the thunks never hit the network. The service
// methods are "unwrapped" -> they resolve to { data, meta, message } where
// `data` is the AuthResponse ({ user, accessToken, refreshToken }), which is
// what loginThunk/registerThunk/googleLoginThunk destructure.
vi.mock('@/services/authService', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { authApi } from '@/services/authService';
import toast from 'react-hot-toast';
import { AuthModal } from './AuthModal';

// Helper: build the unwrapped auth-service success payload.
const authSuccess = (over: Partial<ReturnType<typeof makeUser>> = {}) => ({
  data: {
    user: makeUser(over),
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
  },
  meta: null,
  message: 'OK',
});

const openState = (mode: 'login' | 'register' = 'login') => ({
  ui: { unreadCount: 0, authModal: { open: true, mode }, theme: 'light' as const },
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AuthModal', () => {
  it('does not render anything when authModal.open is false', () => {
    renderWithProviders(<AuthModal />, {
      preloadedState: {
        ui: { unreadCount: 0, authModal: { open: false, mode: 'login' }, theme: 'light' },
      },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the modal dialog when authModal.open is true', () => {
    renderWithProviders(<AuthModal />, { preloadedState: openState('login') });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Sell Your Things')).toBeInTheDocument();
  });

  it('shows login fields (Email + Password, no name) when mode is login', () => {
    renderWithProviders(<AuthModal />, { preloadedState: openState('login') });
    // login submit button
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    // The "Login" tab is selected
    const loginTab = screen.getByRole('tab', { name: 'Login' });
    expect(loginTab).toHaveAttribute('aria-selected', 'true');
    expect(loginTab).toHaveClass('active');
    // login form has no "Full name" field
    expect(screen.queryByText('Full name')).not.toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('shows register fields (Full name, Phone, Location) when mode is register', () => {
    renderWithProviders(<AuthModal />, { preloadedState: openState('register') });
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByText('Full name')).toBeInTheDocument();
    expect(screen.getByText('Phone (optional)')).toBeInTheDocument();
    expect(screen.getByText('Location (optional)')).toBeInTheDocument();
    const signupTab = screen.getByRole('tab', { name: 'Sign up' });
    expect(signupTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switching mode via the tab updates the form and store state', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });
    expect(store.getState().ui.authModal.mode).toBe('login');
    expect(screen.queryByText('Full name')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Sign up' }));

    expect(store.getState().ui.authModal.mode).toBe('register');
    expect(screen.getByText('Full name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('switching mode via the footer link toggles between login and register', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });
    // login footer offers "Create an account"
    await user.click(screen.getByRole('button', { name: /create an account/i }));
    expect(store.getState().ui.authModal.mode).toBe('register');

    // register footer offers "Login instead"
    await user.click(screen.getByRole('button', { name: /login instead/i }));
    expect(store.getState().ui.authModal.mode).toBe('login');
  });

  it('submitting the login form dispatches loginThunk and authenticates', async () => {
    (authApi.login as any).mockResolvedValue(authSuccess({ name: 'Logged In' }));
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });

    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'secret123',
      })
    );
    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'));
    expect(store.getState().auth.user?.name).toBe('Logged In');
    // tokens persisted by the thunk
    expect(localStorage.getItem('syt:accessToken')).toBe('access-token-123');
    // success toast + modal closed on success
    expect(toast.success).toHaveBeenCalledWith('Welcome back!');
    await waitFor(() => expect(store.getState().ui.authModal.open).toBe(false));
  });

  it('navigates back to the originally-requested route after a successful login (regression: used to strand the user on "/")', async () => {
    (authApi.login as any).mockResolvedValue(authSuccess({ name: 'Logged In' }));
    const user = userEvent.setup();
    const OnPost = () => <div>post-ad-page</div>;
    render(
      <Provider store={makeStore(openState('login'))}>
        <MemoryRouter
          initialEntries={[{ pathname: '/', state: { from: { pathname: '/post', search: '' } } }]}
        >
          <Routes>
            <Route path="/" element={<AuthModal />} />
            <Route path="/post" element={<OnPost />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.getByText('post-ad-page')).toBeInTheDocument());
  });

  it('submitting the register form dispatches registerThunk with all fields', async () => {
    (authApi.register as any).mockResolvedValue(authSuccess({ name: 'New User' }));
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('register'),
    });

    const inputs = document.querySelectorAll('.auth-form input');
    // order: name, email, password, phone, location
    await user.type(inputs[0] as HTMLElement, 'New User');
    await user.type(inputs[1] as HTMLElement, 'new@example.com');
    await user.type(inputs[2] as HTMLElement, 'hunter2!');
    await user.type(inputs[3] as HTMLElement, '9990001112');
    await user.type(inputs[4] as HTMLElement, 'Bengaluru');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password: 'hunter2!',
        phone: '9990001112',
        location: 'Bengaluru',
      })
    );
    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'));
    expect(toast.success).toHaveBeenCalledWith('Welcome to SYT!');
  });

  it('shows a validation error and does NOT submit when login fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthModal />, { preloadedState: openState('login') });

    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows an error toast and keeps the modal open when login is rejected', async () => {
    (authApi.login as any).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });

    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials'));
    expect(store.getState().auth.status).toBe('error');
    expect(store.getState().auth.error).toBe('Invalid credentials');
    // modal stays open on failure
    expect(store.getState().ui.authModal.open).toBe(true);
    // the slice error is surfaced in the form
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('clears the stale login error when switching to the Register tab (regression: shared auth.error field leaked across tabs)', async () => {
    (authApi.login as any).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });

    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(store.getState().auth.error).toBe('Invalid credentials'));

    await user.click(screen.getByRole('tab', { name: 'Sign up' }));

    expect(store.getState().auth.error).toBeNull();
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  });

  it('closing via the X button dispatches closeAuthModal', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(store.getState().ui.authModal.open).toBe(false);
  });

  it('clicking the backdrop dispatches closeAuthModal but clicking the dialog does not', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });
    // clicking inside the dialog should NOT close (stopPropagation)
    await user.click(screen.getByRole('dialog'));
    expect(store.getState().ui.authModal.open).toBe(true);

    // clicking the backdrop closes
    const backdrop = document.querySelector('.auth-modal-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(store.getState().ui.authModal.open).toBe(false);
  });

  it('pressing Escape dispatches closeAuthModal', () => {
    const { store } = renderWithProviders(<AuthModal />, {
      preloadedState: openState('login'),
    });
    expect(store.getState().ui.authModal.open).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(store.getState().ui.authModal.open).toBe(false);
  });
});

describe('GoogleSignInButton (no VITE_GOOGLE_CLIENT_ID configured)', () => {
  // In the test environment VITE_GOOGLE_CLIENT_ID is empty, so the component
  // captures CLIENT_ID = '' at module load and renders its fallback message.
  it('renders the "not configured" fallback when no client id is set', () => {
    renderWithProviders(<AuthModal />, { preloadedState: openState('login') });
    expect(screen.getByText(/Google Sign-In is not configured/i)).toBeInTheDocument();
    expect(screen.getByText('VITE_GOOGLE_CLIENT_ID')).toBeInTheDocument();
  });

  it('does not touch window.google when no client id is configured', () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as any).google = { accounts: { id: { initialize, renderButton } } };
    renderWithProviders(<AuthModal />, { preloadedState: openState('login') });
    expect(initialize).not.toHaveBeenCalled();
    expect(renderButton).not.toHaveBeenCalled();
    delete (window as any).google;
  });
});

describe('GoogleSignInButton (with VITE_GOOGLE_CLIENT_ID configured)', () => {
  // CLIENT_ID is read from import.meta.env at module load, so we must stub the
  // env and re-import the component in a fresh module registry.
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (window as any).google;
  });

  it('initializes and renders the Google button via window.google.accounts.id', async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as any).google = { accounts: { id: { initialize, renderButton } } };

    const { GoogleSignInButton } = await import('./GoogleSignInButton');
    renderWithProviders(<GoogleSignInButton text="signin_with" onSuccess={vi.fn()} />);

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-google-client-id',
        cancel_on_tap_outside: true,
        callback: expect.any(Function),
      })
    );
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ text: 'signin_with', theme: 'outline', size: 'large' })
    );
    // fallback text must NOT be shown when configured
    expect(screen.queryByText(/Google Sign-In is not configured/i)).not.toBeInTheDocument();
  });

  it('does not crash and waits (no render) when window.google is not yet available', async () => {
    delete (window as any).google;
    const { GoogleSignInButton } = await import('./GoogleSignInButton');
    // Should render the container without throwing even though google is absent.
    expect(() =>
      renderWithProviders(<GoogleSignInButton onSuccess={vi.fn()} />)
    ).not.toThrow();
    expect(screen.queryByText(/Google Sign-In is not configured/i)).not.toBeInTheDocument();
  });

  it('dispatches googleLoginThunk through the initialize callback on credential', async () => {
    (authApi.googleLogin as any).mockResolvedValue(authSuccess({ name: 'Google User' }));
    let capturedCallback: ((arg: { credential: string }) => Promise<void>) | null = null;
    const initialize = vi.fn((opts: any) => {
      capturedCallback = opts.callback;
    });
    const renderButton = vi.fn();
    (window as any).google = { accounts: { id: { initialize, renderButton } } };

    const { GoogleSignInButton } = await import('./GoogleSignInButton');
    const onSuccess = vi.fn();
    const { store } = renderWithProviders(
      <GoogleSignInButton text="continue_with" onSuccess={onSuccess} />
    );

    await waitFor(() => expect(capturedCallback).toBeTypeOf('function'));
    await capturedCallback!({ credential: 'fake-jwt-credential' });

    expect(authApi.googleLogin).toHaveBeenCalledWith('fake-jwt-credential');
    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'));
    expect(toast.success).toHaveBeenCalledWith('Signed in with Google');
    expect(onSuccess).toHaveBeenCalled();
  });
});
