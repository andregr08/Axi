import { NextResponse } from "next/server";
import { buildContext } from "@/lib/ai/context";
import { GEMINI_MODEL } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/prompt";

type IncomingHistoryMessage = {
  role?: unknown;
  content?: unknown;
};

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{
    text: string;
  }>;
};

function parseHistory(
  value: unknown
): GeminiContent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-12)
    .map((item: IncomingHistoryMessage) => {
      const role =
        item?.role === "assistant"
          ? "model"
          : item?.role === "user"
            ? "user"
            : null;

      const content =
        typeof item?.content === "string"
          ? item.content.trim()
          : "";

      if (!role || !content) {
        return null;
      }

      return {
        role,
        parts: [
          {
            text: content.slice(0, 4000),
          },
        ],
      } satisfies GeminiContent;
    })
    .filter(
      (
        item
      ): item is GeminiContent =>
        item !== null
    );
}

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

    const apiKey =
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY no configurada.",
        },
        { status: 500 }
      );
    }

    const context =
      await buildContext(accessToken);

    const systemPrompt =
      buildSystemPrompt(context);

    const history =
      parseHistory(body?.history);

    const contents: GeminiContent[] = [
      ...history,
      {
        role: "user",
        parts: [
          {
            text: message.slice(0, 4000),
          },
        ],
      },
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: systemPrompt,
              },
            ],
          },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
          },
        }),
      }
    );

    const data =
      await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error(
        "Gemini API error:",
        data
      );

      return NextResponse.json(
        {
          success: false,
          provider: "gemini",
          error:
            data?.error?.message ??
            "Gemini no pudo responder.",
        },
        {
          status:
            geminiResponse.status,
        }
      );
    }

    const text =
      data?.candidates?.[0]?.content
        ?.parts
        ?.map(
          (part: { text?: string }) =>
            part.text ?? ""
        )
        .join("")
        .trim();

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          provider: "gemini",
          error:
            "Gemini no devolvió una respuesta.",
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
    console.error(
      "AXI AI route error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Error interno de AXI AI.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
