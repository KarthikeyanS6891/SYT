import { describe, it, expect } from 'vitest';
import reducer, {
  setUnread,
  bumpUnread,
  resetUnread,
  openAuthModal,
  closeAuthModal,
  setAuthMode,
  setTheme,
} from './uiSlice';

const initialState = {
  unreadCount: 0,
  authModal: { open: false, mode: 'login' as const },
  theme: 'light' as const,
};

describe('uiSlice reducer', () => {
  it('returns the initial state for an unknown action', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  describe('unread count', () => {
    it('setUnread sets the count to the given number', () => {
      const next = reducer(initialState, setUnread(7));
      expect(next.unreadCount).toBe(7);
    });

    it('setUnread can set the count to zero', () => {
      const start = { ...initialState, unreadCount: 5 };
      expect(reducer(start, setUnread(0)).unreadCount).toBe(0);
    });

    it('bumpUnread increments the count by one', () => {
      const next = reducer(initialState, bumpUnread());
      expect(next.unreadCount).toBe(1);
    });

    it('bumpUnread increments from an existing value', () => {
      const start = { ...initialState, unreadCount: 3 };
      expect(reducer(start, bumpUnread()).unreadCount).toBe(4);
    });

    it('resetUnread sets the count back to zero', () => {
      const start = { ...initialState, unreadCount: 9 };
      expect(reducer(start, resetUnread()).unreadCount).toBe(0);
    });

    it('does not mutate the previous state (immutability)', () => {
      const start = { ...initialState, unreadCount: 2 };
      reducer(start, bumpUnread());
      expect(start.unreadCount).toBe(2);
    });
  });

  describe('auth modal', () => {
    it('openAuthModal() opens the modal with the default "login" mode', () => {
      const next = reducer(initialState, openAuthModal());
      expect(next.authModal).toEqual({ open: true, mode: 'login' });
    });

    it('openAuthModal("register") opens the modal in register mode', () => {
      const next = reducer(initialState, openAuthModal('register'));
      expect(next.authModal).toEqual({ open: true, mode: 'register' });
    });

    it('openAuthModal("login") opens the modal in login mode', () => {
      const next = reducer(initialState, openAuthModal('login'));
      expect(next.authModal).toEqual({ open: true, mode: 'login' });
    });

    it('openAuthModal with no payload falls back to "login" even when current mode is register', () => {
      const start = { ...initialState, authModal: { open: false, mode: 'register' as const } };
      const next = reducer(start, openAuthModal());
      expect(next.authModal).toEqual({ open: true, mode: 'login' });
    });

    it('closeAuthModal closes the modal but preserves the current mode', () => {
      const start = { ...initialState, authModal: { open: true, mode: 'register' as const } };
      const next = reducer(start, closeAuthModal());
      expect(next.authModal).toEqual({ open: false, mode: 'register' });
    });

    it('setAuthMode updates only the mode and leaves open untouched', () => {
      const start = { ...initialState, authModal: { open: true, mode: 'login' as const } };
      const next = reducer(start, setAuthMode('register'));
      expect(next.authModal).toEqual({ open: true, mode: 'register' });
    });

    it('setAuthMode can switch back to login', () => {
      const start = { ...initialState, authModal: { open: false, mode: 'register' as const } };
      const next = reducer(start, setAuthMode('login'));
      expect(next.authModal).toEqual({ open: false, mode: 'login' });
    });
  });

  describe('theme', () => {
    it('setTheme sets the theme to dark', () => {
      const next = reducer(initialState, setTheme('dark'));
      expect(next.theme).toBe('dark');
    });

    it('setTheme sets the theme back to light', () => {
      const start = { ...initialState, theme: 'dark' as const };
      expect(reducer(start, setTheme('light')).theme).toBe('light');
    });
  });

  describe('action creators', () => {
    it('produce the expected typed action objects', () => {
      expect(setUnread(4)).toEqual({ type: 'ui/setUnread', payload: 4 });
      expect(bumpUnread()).toEqual({ type: 'ui/bumpUnread', payload: undefined });
      expect(resetUnread()).toEqual({ type: 'ui/resetUnread', payload: undefined });
      expect(openAuthModal('register')).toEqual({ type: 'ui/openAuthModal', payload: 'register' });
      expect(closeAuthModal()).toEqual({ type: 'ui/closeAuthModal', payload: undefined });
      expect(setAuthMode('login')).toEqual({ type: 'ui/setAuthMode', payload: 'login' });
      expect(setTheme('dark')).toEqual({ type: 'ui/setTheme', payload: 'dark' });
    });
  });
});
