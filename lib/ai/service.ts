import { buildContext } from "./context";
import {
  AI_FUNCTIONS,
  executeAIFunction,
} from "./functions";
import { buildSystemPrompt } from "./prompt";
import {
  generateGeminiContent,
  type GeminiContent,
} from "./provider";

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type AskAIParams = {
  accessToken: string;
  message: string;
  history: HistoryMessage[];
};

type GeminiPart = {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
};

function extractText(
  parts: GeminiPart[]
) {
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

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

  const systemPrompt =
    buildSystemPrompt(context, null);

  const contents: GeminiContent[] = [
    ...history.map((item) => ({
      role:
        item.role === "assistant"
          ? ("model" as const)
          : ("user" as const),
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

  const firstResult =
    await generateGeminiContent(
      apiKey,
      {
        systemInstruction: {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
        contents,
        tools: [
          {
            functionDeclarations:
              AI_FUNCTIONS,
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: "AUTO",
          },
        },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
        },
      }
    );

  const firstContent =
    firstResult.json
      ?.candidates?.[0]?.content;

  const firstParts: GeminiPart[] =
    firstContent?.parts ?? [];

  const functionCall =
    firstParts.find(
      (part) => part.functionCall
    )?.functionCall;

  if (!functionCall) {
    const text = extractText(firstParts);

    if (!text) {
      throw new Error(
        "Gemini no respondió."
      );
    }

    return {
      context,
      model: firstResult.model,
      functionName: null,
      functionData: null,
      response: text,
    };
  }

  const functionData =
    await executeAIFunction({
      name: functionCall.name,
      context,
      accessToken,
      message,
    });

  const secondContents:
    GeminiContent[] = [
    ...contents,
    {
      role: "model",
      parts: firstParts,
    },
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: functionCall.name,
            response: {
              result: functionData,
            },
          },
        },
      ],
    },
  ];

  const finalPrompt =
    buildSystemPrompt(
      context,
      functionData
    );

  const secondResult =
    await generateGeminiContent(
      apiKey,
      {
        systemInstruction: {
          parts: [
            {
              text: finalPrompt,
            },
          ],
        },
        contents: secondContents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
        },
      }
    );

  const finalParts: GeminiPart[] =
    secondResult.json
      ?.candidates?.[0]?.content
      ?.parts ?? [];

  const text = extractText(finalParts);

  if (!text) {
    throw new Error(
      "Gemini no generó la respuesta final."
    );
  }

  return {
    context,
    model: secondResult.model,
    functionName: functionCall.name,
    functionData,
    response: text,
  };
}
