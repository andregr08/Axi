import type {
  GeminiFunctionDeclaration,
} from "./provider";
import type { AIContext } from "./prompt";
import { executeAction } from "./actions/index";
import { executeTool } from "./tools";

export const AI_FUNCTIONS:
  GeminiFunctionDeclaration[] = [
  {
    name: "get_profile",
    description:
      "Obtiene el perfil del usuario autenticado, incluyendo nombre, correo, rol y cantidad total de viajes.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_recent_trips",
    description:
      "Obtiene los viajes recientes del usuario autenticado.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_passenger_stats",
    description:
      "Obtiene estadísticas del pasajero: viajes, gasto, kilómetros y método de pago favorito.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "cancel_active_trip",
    description:
      "Intenta cancelar el viaje activo del pasajero. Solo debe elegirse cuando el usuario pide cancelar un viaje. La función valida internamente la confirmación explícita.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
];

type ExecuteAIFunctionParams = {
  name: string;
  context: AIContext;
  accessToken: string;
  message: string;
};

export async function executeAIFunction({
  name,
  context,
  accessToken,
  message,
}: ExecuteAIFunctionParams) {
  switch (name) {
    case "get_profile":
      return executeTool("profile", {
        context,
        accessToken,
      });

    case "get_recent_trips":
      return executeTool("trips", {
        context,
        accessToken,
      });

    case "get_passenger_stats":
      return executeTool(
        "passenger_stats",
        {
          context,
          accessToken,
        }
      );

    case "cancel_active_trip":
      return executeAction(
        "cancel_trip",
        {
          context,
          accessToken,
          message,
        }
      );

    default:
      return {
        success: false,
        code: "UNKNOWN_FUNCTION",
        message:
          "La función solicitada no existe.",
      };
  }
}
