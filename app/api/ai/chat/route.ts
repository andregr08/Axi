import { NextResponse } from "next/server";

const MODEL = "gemini-3.5-flash";

export async function POST(request: Request) {
  try {
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

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY no configurada.",
        },
        { status: 500 }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
        }),
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", data);

      return NextResponse.json(
        {
          success: false,
          provider: "gemini",
          error:
            data?.error?.message ??
            `Gemini respondió con HTTP ${geminiResponse.status}.`,
          code: data?.error?.status ?? null,
        },
        { status: geminiResponse.status }
      );
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      console.error("Gemini sin texto:", data);

      return NextResponse.json(
        {
          success: false,
          provider: "gemini",
          error: "Gemini no devolvió contenido de texto.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: "gemini",
      response: text,
    });
  } catch (error) {
    console.error("AXI AI route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno de AXI AI.",
      },
      { status: 500 }
    );
  }
}
