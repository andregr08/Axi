import type { AIIntent } from "../intents";
import type { AITool } from "../tools";
import type { AIAction } from "../actions/index";

export type AIRoute =
  | {
      type: "tools";
      tools: AITool[];
    }
  | {
      type: "action";
      action: AIAction;
    }
  | {
      type: "chat";
    };

export const registry: Record<
  AIIntent,
  AIRoute
> = {
  chat: {
    type: "chat",
  },

  cancel_trip: {
    type: "action",
    action: "cancel_trip",
  },

  create_trip: {
    type: "chat",
  },

  show_profile: {
    type: "tools",
    tools: ["profile"],
  },

  show_payments: {
    type: "tools",
    tools: ["passenger_stats"],
  },

  passenger_stats: {
    type: "tools",
    tools: ["passenger_stats"],
  },

  trip_history: {
    type: "tools",
    tools: ["trips"],
  },
};
