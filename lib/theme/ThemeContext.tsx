'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const THEME_STORAGE_KEY = 'pocketlog_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  // Apply theme to DOM documentElement
  const applyThemeToDom = useCallback((newTheme: ThemeMode) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, []);

  // Initialize theme on client mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
        applyThemeToDom(savedTheme);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme: ThemeMode = prefersDark ? 'dark' : 'light';
        setThemeState(initialTheme);
        applyThemeToDom(initialTheme);
      }
    } catch {
      // Fallback default dark
      setThemeState('dark');
      applyThemeToDom('dark');
    }

    // Listen to changes from other tabs or windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
        applyThemeToDom(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [applyThemeToDom]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage errors
    }
  }, [applyThemeToDom]);

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
