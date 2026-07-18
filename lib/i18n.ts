import es from "@/messages/es.json";
import en from "@/messages/en.json";
import type { Locale } from "@/i18n/config";

export const dictionaries = {
  es,
  en,
} as const;

export function translate(
  locale: Locale,
  key: string
): string {
  const parts = key.split(".");
  let value: unknown = dictionaries[locale];

  for (const part of parts) {
    if (
      typeof value !== "object" ||
      value === null ||
      !(part in value)
    ) {
      console.warn(
        `[i18n] Traducción no encontrada: ${locale}.${key}`
      );

      return key;
    }

    value = (value as Record<string, unknown>)[part];
  }

  return typeof value === "string" ? value : key;
}
