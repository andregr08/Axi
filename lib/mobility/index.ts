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
  provider?: string;

  distanceMeters?: number;
  distanceKm?: number;

  durationSeconds?: number;
  durationMinutes?: number;

  staticDurationSeconds?: number;
  staticDurationMinutes?: number;

  trafficDelaySeconds?: number;
  trafficDelayMinutes?: number;

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
  calculatedAt?: string;

  error?: string;
};

function buildRouteEstimate(
  distanceKm: number,
  durationMinutes: number,
  provider:
    MobilityRouteEstimate["provider"]
): MobilityRouteEstimate {
  const cleanDistance = Math.max(
    0.1,
    Number(distanceKm)
  );

  const cleanDuration = Math.max(
    1,
    Math.round(
      Number(durationMinutes)
    )
  );

  /*
   * Estos valores permanecen temporalmente
   * para no romper interfaces antiguas.
   * La nueva tarifa dinámica los sustituirá
   * desde Supabase.
   */
  const distanceFare =
    cleanDistance *
    MOBILITY_CONFIG.pricePerKm;

  const estimatedPrice = Math.max(
    MOBILITY_CONFIG.minimumFare,
    Math.round(
      MOBILITY_CONFIG.baseFare +
        distanceFare +
        MOBILITY_CONFIG.bookingFee
    )
  );

  return {
    distanceKm: cleanDistance,
    durationMinutes: cleanDuration,
    baseFare:
      MOBILITY_CONFIG.baseFare,
    distanceFare,
    bookingFee:
      MOBILITY_CONFIG.bookingFee,
    estimatedPrice,
    provider,
  };
}

function parseOptionalText(
  value: unknown
) {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function parseOptionalNumber(
  value: unknown
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export async function estimateRoute(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates
): Promise<MobilityRouteEstimate> {
  const params =
    new URLSearchParams({
      originLat: String(
        origin.latitude
      ),
      originLng: String(
        origin.longitude
      ),
      destinationLat: String(
        destination.latitude
      ),
      destinationLng: String(
        destination.longitude
      ),
    });

  try {
    const response = await fetch(
      `/api/route?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const data =
      (await response.json()) as
        RouteApiResponse;

    const distanceKm = Number(
      data.distanceKm
    );

    const durationMinutes = Number(
      data.durationMinutes
    );

    if (
      !response.ok ||
      !Number.isFinite(distanceKm) ||
      distanceKm <= 0 ||
      !Number.isFinite(
        durationMinutes
      ) ||
      durationMinutes <= 0
    ) {
      throw new Error(
        data.error ||
          "No se encontró una ruta real disponible."
      );
    }

    const staticDurationMinutes =
      Number.isFinite(
        Number(
          data.staticDurationMinutes
        )
      )
        ? Math.max(
            1,
            Number(
              data.staticDurationMinutes
            )
          )
        : durationMinutes;

    const trafficDelayMinutes =
      Number.isFinite(
        Number(
          data.trafficDelayMinutes
        )
      )
        ? Math.max(
            0,
            Number(
              data.trafficDelayMinutes
            )
          )
        : Math.max(
            0,
            durationMinutes -
              staticDurationMinutes
          );

    const baseEstimate =
      buildRouteEstimate(
        distanceKm,
        durationMinutes,
        "google"
      );

    return {
      ...baseEstimate,

      distanceMeters:
        Number.isFinite(
          Number(
            data.distanceMeters
          )
        )
          ? Math.max(
              1,
              Math.round(
                Number(
                  data.distanceMeters
                )
              )
            )
          : Math.round(
              distanceKm * 1000
            ),

      durationSeconds:
        Number.isFinite(
          Number(
            data.durationSeconds
          )
        )
          ? Math.max(
              1,
              Math.round(
                Number(
                  data.durationSeconds
                )
              )
            )
          : Math.round(
              durationMinutes * 60
            ),

      staticDurationMinutes,
      trafficDelayMinutes,

      trafficRatio:
        staticDurationMinutes > 0
          ? Number(
              (
                durationMinutes /
                staticDurationMinutes
              ).toFixed(3)
            )
          : 1,

      weatherAvailable:
        data.weatherAvailable === true,

      weatherConditionType:
        parseOptionalText(
          data.weatherConditionType
        ),

      weatherDescription:
        parseOptionalText(
          data.weatherDescription
        ),

      precipitationProbability:
        parseOptionalNumber(
          data.precipitationProbability
        ),

      precipitationType:
        parseOptionalText(
          data.precipitationType
        ),

      precipitationMm:
        parseOptionalNumber(
          data.precipitationMm
        ),

      thunderstormProbability:
        parseOptionalNumber(
          data.thunderstormProbability
        ),

      windSpeedKph:
        parseOptionalNumber(
          data.windSpeedKph
        ),

      windGustKph:
        parseOptionalNumber(
          data.windGustKph
        ),

      temperatureC:
        parseOptionalNumber(
          data.temperatureC
        ),

      feelsLikeC:
        parseOptionalNumber(
          data.feelsLikeC
        ),

      isDaytime:
        typeof data.isDaytime ===
          "boolean"
          ? data.isDaytime
          : null,

      weatherObservedAt:
        parseOptionalText(
          data.weatherObservedAt
        ),

      encodedPolyline:
        parseOptionalText(
          data.encodedPolyline
        ),

      routeToken:
        parseOptionalText(
          data.routeToken
        ),

      calculatedAt:
        parseOptionalText(
          data.calculatedAt
        ),
    };
  } catch (error) {
    console.error(
      "AXI Google Routes fallback:",
      error instanceof Error
        ? error.message
        : error
    );

    return estimateMockRoute(
      origin,
      destination
    );
  }
}

export function estimateRouteSync(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates
): MobilityRouteEstimate {
  return estimateMockRoute(
    origin,
    destination
  );
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