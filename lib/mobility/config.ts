import type { MobilityProviderName } from "./types";

export const MOBILITY_CONFIG = {
  baseFare: 35,
  pricePerKm: 12,
  bookingFee: 8,
  minimumFare: 55,
  averageSpeedKmH: 28,
  minimumDurationMinutes: 5,
  defaultOrigin: {
    latitude: 19.0414,
    longitude: -98.2063,
  },
  defaultDestination: {
    latitude: 19.0544,
    longitude: -98.2221,
  },
} as const;

export function getMobilityProvider(): MobilityProviderName {
  const configuredProvider =
    process.env.NEXT_PUBLIC_MOBILITY_PROVIDER;

  if (
    configuredProvider === "google" &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  ) {
    return "google";
  }

  return "mock";
}

export function isMockMobilityMode() {
  return getMobilityProvider() === "mock";
}
