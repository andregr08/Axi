import { getPassengerStats } from "./getPassengerStats";
import { getProfile } from "./getProfile";
import { getTrips } from "./getTrips";
import type {
  AIToolFunction,
  AIToolInput,
} from "./types";

export type AITool =
  | "profile"
  | "trips"
  | "passenger_stats";

const registry: Record<
  AITool,
  AIToolFunction
> = {
  profile: getProfile,
  trips: getTrips,
  passenger_stats: getPassengerStats,
};

export function hasTool(
  tool: string
): tool is AITool {
  return Object.prototype.hasOwnProperty.call(
    registry,
    tool
  );
}

export async function executeTool(
  tool: AITool,
  input: AIToolInput
) {
  return registry[tool](input);
}
