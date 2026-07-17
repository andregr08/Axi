import type { AIContext } from "../prompt";
import { getProfile } from "./getProfile";
import { getTrips } from "./getTrips";

export type AITool =
  | "profile"
  | "trips";

type ToolFunction = (
  context: AIContext
) => Promise<unknown>;

const registry: Record<
  AITool,
  ToolFunction
> = {
  profile: getProfile,
  trips: getTrips,
};

export async function executeTool(
  tool: AITool,
  context: AIContext
) {
  return registry[tool](context);
}

export function hasTool(
  tool: string
): tool is AITool {
  return tool in registry;
}
