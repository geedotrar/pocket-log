'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { Locale, translations } from './translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  dateLocale: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale: Locale = 'en';
  const dateLocale = 'en-US';

  const setLocale = useCallback((_?: Locale) => {
    // English is the single fixed system language
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: unknown = translations.en;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = (current as Record<string, unknown>)[k];
        } else {
          return path; // Key not found
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      if (params) {
        return Object.entries(params).reduce(
          (str, [paramKey, paramVal]) => str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal)),
          current
        );
      }

      return current;
    },
    []
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
