import { MOBILITY_CONFIG } from "./config";
import type {
  MobilityCoordinates,
  MobilityRouteEstimate,
} from "./types";

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateMockDistanceKm(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates
) {
  const earthRadiusKm = 6371;

  const latitudeDifference = degreesToRadians(
    destination.latitude - origin.latitude
  );

  const longitudeDifference = degreesToRadians(
    destination.longitude - origin.longitude
  );

  const originLatitude = degreesToRadians(
    origin.latitude
  );

  const destinationLatitude = degreesToRadians(
    destination.latitude
  );

  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(haversineValue),
      Math.sqrt(1 - haversineValue)
    );

  return Math.max(
    1,
    earthRadiusKm * centralAngle
  );
}

export function estimateMockRoute(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates
): MobilityRouteEstimate {
  const distanceKm = calculateMockDistanceKm(
    origin,
    destination
  );

  const durationMinutes = Math.max(
    MOBILITY_CONFIG.minimumDurationMinutes,
    Math.round(
      (distanceKm /
        MOBILITY_CONFIG.averageSpeedKmH) *
        60
    )
  );

  const distanceFare =
    distanceKm * MOBILITY_CONFIG.pricePerKm;

  const estimatedPrice = Math.max(
    MOBILITY_CONFIG.minimumFare,
    Math.round(
      MOBILITY_CONFIG.baseFare +
        distanceFare +
        MOBILITY_CONFIG.bookingFee
    )
  );

  return {
    distanceKm,
    durationMinutes,
    baseFare: MOBILITY_CONFIG.baseFare,
    distanceFare,
    bookingFee: MOBILITY_CONFIG.bookingFee,
    estimatedPrice,
    provider: "mock",
  };
}
