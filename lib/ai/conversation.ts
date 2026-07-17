import type {
  AIConversation,
  AIMessage,
} from "@/types/ai";

export function createConversation(): AIConversation {
  return {
    id: crypto.randomUUID(),
    title: "Nueva conversación",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    messages: [...conversation.messages, message],
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
