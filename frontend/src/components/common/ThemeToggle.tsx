import { FC } from 'react';
import { useTheme } from '@/hooks/useTheme';

export const ThemeToggle: FC = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className={`theme-toggle-inner ${isDark ? 'dark' : 'light'}`}>
        <span className="theme-toggle-icon sun" aria-hidden="true">☀</span>
        <span className="theme-toggle-icon moon" aria-hidden="true">☾</span>
      </span>
    </button>
  );
};
