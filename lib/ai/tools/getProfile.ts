import type { AIToolInput } from "./types";

export async function getProfile({
  context,
}: AIToolInput) {
  return {
    name: context.name,
    email: context.email,
    role: context.role,
    totalTrips: context.totalTrips,
  };
}
