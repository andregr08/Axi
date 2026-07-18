import fs from "node:fs";

const files = {
  register: "app/(auth)/register/page.tsx",
  layout: "app/layout.tsx",
  provider: "components/i18n/LanguageProvider.tsx",
};

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`No existe: ${path}`);
  }

  return fs.readFileSync(path, "utf8");
}

function save(path, content) {
  if (!fs.existsSync(`${path}.language-backup`)) {
    fs.copyFileSync(path, `${path}.language-backup`);
  }

  fs.writeFileSync(path, content, "utf8");
  console.log(`OK: ${path}`);
}

/* =========================================================
   1. LANGUAGE PROVIDER
   Carga profiles.language automáticamente al iniciar sesión
   ========================================================= */

const provider = `"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  translations,
  type Language,
} from "@/lib/i18n";

type TranslationDictionary = Record<string, unknown>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

export const LanguageContext =
  createContext<LanguageContextValue | null>(null);

function getTranslation(
  dictionary: TranslationDictionary,
  key: string
): string {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (
      current &&
      typeof current === "object" &&
      part in current
    ) {
      return (current as TranslationDictionary)[part];
    }

    return undefined;
  }, dictionary);

  return typeof value === "string" ? value : key;
}

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguageState] =
    useState<Language>("es");

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      setLanguageState(newLanguage);

      if (typeof window !== "undefined") {
        localStorage.setItem("axi-language", newLanguage);
        document.documentElement.lang = newLanguage;
      }
    },
    []
  );

  useEffect(() => {
    const storedLanguage =
      localStorage.getItem("axi-language");

    if (
      storedLanguage === "es" ||
      storedLanguage === "en"
    ) {
      setLanguage(storedLanguage);
    }

    async function loadProfileLanguage(userId: string) {
      const { data, error } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error(
          "Error cargando idioma del perfil:",
          error.message
        );
        return;
      }

      if (
        data?.language === "es" ||
        data?.language === "en"
      ) {
        setLanguage(data.language);
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user.id) {
          loadProfileLanguage(data.session.user.id);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user.id) {
          loadProfileLanguage(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setLanguage]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) =>
        getTranslation(
          translations[language] as TranslationDictionary,
          key
        ),
    }),
    [language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
`;

save(files.provider, provider);

/* =========================================================
   2. COMPONENTE PARA REGISTRO
   ========================================================= */

const registerSelectorPath =
  "components/i18n/RegisterLanguageSelector.tsx";

fs.mkdirSync("components/i18n", { recursive: true });

const registerSelector = `"use client";

import { useLanguage } from "@/hooks/useLanguage";

export default function RegisterLanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="space-y-2">
      <label
        htmlFor="register-language"
        className="block text-sm font-medium"
      >
        Idioma / Language
      </label>

      <select
        id="register-language"
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value as "es" | "en")
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </div>
  );
}
`;

