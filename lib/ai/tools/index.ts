import type { AIContext } from "../prompt";
import { getProfile } from "./getProfile";
import { getTrips } from "./getTrips";

export async function executeTool(
  tool: string,
  context: AIContext
) {
  switch (tool) {
    case "profile":
      return await getProfile(context);

    case "trips":
      return await getTrips(context);

    default:
      return null;
  }
}
