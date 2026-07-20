import {
  isValidPhoneNumber,
  parsePhoneNumber,
} from "libphonenumber-js";

export function normalizeInternationalPhone(
  value: string
) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  try {
    if (!isValidPhoneNumber(cleanValue)) {
      return null;
    }

    return parsePhoneNumber(
      cleanValue
    ).number;
  } catch {
    return null;
  }
}

export function formatInternationalPhone(
  value: string | null
) {
  if (!value) {
    return "No registrado";
  }

  try {
    return parsePhoneNumber(
      value
    ).formatInternational();
  } catch {
    return value;
  }
}
