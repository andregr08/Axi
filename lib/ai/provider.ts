import type { AIMessage } from "@/types/ai";

export interface AIProviderRequest {
  conversationId: string;
  userId: string;
  messages: AIMessage[];
}

export interface AIProviderResponse {
  content: string;
  actions?: string[];
}

export interface AIProvider {
  generateResponse(
    request: AIProviderRequest
  ): Promise<AIProviderResponse>;
}

export class MockAIProvider implements AIProvider {
  async generateResponse(
    request: AIProviderRequest
  ): Promise<AIProviderResponse> {
    const lastMessage =
      request.messages.at(-1)?.content.toLowerCase() ?? "";

    if (lastMessage.includes("hola")) {
      return {
        content: "¡Hola! Soy AXI AI. ¿En qué puedo ayudarte?",
      };
    }

    if (lastMessage.includes("viaje")) {
      return {
        content:
          "Puedo ayudarte con el estado de un viaje, cancelaciones o reportes.",
      };
    }

    if (
      lastMessage.includes("pago") ||
      lastMessage.includes("dinero")
    ) {
      return {
        content:
          "También puedo ayudarte con pagos, reembolsos y facturación.",
      };
    }

    return {
      content:
        "Entendido. Esta respuesta aún es simulada. En la siguiente fase responderé usando OpenAI con información real de AXI.",
    };
  }
}

export const aiProvider = new MockAIProvider();