fs.writeFileSync(
  registerSelectorPath,
  registerSelector,
  "utf8"
);
console.log(\`OK: \${registerSelectorPath}\`);

/* =========================================================
   3. COMPONENTE PARA MI CUENTA
   Guarda el idioma en Supabase
   ========================================================= */

const profileSelectorPath =
  "components/i18n/ProfileLanguageSelector.tsx";

const profileSelector = `"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";

export default function ProfileLanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function changeLanguage(
    newLanguage: "es" | "en"
  ) {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setMessage("No se encontró la sesión.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ language: newLanguage })
      .eq("id", user.id);

    if (error) {
      setSaving(false);
      setMessage("No se pudo guardar el idioma.");
      console.error(error);
      return;
    }

    setLanguage(newLanguage);
    setSaving(false);
    setMessage(
      newLanguage === "es"
        ? "Idioma actualizado."
        : "Language updated."
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">
          {language === "es" ? "Idioma" : "Language"}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {language === "es"
            ? "Selecciona el idioma de AXI."
            : "Choose the AXI language."}
        </p>
      </div>

      <select
        value={language}
        disabled={saving}
        onChange={(event) =>
          changeLanguage(
            event.target.value as "es" | "en"
          )
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 disabled:opacity-60"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>

      {message && (
        <p className="mt-3 text-sm text-slate-600">
          {message}
        </p>
      )}
    </section>
  );
}
`;

fs.writeFileSync(
  profileSelectorPath,
  profileSelector,
  "utf8"
);
console.log(\`OK: \${profileSelectorPath}\`);

/* =========================================================
   4. MODIFICAR REGISTRO
   ========================================================= */

let register = read(files.register);

if (
  !register.includes(
    'import RegisterLanguageSelector from "@/components/i18n/RegisterLanguageSelector";'
  )
) {
  register =
    'import RegisterLanguageSelector from "@/components/i18n/RegisterLanguageSelector";\n' +
    'import { useLanguage } from "@/hooks/useLanguage";\n' +
    register;
}

if (!register.includes("const { language } = useLanguage();")) {
  const componentPattern =
    /(export default function[^{]*\{)/;

  if (!componentPattern.test(register)) {
    throw new Error(
      "No pude encontrar el componente de registro."
    );
  }

  register = register.replace(
    componentPattern,
    `$1
  const { language } = useLanguage();`
  );
}

if (
  !/raw_user_meta_data/.test(register) &&
  !/options\s*:\s*\{\s*data\s*:/.test(register)
) {
  console.warn(
    "AVISO: No reconocí el bloque metadata del registro."
  );
}

if (!/\blanguage\s*,/.test(register)) {
  if (/requested_account_type\s*[:,]/.test(register)) {
    register = register.replace(
      /(requested_account_type\s*:[^,\n]+,?)/,
      `$1
          language,`
    );
  } else if (
    /data\s*:\s*\{[\s\S]*?\brole\s*[:,]/.test(register)
  ) {
    register = register.replace(
      /(\brole\s*:[^,\n]+,?)/,
      `$1
          language,`
    );
  } else {
    throw new Error(
      "No pude insertar language dentro de options.data del signUp."
    );
  }
}

if (!register.includes("<RegisterLanguageSelector />")) {
  const submitButton =
    /(<button[^>]*type=["']submit["'][^>]*>)/i;

  if (!submitButton.test(register)) {
    throw new Error(
      "No encontré el botón submit del registro."
    );
  }

  register = register.replace(
    submitButton,
    `<RegisterLanguageSelector />

        $1`
  );
}

save(files.register, register);

/* =========================================================
   5. MODIFICAR PERFIL
   ========================================================= */

const profilePath =
  "app/(dashboard)/dashboard/profile/page.tsx";

let profile = read(profilePath);

if (
  !profile.includes(
    'import ProfileLanguageSelector from "@/components/i18n/ProfileLanguageSelector";'
  )
) {
  profile =
    'import ProfileLanguageSelector from "@/components/i18n/ProfileLanguageSelector";\n' +
    profile;
}

if (!profile.includes("<ProfileLanguageSelector />")) {
  const lastClosingDiv = profile.lastIndexOf("</div>");

  if (lastClosingDiv === -1) {
    throw new Error(
      "No pude encontrar dónde insertar el idioma en Mi Cuenta."
    );
  }

  profile =
    profile.slice(0, lastClosingDiv) +
    `
      <div className="mt-6">
        <ProfileLanguageSelector />
      </div>
` +
    profile.slice(lastClosingDiv);
}

save(profilePath, profile);

/* =========================================================
   6. QUITAR SELECTOR FLOTANTE DEL LAYOUT
   ========================================================= */

let layout = read(files.layout);

layout = layout
  .replace(
    /^import\s+LanguageSwitcher.*\r?\n/gm,
    ""
  )
  .replace(
    /^import\s+FloatingLanguageSwitcher.*\r?\n/gm,
    ""
  )
  .replace(
    /<LanguageSwitcher\s*\/>/g,
    ""
  )
  .replace(
    /<FloatingLanguageSwitcher\s*\/>/g,
    ""
  );

save(files.layout, layout);

console.log("");
console.log("IDIOMA CONECTADO:");
console.log("- Selector en registro");
console.log("- Guardado en profiles.language");
console.log("- Carga automática al iniciar sesión");
console.log("- Selector dentro de Mi Cuenta");
console.log("- Selector flotante eliminado");
