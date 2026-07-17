import { registry } from "./registry";
import type { AIIntent } from "../intents";
import { executeTool } from "../tools";
import type { AIContext } from "../prompt";

export async function executeIntent(
  intent: AIIntent,
  context: AIContext,
  accessToken: string
) {
  const tools = registry[intent] ?? [];

  const results: Record<string, unknown> = {};

  for (const tool of tools) {
    results[tool] = await executeTool(tool, {
      context,
      accessToken,
    });
  }

  return results;
}
