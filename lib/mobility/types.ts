export type MobilityCoordinates = {
  latitude: number;
  longitude: number;
};

export type MobilityRouteEstimate = {
  distanceKm: number;
  durationMinutes: number;
  baseFare: number;
  distanceFare: number;
  bookingFee: number;
  estimatedPrice: number;
  provider: "mock" | "google" | "osrm";
};

export type MobilityProviderName =
  | "mock"
  | "google"
  | "osrm";
