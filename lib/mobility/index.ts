import { MOBILITY_CONFIG } from "./config";
import { estimateMockRoute } from "./mockProvider";
import type {
  MobilityCoordinates,
  MobilityRouteEstimate,
} from "./types";

export {
  MOBILITY_CONFIG,
  getMobilityProvider,
  isMockMobilityMode,
} from "./config";

export type {
  MobilityCoordinates,
  MobilityProviderName,
  MobilityRouteEstimate,
} from "./types";

type RouteApiResponse = {
  distanceKm?: number;
  durationMinutes?: number;
  error?: string;
};

function buildRouteEstimate(
  distanceKm: number,
  durationMinutes: number,
  provider: MobilityRouteEstimate["provider"],
): MobilityRouteEstimate {
  const cleanDistance = Math.max(0.1, Number(distanceKm));
  const cleanDuration = Math.max(1, Math.round(Number(durationMinutes)));

  const distanceFare =
    cleanDistance * MOBILITY_CONFIG.pricePerKm;

  const estimatedPrice = Math.max(
    MOBILITY_CONFIG.minimumFare,
    Math.round(
      MOBILITY_CONFIG.baseFare +
        distanceFare +
        MOBILITY_CONFIG.bookingFee,
    ),
  );

  return {
    distanceKm: cleanDistance,
    durationMinutes: cleanDuration,
    baseFare: MOBILITY_CONFIG.baseFare,
    distanceFare,
    bookingFee: MOBILITY_CONFIG.bookingFee,
    estimatedPrice,
    provider,
  };
}

export async function estimateRoute(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates,
): Promise<MobilityRouteEstimate> {
  const params = new URLSearchParams({
    originLat: String(origin.latitude),
    originLng: String(origin.longitude),
    destinationLat: String(destination.latitude),
    destinationLng: String(destination.longitude),
  });

  try {
    const response = await fetch(`/api/route?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = (await response.json()) as RouteApiResponse;

    if (
      !response.ok ||
      !Number.isFinite(Number(data.distanceKm)) ||
      !Number.isFinite(Number(data.durationMinutes))
    ) {
      throw new Error(
        data.error || "No se encontró una ruta real disponible.",
      );
    }

    return buildRouteEstimate(
      Number(data.distanceKm),
      Number(data.durationMinutes),
      "osrm",
    );
  } catch (error) {
    console.error(
      "AXI route fallback:",
      error instanceof Error ? error.message : error,
    );

    return estimateMockRoute(origin, destination);
  }
}

export function estimateRouteSync(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates,
): MobilityRouteEstimate {
  return estimateMockRoute(origin, destination);
}

export {
  createPricedTrip,
  getDynamicFareEstimate,
  getPricingPeriodLabel,
} from "./pricing";

export type {
  CreatePricedTripInput,
  DynamicFareEstimate,
  RideType,
} from "./pricing";
