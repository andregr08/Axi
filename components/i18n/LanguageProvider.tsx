"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/i18n/config";
import { translate } from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "axi-language";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
};

export const LanguageContext =
  createContext<LanguageContextValue | null>(null);

function isValidLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    locales.includes(value as Locale)
  );
}

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return defaultLocale;
    }

    const savedLocale =
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    return isValidLocale(savedLocale)
      ? savedLocale
      : defaultLocale;
  });

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (!isValidLocale(nextLocale)) {
        return;
      }

      setLocaleState(nextLocale);

      window.localStorage.setItem(
        LANGUAGE_STORAGE_KEY,
        nextLocale
      );

      document.documentElement.lang = nextLocale;
    },
    []
  );

  const toggleLocale = useCallback(() => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string) => translate(locale, key),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

