import type { AIToolInput } from "./types";

export async function getTrips({
  context,
}: AIToolInput) {
  return context.recentTrips;
}
