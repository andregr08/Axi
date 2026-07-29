export type MobilityCoordinates = {
  latitude: number;
  longitude: number;
};

export type MobilityRouteEstimate = {
  distanceKm: number;
  durationMinutes: number;

  /*
   * Métricas verificadas por Google Routes.
   * Son opcionales para mantener funcionando
   * el proveedor mock durante desarrollo.
   */
  distanceMeters?: number;
  durationSeconds?: number;
  staticDurationMinutes?: number;
  trafficDelayMinutes?: number;
  trafficRatio?: number;

  weatherAvailable?: boolean;
  weatherConditionType?: string | null;
  weatherDescription?: string | null;
  precipitationProbability?: number | null;
  precipitationType?: string | null;
  precipitationMm?: number | null;
  thunderstormProbability?: number | null;
  windSpeedKph?: number | null;
  windGustKph?: number | null;
  temperatureC?: number | null;
  feelsLikeC?: number | null;
  isDaytime?: boolean | null;
  weatherObservedAt?: string | null;

  encodedPolyline?: string | null;
  routeToken?: string | null;
  calculatedAt?: string | null;

  baseFare: number;
  distanceFare: number;
  bookingFee: number;
  estimatedPrice: number;

  provider:
    | "mock"
    | "google"
    | "osrm";
};

export type MobilityProviderName =
  | "mock"
  | "google"
  | "osrm";