import { NextRequest, NextResponse } from "next/server";

const OSRM_URL =
  "https://router.project-osrm.org/route/v1/driving";

export async function GET(request: NextRequest) {
  const originLat = Number(
    request.nextUrl.searchParams.get("originLat")
  );
  const originLng = Number(
    request.nextUrl.searchParams.get("originLng")
  );
  const destinationLat = Number(
    request.nextUrl.searchParams.get("destinationLat")
  );
  const destinationLng = Number(
    request.nextUrl.searchParams.get("destinationLng")
  );

  const coordinates = [
    originLat,
    originLng,
    destinationLat,
    destinationLng,
  ];

  if (!coordinates.every(Number.isFinite)) {
    return NextResponse.json(
      { error: "Coordenadas inválidas." },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
    alternatives: "false",
  });

  try {
    const url =
      `${OSRM_URL}/` +
      `${originLng},${originLat};` +
      `${destinationLng},${destinationLat}` +
      `?${params.toString()}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "AXI-Mobility/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `OSRM respondió ${response.status}`
      );
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      return NextResponse.json(
        { error: "No encontramos una ruta disponible." },
        { status: 404 }
      );
    }

    const coordinatesGeoJson =
      route.geometry?.coordinates ?? [];

    const routePoints = coordinatesGeoJson.map(
      (point: [number, number]) => ({
        lat: point[1],
        lng: point[0],
      })
    );

    return NextResponse.json({
      distanceKm: Number(
        (route.distance / 1000).toFixed(2)
      ),
      durationMinutes: Math.max(
        1,
        Math.round(route.duration / 60)
      ),
      routePoints,
    });
  } catch (error) {
    console.error("Error calculando ruta:", error);

    return NextResponse.json(
      { error: "No fue posible calcular la ruta." },
      { status: 500 }
    );
  }
}
