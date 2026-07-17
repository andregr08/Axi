export interface AIMemory {
  userId: string;
  conversationId: string;
  context: Record<string, unknown>;
}

const memoryStore = new Map<string, AIMemory>();

export function saveMemory(memory: AIMemory) {
  memoryStore.set(memory.conversationId, memory);
}

export function getMemory(conversationId: string) {
  return memoryStore.get(conversationId) ?? null;
}

export function updateMemory(
  conversationId: string,
  context: Record<string, unknown>
) {
  const current = memoryStore.get(conversationId);

  if (!current) return null;

  current.context = {
    ...current.context,
    ...context,
  };

  memoryStore.set(conversationId, current);

  return current;
}

export function deleteMemory(conversationId: string) {
  memoryStore.delete(conversationId);
}
