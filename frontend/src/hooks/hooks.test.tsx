import { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react';
import { renderWithProviders, makeStore, authedState, screen, waitFor } from '@/test/utils';
import { useDebounce } from './useDebounce';
import { useAuth } from './useAuth';
import { useTheme, useThemeBootstrap } from './useTheme';

const STORAGE_KEY = 'syt:theme';

// Wrap renderHook in the real Redux store so store-backed hooks work.
const wrapperFor = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

// -------------------------------------------------------------------------
describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 400));
    expect(result.current).toBe('a');
  });

  it('updates the debounced value only after the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'a' },
    });
    expect(result.current).toBe('a');

    rerender({ v: 'b' });
    // Not yet — timer has not fired.
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes so only the last value lands', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ v: 'c' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 400ms total elapsed, but the timer was reset at 200ms — nothing landed yet.
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Only the latest value ('c') lands; intermediate 'b' is skipped.
    expect(result.current).toBe('c');
  });

  it('uses the default delay of 400ms when none is given', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });
});

// -------------------------------------------------------------------------
describe('useAuth', () => {
  it('returns the user, isAuthenticated true, and isAdmin false for a regular user', () => {
    const store = makeStore(authedState({ role: 'user', name: 'Reggie' }));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user?.name).toBe('Reggie');
    expect(result.current.status).toBe('authenticated');
    expect(result.current.initialized).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports isAdmin true when the user role is admin', () => {
    const store = makeStore(authedState({ role: 'admin', name: 'Ada' }));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user?.role).toBe('admin');
  });

  it('returns isAuthenticated false with no user for an empty store', () => {
    const store = makeStore();
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.initialized).toBe(false);
  });
});

// -------------------------------------------------------------------------
describe('useTheme', () => {
  it('exposes the current theme from the store (defaults to light)', () => {
    const store = makeStore();
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(store) });
    expect(result.current.theme).toBe('light');
  });

  it('toggle() flips light -> dark, persists to localStorage, and updates the store', () => {
    const store = makeStore();
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(store) });

    expect(store.getState().ui.theme).toBe('light');

    act(() => {
      result.current.toggle();
    });

    expect(store.getState().ui.theme).toBe('dark');
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('toggle() flips dark -> light', () => {
    const store = makeStore({
      ui: { unreadCount: 0, authModal: { open: false, mode: 'login' }, theme: 'dark' },
    });
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(store) });

    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggle();
    });

    expect(store.getState().ui.theme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});

// -------------------------------------------------------------------------
describe('useThemeBootstrap', () => {
  const Bootstrapped = () => {
    useThemeBootstrap();
    return <div data-testid="ready">ok</div>;
  };

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets the data-theme attribute on documentElement on mount', async () => {
    renderWithProviders(<Bootstrapped />);
    await screen.findByTestId('ready');

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  it('reads a stored theme from localStorage and applies it', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { store } = renderWithProviders(<Bootstrapped />);
    await screen.findByTestId('ready');

    await waitFor(() => {
      expect(store.getState().ui.theme).toBe('dark');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to the preferred (matchMedia) theme when nothing is stored', async () => {
    // setup.ts stubs matchMedia with matches:false -> prefers light.
    const { store } = renderWithProviders(<Bootstrapped />);
    await screen.findByTestId('ready');

    await waitFor(() => {
      expect(store.getState().ui.theme).toBe('light');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('honours a dark prefers-color-scheme when nothing is stored', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      const { store } = renderWithProviders(<Bootstrapped />);
      await screen.findByTestId('ready');
      await waitFor(() => {
        expect(store.getState().ui.theme).toBe('dark');
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    } finally {
      window.matchMedia = original;
    }
  });
});
