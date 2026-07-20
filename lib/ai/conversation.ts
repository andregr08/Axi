import type {
  AIConversation,
  AIMessage,
} from "@/types/ai";

export function createConversation(
  userId = ""
): AIConversation {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    userId,
    title: "Nueva conversación",
    status: "active",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function addMessage(
  conversation: AIConversation,
  message: AIMessage
): AIConversation {
  return {
    ...conversation,
    updatedAt: new Date().toISOString(),
    messages: [
      ...conversation.messages,
      message,
    ],
  };
}

export function closeConversation(
  conversation: AIConversation
): AIConversation {
  return {
    ...conversation,
    status: "closed",
    updatedAt: new Date().toISOString(),
  };
}
