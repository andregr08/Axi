import type { AIIntent } from "../intents";
import type { AITool } from "../tools";

export const registry: Record<
  AIIntent,
  AITool[]
> = {
  chat: [],
  cancel_trip: [],
  create_trip: [],
  show_profile: ["profile"],
  show_payments: ["passenger_stats"],
  passenger_stats: ["passenger_stats"],
  trip_history: ["trips"],
};
