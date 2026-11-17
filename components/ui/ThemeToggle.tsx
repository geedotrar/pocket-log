'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'pill' | 'icon' | 'compact';
}

export default function ThemeToggle({
  className = '',
  showLabel = false,
  variant = 'icon',
}: ThemeToggleProps) {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`flex items-center space-x-2 rounded-2xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
          isDark
            ? 'bg-[#1A211D] border border-white/10 text-[#F2F5F3] hover:bg-[#253028]'
            : 'bg-[#EEF2EE] border border-black/8 text-[#141916] hover:bg-[#E2E8E3]'
        } ${className}`}
      >
        {isDark ? (
          <>
            <Sun className="h-4 w-4 text-amber-400" />
            {showLabel && <span>Light Mode</span>}
          </>
        ) : (
          <>
            <Moon className="h-4 w-4 text-emerald-700" />
            {showLabel && <span>Dark Mode</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`relative inline-flex items-center justify-center rounded-xl p-2 text-[#8F9992] hover:text-[#F2F5F3] hover:bg-white/5 transition-all cursor-pointer active:scale-95 ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-emerald-800 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
