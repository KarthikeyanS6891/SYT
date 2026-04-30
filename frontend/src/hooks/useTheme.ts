import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { setTheme } from '@/store/slices/uiSlice';

const STORAGE_KEY = 'syt:theme';

const detectInitial = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useThemeBootstrap = () => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    dispatch(setTheme(detectInitial()));

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== 'light' && stored !== 'dark') {
        dispatch(setTheme(mq.matches ? 'dark' : 'light'));
      }
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
};

export const useTheme = () => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEY, next);
    dispatch(setTheme(next));
  };

  return { theme, toggle };
};
