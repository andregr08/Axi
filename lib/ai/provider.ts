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
    _request: AIProviderRequest
  ): Promise<AIProviderResponse> {
    return {
      content:
        "AXI AI está funcionando correctamente. Próximamente esta respuesta será generada por OpenAI.",
      actions: [],
    };
  }
}

export const aiProvider = new MockAIProvider();
