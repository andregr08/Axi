import type { AIUserRole } from "@/types/ai";

export function canUseCopilot(role: AIUserRole) {
  return role === "admin";
}

export function canEscalate() {
  return true;
}
