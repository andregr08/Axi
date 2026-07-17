import { getActiveTrip, getUserTrips } from "@/lib/ai/data";
import { detectIntent } from "@/lib/ai/intents";
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
    try {
      const lastMessage =
        request.messages.at(-1)?.content ?? "";

      const intent = detectIntent(lastMessage);

      switch (intent) {
        case "active_trip": {
          const trip = await getActiveTrip(request.userId);

          return {
            content: trip
              ? `Tu viaje está actualmente en estado: ${trip.status}.`
              : "No tienes ningún viaje activo.",
          };
        }

        case "trip_history": {
          const trips = await getUserTrips(request.userId);

          return {
            content: `Encontré ${trips.length} viajes recientes en tu cuenta.`,
          };
        }

        case "payments":
          return {
            content:
              "Próximamente podré consultar pagos y reembolsos.",
          };

        case "support":
          return {
            content:
              "Si no puedo resolver tu problema, crearé un ticket automáticamente.",
          };

        case "driver":
          return {
            content:
              "Puedo ayudarte con información relacionada con conductores.",
          };

        case "admin":
          return {
            content:
              "Las funciones administrativas estarán disponibles para administradores.",
          };

        default:
          return {
            content:
              "Entendido. ¿En qué más puedo ayudarte?",
          };
      }
    } catch {
      return {
        content:
          "Ocurrió un error al consultar la información.",
      };
    }
  }
}

export const aiProvider = new MockAIProvider();
