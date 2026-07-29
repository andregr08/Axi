import {
  NextRequest,
  NextResponse,
} from "next/server";

const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const GOOGLE_WEATHER_URL =
  "https://weather.googleapis.com/v1/currentConditions:lookup";

type GoogleRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    staticDuration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
    routeToken?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GoogleWeatherResponse = {
  currentTime?: string;

  isDaytime?: boolean;

  weatherCondition?: {
    type?: string;
    description?: {
      text?: string;
    };
  };

  temperature?: {
    degrees?: number;
  };

  feelsLikeTemperature?: {
    degrees?: number;
  };

  precipitation?: {
    probability?: {
      percent?: number;
      type?: string;
    };

    qpf?: {
      quantity?: number;
    };
  };

  thunderstormProbability?: number;

  wind?: {
    speed?: {
      value?: number;
    };

    gust?: {
      value?: number;
    };
  };

  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type WeatherContext = {
  weatherAvailable: boolean;
  weatherConditionType: string | null;
  weatherDescription: string | null;
  precipitationProbability: number | null;
  precipitationType: string | null;
  precipitationMm: number | null;
  thunderstormProbability: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  isDaytime: boolean | null;
  weatherObservedAt: string | null;
};

const EMPTY_WEATHER_CONTEXT: WeatherContext = {
  weatherAvailable: false,
  weatherConditionType: null,
  weatherDescription: null,
  precipitationProbability: null,
  precipitationType: null,
  precipitationMm: null,
  thunderstormProbability: null,
  windSpeedKph: null,
  windGustKph: null,
  temperatureC: null,
  feelsLikeC: null,
  isDaytime: null,
  weatherObservedAt: null,
};

function parseGoogleDuration(
  value: string | undefined
) {
  if (!value) {
    return 0;
  }

  const seconds = Number(
    value.replace(/s$/, "")
  );

  return Number.isFinite(seconds)
    ? Math.max(0, seconds)
    : 0;
}

function nullableNumber(
  value: unknown
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function nullableText(
  value: unknown
) {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function isValidLatitude(
  value: number
) {
  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(
  value: number
) {
  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

async function fetchWeatherContext(
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<WeatherContext> {
  const weatherUrl = new URL(
    GOOGLE_WEATHER_URL
  );

  weatherUrl.searchParams.set(
    "key",
    apiKey
  );

  weatherUrl.searchParams.set(
    "location.latitude",
    String(latitude)
  );

  weatherUrl.searchParams.set(
    "location.longitude",
    String(longitude)
  );

  weatherUrl.searchParams.set(
    "languageCode",
    "es-MX"
  );

  weatherUrl.searchParams.set(
    "unitsSystem",
    "METRIC"
  );

  try {
    const response = await fetch(
      weatherUrl,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const data =
      (await response.json()) as
        GoogleWeatherResponse;

    if (!response.ok) {
      console.error(
        "Google Weather API respondió con error:",
        {
          status: response.status,
          googleStatus:
            data.error?.status,
          message:
            data.error?.message,
        }
      );

      return EMPTY_WEATHER_CONTEXT;
    }

    return {
      weatherAvailable: true,

      weatherConditionType:
        nullableText(
          data.weatherCondition?.type
        ),

      weatherDescription:
        nullableText(
          data.weatherCondition?.
            description?.text
        ),

      precipitationProbability:
        nullableNumber(
          data.precipitation?.
            probability?.percent
        ),

      precipitationType:
        nullableText(
          data.precipitation?.
            probability?.type
        ),

      precipitationMm:
        nullableNumber(
          data.precipitation?.
            qpf?.quantity
        ),

      thunderstormProbability:
        nullableNumber(
          data.thunderstormProbability
        ),

      windSpeedKph:
        nullableNumber(
          data.wind?.speed?.value
        ),

      windGustKph:
        nullableNumber(
          data.wind?.gust?.value
        ),

      temperatureC:
        nullableNumber(
          data.temperature?.degrees
        ),

      feelsLikeC:
        nullableNumber(
          data.feelsLikeTemperature?.
            degrees
        ),

      isDaytime:
        typeof data.isDaytime ===
          "boolean"
          ? data.isDaytime
          : null,

      weatherObservedAt:
        nullableText(
          data.currentTime
        ),
    };
  } catch (error) {
    console.error(
      "No fue posible consultar Google Weather:",
      error instanceof Error
        ? error.message
        : error
    );

    return EMPTY_WEATHER_CONTEXT;
  }
}

export async function GET(
  request: NextRequest
) {
  const originLat = Number(
    request.nextUrl.searchParams.get(
      "originLat"
    )
  );

  const originLng = Number(
    request.nextUrl.searchParams.get(
      "originLng"
    )
  );

  const destinationLat = Number(
    request.nextUrl.searchParams.get(
      "destinationLat"
    )
  );

  const destinationLng = Number(
    request.nextUrl.searchParams.get(
      "destinationLng"
    )
  );

  if (
    !isValidLatitude(originLat) ||
    !isValidLongitude(originLng) ||
    !isValidLatitude(destinationLat) ||
    !isValidLongitude(destinationLng)
  ) {
    return NextResponse.json(
      {
        error:
          "Las coordenadas proporcionadas no son válidas.",
      },
      {
        status: 400,
      }
    );
  }

  const apiKey =
    process.env
      .GOOGLE_MAPS_SERVER_API_KEY?.
      trim();

  if (!apiKey) {
    console.error(
      "GOOGLE_MAPS_SERVER_API_KEY no está configurada."
    );

    return NextResponse.json(
      {
        error:
          "El servicio de rutas no está configurado.",
      },
      {
        status: 503,
      }
    );
  }

  try {
    const routeRequest = fetch(
      GOOGLE_ROUTES_URL,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "routes.distanceMeters",
            "routes.duration",
            "routes.staticDuration",
            "routes.polyline.encodedPolyline",
            "routes.routeToken",
          ].join(","),
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: originLat,
                longitude: originLng,
              },
            },
          },

          destination: {
            location: {
              latLng: {
                latitude:
                  destinationLat,
                longitude:
                  destinationLng,
              },
            },
          },

          travelMode: "DRIVE",

          routingPreference:
            "TRAFFIC_AWARE_OPTIMAL",

          trafficModel:
            "BEST_GUESS",

          computeAlternativeRoutes:
            false,

          languageCode: "es-MX",
          units: "METRIC",

          polylineQuality:
            "HIGH_QUALITY",

          polylineEncoding:
            "ENCODED_POLYLINE",
        }),
      }
    );

    const [
      googleResponse,
      weatherContext,
    ] = await Promise.all([
      routeRequest,
      fetchWeatherContext(
        originLat,
        originLng,
        apiKey
      ),
    ]);

    const data =
      (await googleResponse.json()) as
        GoogleRouteResponse;

    if (!googleResponse.ok) {
      console.error(
        "Google Routes API respondió con error:",
        {
          status:
            googleResponse.status,
          googleStatus:
            data.error?.status,
          message:
            data.error?.message,
        }
      );

      return NextResponse.json(
        {
          error:
            "Google no pudo calcular la ruta solicitada.",
        },
        {
          status: 502,
        }
      );
    }

    const route =
      data.routes?.[0];

    const distanceMeters = Number(
      route?.distanceMeters
    );

    const durationSeconds =
      parseGoogleDuration(
        route?.duration
      );

    const staticDurationSeconds =
      parseGoogleDuration(
        route?.staticDuration
      ) || durationSeconds;

    if (
      !route ||
      !Number.isFinite(
        distanceMeters
      ) ||
      distanceMeters <= 0 ||
      durationSeconds <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Google no encontró una ruta disponible.",
        },
        {
          status: 404,
        }
      );
    }

    const trafficDelaySeconds =
      Math.max(
        0,
        durationSeconds -
          staticDurationSeconds
      );

    return NextResponse.json({
      provider: "google",

      distanceMeters:
        Math.round(distanceMeters),

      distanceKm: Number(
        (
          distanceMeters / 1000
        ).toFixed(2)
      ),

      durationSeconds:
        Math.round(
          durationSeconds
        ),

      durationMinutes:
        Math.max(
          1,
          Math.ceil(
            durationSeconds / 60
          )
        ),

      staticDurationSeconds:
        Math.round(
          staticDurationSeconds
        ),

      staticDurationMinutes:
        Math.max(
          1,
          Math.ceil(
            staticDurationSeconds /
              60
          )
        ),

      trafficDelaySeconds:
        Math.round(
          trafficDelaySeconds
        ),

      trafficDelayMinutes:
        Number(
          (
            trafficDelaySeconds /
            60
          ).toFixed(1)
        ),

      encodedPolyline:
        route.polyline?.
          encodedPolyline ?? null,

      routeToken:
        route.routeToken ?? null,

      ...weatherContext,

      calculatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error conectando con Google Routes API:",
      error instanceof Error
        ? error.message
        : error
    );

    return NextResponse.json(
      {
        error:
          "No fue posible calcular la ruta.",
      },
      {
        status: 500,
      }
    );
  }
}