import { createContext, useContext, useEffect } from 'react';
import { useLocalStorageState } from '../../shared/utils/useLocalStorageState';
import { STORAGE_KEYS } from '../../shared/utils/localStorage';

const ThemeContext = createContext(undefined);

/**
 * ThemeProvider
 *
 * Sets `data-theme="dark" | "light"` on <html>. Our CSS variables in
 * globals.css are redefined under [data-theme="dark"], so toggling
 * this attribute re-themes the ENTIRE app instantly via pure CSS —
 * no component re-renders needed for colors, only for anything that
 * reads `theme` directly (e.g. Monaco's theme prop, which isn't CSS).
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useLocalStorageState(STORAGE_KEYS.THEME, 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return context;
}
