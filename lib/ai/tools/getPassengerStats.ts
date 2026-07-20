import { getPassengerStats as queryPassengerStats } from "../stats";
import type { AIToolInput } from "./types";

export async function getPassengerStats({
  accessToken,
  context,
}: AIToolInput) {
  if (context.role !== "passenger") {
    return {
      available: false,
      reason:
        "Estas estadísticas están disponibles para pasajeros.",
    };
  }

  return queryPassengerStats(
    accessToken,
    context.userId
  );
}
