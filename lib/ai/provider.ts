import { getActiveTrip, getUserTrips } from "@/lib/ai/data";
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

    try {
      if (
        last.includes("viaje actual") ||
        last.includes("mi viaje") ||
        last.includes("dónde está mi conductor")
      ) {
        const trip = await getActiveTrip(request.userId);

        if (!trip) {
          return {
            content: "No tienes un viaje activo en este momento.",
          };
        }

        return {
          content: `Tu viaje está en estado: ${trip.status}.`,
        };
      }

      if (
        last.includes("historial") ||
        last.includes("mis viajes")
      ) {
        const trips = await getUserTrips(request.userId);

        return {
          content: `Encontré ${trips.length} viajes recientes.`,
        };
      }

      return {
        content: "Entendido. ¿En qué más puedo ayudarte?",
      };
    } catch {
      return {
        content:
          "Ocurrió un error al consultar tu información.",
      };
    }
  }
}

export const aiProvider = new MockAIProvider();
