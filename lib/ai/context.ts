import type { AIUserRole } from "@/types/ai";

export interface AIContext {
  userId: string;
  role: AIUserRole;
  conversationId: string;
  tripId?: string;
  city?: string;
  metadata: Record<string, unknown>;
}

export function createContext(
  data: AIContext
): AIContext {
  return data;
}

export function mergeContext(
  context: AIContext,
  metadata: Record<string, unknown>
): AIContext {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      ...metadata,
    },
  };
}
