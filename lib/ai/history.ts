import type { AIMessage } from "@/types/ai";

export function buildConversationHistory(
  messages: AIMessage[],
  maxMessages = 12
) {
  return messages
    .slice(-maxMessages)
    .map((message) => {
      const role =
        message.role === "assistant"
          ? "Asistente"
          : "Usuario";

      return `${role}: ${message.content}`;
    })
    .join("\n\n");
}
