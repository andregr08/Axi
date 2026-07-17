import { NextResponse } from "next/server";
import { askAI } from "@/lib/ai/service";

export async function POST(request: Request) {
  try {
    const authorization =
      request.headers.get("authorization");

    const accessToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Sesión requerida.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Mensaje requerido.",
        },
        { status: 400 }
      );
    }

    const result = await askAI({
      accessToken,
      message,
      history: Array.isArray(body?.history)
        ? body.history
        : [],
    });

    return NextResponse.json({
      success: true,
      provider: "gemini",
      response: result.response,
    });
  } catch (error) {
    console.error("AXI AI route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno de AXI AI.",
      },
      { status: 500 }
    );
  }
}
