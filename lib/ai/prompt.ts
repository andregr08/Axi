export type AIUserRole =
  | "admin"
  | "driver"
  | "passenger";

export type AITripContext = {
  id: string;
  origin: string;
  destination: string;
  status: string;
  estimatedPrice: number | null;
  finalPrice: number | null;
  requestedAt: string;
};

export type AIContext = {
  userId: string;
  role: AIUserRole;
  name: string | null;
  email: string | null;
  totalTrips: number;
  recentTrips: AITripContext[];
};

function formatTrip(
  trip: AITripContext,
  index: number
) {
  return `
Viaje ${index + 1}:
- ID: ${trip.id}
- Origen: ${trip.origin}
- Destino: ${trip.destination}
- Estado: ${trip.status}
- Precio estimado: ${
    trip.estimatedPrice !== null
      ? `$${trip.estimatedPrice} MXN`
      : "No disponible"
  }
- Precio final: ${
    trip.finalPrice !== null
      ? `$${trip.finalPrice} MXN`
      : "No disponible"
  }
- Fecha: ${trip.requestedAt}
`.trim();
}

export function buildSystemPrompt(
  context: AIContext,
  toolData: unknown = null
) {
  const tripsText =
    context.recentTrips.length > 0
      ? context.recentTrips
          .map(formatTrip)
          .join("\n\n")
      : "El usuario todavía no tiene viajes registrados.";

  return `
Eres AXI AI, el asistente oficial de AXI Mobility.

DATOS DEL USUARIO AUTENTICADO

- ID: ${context.userId}
- Nombre: ${context.name ?? "No disponible"}
- Email: ${context.email ?? "No disponible"}
- Rol: ${context.role}
- Total de viajes encontrados: ${context.totalTrips}

VIAJES RECIENTES

${tripsText}

DATOS OBTENIDOS POR HERRAMIENTAS

${
  toolData !== null
    ? JSON.stringify(toolData, null, 2)
    : "No se ejecutó ninguna herramienta para esta consulta."
}

REGLAS OBLIGATORIAS

- Responde siempre en español.
- Usa únicamente la información proporcionada.
- Nunca inventes viajes, precios, conductores, pagos o ubicaciones.
- Si un dato no está disponible, dilo claramente.
- No muestres IDs internos salvo que sea necesario.
- Sé breve, natural y útil.
- Los estados de viaje están guardados en inglés, pero debes explicarlos en español.
- Puedes cancelar el viaje activo del pasajero únicamente cuando la herramienta confirme que la acción se ejecutó.
- Nunca afirmes que una acción se realizó si el resultado indica error o solicita confirmación.
- Para otras acciones todavía no disponibles, explica brevemente que aún no puedes ejecutarlas.
`.trim();
}
