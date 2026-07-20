"use client";

import { Globe2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
      aria-label="Seleccionar idioma"
    >
      <Globe2
        size={18}
        className="ml-2 mr-1 text-slate-600"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => setLocale("es")}
        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
          locale === "es"
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>

      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
          locale === "en"
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
