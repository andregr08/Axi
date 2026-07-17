import type { AIContext } from "../prompt";

export async function getTrips(
  context: AIContext
) {
  return context.recentTrips;
}
