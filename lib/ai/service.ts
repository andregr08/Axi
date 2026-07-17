import { buildContext } from "./context";
import { detectIntent } from "./intents";
import { buildSystemPrompt } from "./prompt";
import { generateGeminiContent } from "./provider";
import { executeIntent } from "./router";

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
  const apiKey =
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY no configurada."
    );
  }

  const context =
    await buildContext(accessToken);

  const intent = detectIntent(message);

  const toolData = await executeIntent({
    intent,
    context,
    accessToken,
    message,
  });

  const systemPrompt = buildSystemPrompt(
    context,
    toolData
  );

  const contents = [
    ...history.map((item) => ({
      role:
        item.role === "assistant"
          ? "model"
          : "user",
      parts: [
        {
          text: item.content,
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

  const { json, model } =
    await generateGeminiContent(apiKey, {
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
    });

  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map(
        (part: { text?: string }) =>
          part.text ?? ""
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
    intent,
    toolData,    model,
    response: text,
  };
}
