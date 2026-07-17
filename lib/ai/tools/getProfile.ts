import type { AIContext } from "../prompt";

export async function getProfile(
  context: AIContext
) {
  return {
    name: context.name,
    email: context.email,
    role: context.role,
    totalTrips: context.totalTrips,
  };
}
