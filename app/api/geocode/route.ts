import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json([]);
  }

  const params = new URLSearchParams({
    q: `${query}, Puebla, México`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "mx",
    viewbox: "-98.45,19.25,-97.95,18.80",
    bounded: "0",
  });

  try {
    const response = await fetch(
      `${NOMINATIM_URL}?${params.toString()}`,
      {
        headers: {
          "User-Agent": "AXI-Mobility/1.0",
          "Accept-Language": "es-MX,es;q=0.9",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "Nominatim respondió:",
        response.status,
        response.statusText
      );

      return NextResponse.json(
        { error: "No fue posible consultar ubicaciones." },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error consultando Nominatim:", error);

    return NextResponse.json(
      { error: "Error conectando con el buscador." },
      { status: 500 }
    );
  }
}
