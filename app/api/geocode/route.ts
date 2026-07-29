import {
  NextRequest,
  NextResponse,
} from "next/server";

const GOOGLE_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";

const GOOGLE_PLACES_URL =
  "https://places.googleapis.com/v1/places";

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: {
        text?: string;
      };
      structuredFormat?: {
        mainText?: {
          text?: string;
        };
        secondaryText?: {
          text?: string;
        };
      };
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

type GooglePlaceDetailsResponse = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  error?: {
    message?: string;
    status?: string;
  };
};

function getServerApiKey() {
  return process.env
    .GOOGLE_MAPS_SERVER_API_KEY?.
    trim();
}

function normalizeSessionToken(
  value: string | null
) {
  const token = value?.trim();

  if (
    !token ||
    token.length > 128
  ) {
    return null;
  }

  return token;
}

async function getPlaceDetails(
  placeId: string,
  sessionToken: string | null,
  apiKey: string
) {
  if (
    !/^[A-Za-z0-9_-]{8,300}$/.test(
      placeId
    )
  ) {
    return NextResponse.json(
      {
        error:
          "El identificador del lugar no es válido.",
      },
      {
        status: 400,
      }
    );
  }

  const detailsUrl = new URL(
    `${GOOGLE_PLACES_URL}/${encodeURIComponent(
      placeId
    )}`
  );

  detailsUrl.searchParams.set(
    "languageCode",
    "es-MX"
  );

  detailsUrl.searchParams.set(
    "regionCode",
    "MX"
  );

  if (sessionToken) {
    detailsUrl.searchParams.set(
      "sessionToken",
      sessionToken
    );
  }

  const response = await fetch(
    detailsUrl,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "id",
          "displayName",
          "formattedAddress",
          "location",
        ].join(","),
      },
    }
  );

  const data =
    (await response.json()) as
      GooglePlaceDetailsResponse;

  if (!response.ok) {
    console.error(
      "Google Place Details respondió con error:",
      {
        status: response.status,
        googleStatus:
          data.error?.status,
        message:
          data.error?.message,
      }
    );

    return NextResponse.json(
      {
        error:
          "Google no pudo obtener los datos del lugar.",
      },
      {
        status: 502,
      }
    );
  }

  const latitude = Number(
    data.location?.latitude
  );

  const longitude = Number(
    data.location?.longitude
  );

  if (
    !data.id ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return NextResponse.json(
      {
        error:
          "El lugar seleccionado no tiene coordenadas válidas.",
      },
      {
        status: 404,
      }
    );
  }

  const address =
    data.formattedAddress?.trim() ||
    data.displayName?.text?.trim() ||
    "Ubicación seleccionada";

  const name =
    data.displayName?.text?.trim() ||
    address.split(",")[0]?.trim() ||
    "Ubicación";

  return NextResponse.json({
    placeId: data.id,
    name,
    address,
    latitude,
    longitude,
  });
}

async function autocompletePlaces(
  query: string,
  sessionToken: string | null,
  apiKey: string
) {
  const response = await fetch(
    GOOGLE_AUTOCOMPLETE_URL,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type":
          "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "suggestions.placePrediction.placeId",
          "suggestions.placePrediction.text.text",
          "suggestions.placePrediction.structuredFormat.mainText.text",
          "suggestions.placePrediction.structuredFormat.secondaryText.text",
        ].join(","),
      },
      body: JSON.stringify({
        input: query,
        languageCode: "es-MX",
        regionCode: "MX",
        includedRegionCodes: [
          "mx",
        ],
        locationBias: {
          circle: {
            center: {
              latitude: 19.0414,
              longitude: -98.2063,
            },
            radius: 80000,
          },
        },
        ...(sessionToken
          ? {
              sessionToken,
            }
          : {}),
      }),
    }
  );

  const data =
    (await response.json()) as
      GoogleAutocompleteResponse;

  if (!response.ok) {
    console.error(
      "Google Places Autocomplete respondió con error:",
      {
        status: response.status,
        googleStatus:
          data.error?.status,
        message:
          data.error?.message,
      }
    );

    return NextResponse.json(
      {
        error:
          "Google no pudo buscar ubicaciones.",
      },
      {
        status: 502,
      }
    );
  }

  const results = (
    data.suggestions ?? []
  )
    .flatMap((suggestion) => {
      const prediction =
        suggestion.placePrediction;

      if (!prediction) {
        return [];
      }

      const placeId =
        prediction.placeId?.trim();

      if (!placeId) {
        return [];
      }

      const completeText =
        prediction.text?.text?.trim() ||
        "";

      const mainText =
        prediction.structuredFormat?.
          mainText?.text?.trim() ||
        completeText.split(",")[0]?.trim() ||
        "Ubicación";

      const secondaryText =
        prediction.structuredFormat?.
          secondaryText?.text?.trim() ||
        "";

      const address =
        completeText ||
        [mainText, secondaryText]
          .filter(Boolean)
          .join(", ");

      return [
        {
          placeId,
          name: mainText,
          address,
        },
      ];
    })
    .slice(0, 6);

  return NextResponse.json(results);
}

export async function GET(
  request: NextRequest
) {
  const apiKey =
    getServerApiKey();

  if (!apiKey) {
    console.error(
      "GOOGLE_MAPS_SERVER_API_KEY no está configurada."
    );

    return NextResponse.json(
      {
        error:
          "El buscador de Google no está configurado.",
      },
      {
        status: 503,
      }
    );
  }

  const sessionToken =
    normalizeSessionToken(
      request.nextUrl.searchParams.get(
        "sessionToken"
      )
    );

  const placeId =
    request.nextUrl.searchParams.get(
      "placeId"
    )?.trim();

  try {
    if (placeId) {
      return await getPlaceDetails(
        placeId,
        sessionToken,
        apiKey
      );
    }

    const query =
      request.nextUrl.searchParams.get(
        "q"
      )?.trim();

    if (
      !query ||
      query.length < 3
    ) {
      return NextResponse.json([]);
    }

    if (query.length > 200) {
      return NextResponse.json(
        {
          error:
            "La búsqueda es demasiado larga.",
        },
        {
          status: 400,
        }
      );
    }

    return await autocompletePlaces(
      query,
      sessionToken,
      apiKey
    );
  } catch (error) {
    console.error(
      "Error conectando con Google Places:",
      error instanceof Error
        ? error.message
        : error
    );

    return NextResponse.json(
      {
        error:
          "No fue posible consultar ubicaciones.",
      },
      {
        status: 500,
      }
    );
  }
}