"use client";

import {
  createContext,
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

function isValidLocale(value: string | null): value is Locale {
  return locales.includes(value as Locale);
}

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, setLocaleState] =
    useState<Locale>(defaultLocale);

  useEffect(() => {
    const savedLocale =
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (isValidLocale(savedLocale)) {
      setLocaleState(savedLocale);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      locale
    );

    document.documentElement.lang =
      locale === "es" ? "es-MX" : "en-US";
  }, [locale]);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
  }

  function toggleLocale() {
    setLocaleState((currentLocale) =>
      currentLocale === "es" ? "en" : "es"
    );
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (key: string) => translate(locale, key),
    }),
    [locale]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
