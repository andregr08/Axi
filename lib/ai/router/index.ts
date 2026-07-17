import type { AIIntent } from "../intents";
import type { AITool } from "../tools";

const intentToolRegistry: Partial<
  Record<AIIntent, AITool>
> = {
  passenger_stats: "passenger_stats",
  trip_history: "trips",
  show_profile: "profile",
  show_payments: "passenger_stats",
};

export function resolveTool(
  intent: AIIntent
): AITool | null {
  return intentToolRegistry[intent] ?? null;
}
