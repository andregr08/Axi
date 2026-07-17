import type { AIConversation } from "@/types/ai";

const conversations = new Map<string, AIConversation>();

export function saveConversation(
  conversation: AIConversation
) {
  conversations.set(conversation.id, conversation);
}

export function getConversation(id: string) {
  return conversations.get(id) ?? null;
}

export function getAllConversations() {
  return Array.from(conversations.values()).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
  );
}

export function deleteConversation(id: string) {
  conversations.delete(id);
}
