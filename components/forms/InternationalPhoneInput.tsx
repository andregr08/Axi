"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Globe2,
  Phone,
} from "lucide-react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { cn } from "@/utils/cn";

type InternationalPhoneInputProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

type CountryOption = {
  code: CountryCode;
  name: string;
  callingCode: string;
};

function getCountryName(
  code: CountryCode
) {
  try {
    const names = new Intl.DisplayNames(
      ["es"],
      {
        type: "region",
      }
    );

    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

function countryFlag(
  code: CountryCode
) {
  return code
    .toUpperCase()
    .replace(
      /./g,
      (character) =>
        String.fromCodePoint(
          127397 +
            character.charCodeAt(0)
        )
    );
}

const countries: CountryOption[] =
  getCountries()
    .map((code) => ({
      code,
      name: getCountryName(code),
      callingCode:
        getCountryCallingCode(code),
    }))
    .sort((first, second) =>
      first.name.localeCompare(
        second.name,
        "es"
      )
    );

function detectCountry(
  value: string
): CountryCode {
  const parsed =
    parsePhoneNumberFromString(value);

  return parsed?.country ?? "MX";
}

export function InternationalPhoneInput({
  id = "phone",
  label = "Teléfono",
  value,
  onChange,
  required = false,
  disabled = false,
  className,
}: InternationalPhoneInputProps) {
  const initialCountry = useMemo(
    () => detectCountry(value),
    [value]
  );

  const [country, setCountry] =
    useState<CountryCode>(
      initialCountry
    );

  const callingCode =
    getCountryCallingCode(country);

  const isValid =
    value.trim().length > 0 &&
    isValidPhoneNumber(value);

  function handleCountryChange(
    nextCountry: CountryCode
  ) {
    setCountry(nextCountry);

    const previousPhone =
      parsePhoneNumberFromString(value);

    const nationalNumber =
      previousPhone?.nationalNumber ?? "";

    const nextValue = nationalNumber
      ? `+${getCountryCallingCode(
          nextCountry
        )}${nationalNumber}`
      : `+${getCountryCallingCode(
          nextCountry
        )}`;

    onChange(
      new AsYouType(
        nextCountry
      ).input(nextValue)
    );
  }

  function handlePhoneChange(
    nextValue: string
  ) {
    const cleanValue =
      nextValue.trimStart();

    if (!cleanValue) {
      onChange("");
      return;
    }

    const valueWithCode =
      cleanValue.startsWith("+")
        ? cleanValue
        : `+${callingCode}${cleanValue}`;

    const formatted =
      new AsYouType().input(
        valueWithCode
      );

    onChange(formatted);

    const detected =
      parsePhoneNumberFromString(
        formatted
      )?.country;

    if (detected) {
      setCountry(detected);
    }
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-black text-slate-700"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <div className="relative">
          <Globe2
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <select
            value={country}
            disabled={disabled}
            onChange={(event) =>
              handleCountryChange(
                event.target
                  .value as CountryCode
              )
            }
            aria-label="País del teléfono"
            className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {countries.map(
              (option) => (
                <option
                  key={option.code}
                  value={option.code}
                >
                  {countryFlag(
                    option.code
                  )}{" "}
                  {option.name} +
                  {option.callingCode}
                </option>
              )
            )}
          </select>
        </div>

        <div className="relative">
          <Phone
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required={required}
            disabled={disabled}
            value={value}
            onChange={(event) =>
              handlePhoneChange(
                event.target.value
              )
            }
            placeholder={`+${callingCode} teléfono`}
            className={cn(
              "h-14 w-full rounded-2xl border bg-slate-50 pl-12 pr-12 font-semibold text-slate-950 outline-none transition focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
              value.length === 0
                ? "border-slate-200 focus:border-slate-950 focus:ring-slate-950/5"
                : isValid
                  ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/10"
                  : "border-amber-300 focus:border-amber-500 focus:ring-amber-500/10"
            )}
          />

          {isValid && (
            <CheckCircle2
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600"
            />
          )}
        </div>
      </div>

      <p
        className={cn(
          "mt-2 text-xs",
          value.length === 0
            ? "text-slate-400"
            : isValid
              ? "font-semibold text-emerald-600"
              : "font-semibold text-amber-700"
        )}
      >
        {value.length === 0
          ? "Selecciona el país e ingresa el número completo."
          : isValid
            ? "Número internacional válido."
            : "El número todavía está incompleto o no es válido."}
      </p>
    </div>
  );
}
