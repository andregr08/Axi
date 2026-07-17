import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const message =
      body?.message ??
      "Hola";

    return NextResponse.json({
      success: true,
      provider: "mock",
      response: `Recibí tu mensaje: "${message}". Pronto responderé usando Gemini AI.`,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Solicitud inválida.",
      },
      {
        status: 400,
      }
    );
  }
}
