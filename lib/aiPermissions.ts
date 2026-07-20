import type { AIUserRole } from "@/types/ai";

export function canUseCopilot(role: AIUserRole) {
  return (
    role === "director_general" ||
    role === "admin" ||
    role === "support" ||
    role === "finance"
  );
}

export function canEscalate() {
  return true;
}
