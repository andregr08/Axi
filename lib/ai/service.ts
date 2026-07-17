import { buildContext } from "./context";
import { buildSystemPrompt } from "./prompt";
import { GEMINI_MODEL } from "./provider";

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type AskAIParams = {
  accessToken: string;
  message: string;
  history: HistoryMessage[];
};

export async function askAI({
  accessToken,
  message,
  history,
}: AskAIParams) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada.");
  }

  const context = await buildContext(accessToken);

  const systemPrompt =
    buildSystemPrompt(context);

  const contents = [
    ...history.map((m) => ({
      role:
        m.role === "assistant"
          ? "model"
          : "user",
      parts: [
        {
          text: m.content,
        },
      ],
    })),
    {
      role: "user",
      parts: [
        {
          text: message,
        },
      ],
    },
  ];

  const response = await fetch(
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

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error?.message ??
        "Gemini error"
    );
  }

  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map(
        (p: { text?: string }) =>
          p.text ?? ""
      )
      .join("")
      .trim();

  if (!text) {
    throw new Error(
      "Gemini no respondió."
    );
  }

  return {
    context,
    response: text,
  };
}
