import { getUserTrips } from "@/lib/ai/data";
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
    const last =
      request.messages.at(-1)?.content.toLowerCase() ?? "";

    if (
      last.includes("viajes") ||
      last.includes("mis viajes") ||
      last.includes("historial")
    ) {
      try {
        const trips = await getUserTrips(request.userId);

        return {
          content: trips.length
            ? `Encontré ${trips.length} viajes recientes en tu cuenta.`
            : "No encontré viajes registrados en tu cuenta.",
        };
      } catch {
        return {
          content:
            "No pude consultar tus viajes en este momento.",
        };
      }
    }

    return {
      content:
        "Entendido. Estoy listo para ayudarte.",
    };
  }
}

export const aiProvider = new MockAIProvider();
