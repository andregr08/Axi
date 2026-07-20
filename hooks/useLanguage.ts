"use client";

import { useContext } from "react";
import { LanguageContext } from "@/components/i18n/LanguageProvider";

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage debe utilizarse dentro de LanguageProvider."
    );
  }

  return context;
}
