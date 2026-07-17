export const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

type GeminiRequestBody = {
  systemInstruction: {
    parts: Array<{ text: string }>;
  };
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
};

const wait = (milliseconds: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

export async function generateGeminiContent(
  apiKey: string,
  body: GeminiRequestBody
) {
  let lastError =
    "No fue posible comunicarse con Gemini.";

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );

      const json = await response.json().catch(() => null);

      if (response.ok) {
        return {
          model,
          json,
        };
      }

      lastError =
        json?.error?.message ??
        `Gemini respondió con ${response.status}.`;

      const retryable =
        response.status === 429 ||
        response.status === 503;

      if (!retryable) {
        throw new Error(lastError);
      }

      if (attempt < 2) {
        await wait(800 * 2 ** attempt);
      }
    }
  }

  throw new Error(
    `AXI AI está temporalmente saturado. Intenta nuevamente en unos segundos. Detalle: ${lastError}`
  );
}
