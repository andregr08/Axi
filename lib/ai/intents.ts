export type AIIntent =
  | "chat"
  | "passenger_stats"
  | "trip_history"
  | "cancel_trip"
  | "create_trip"
  | "show_profile"
  | "show_payments";

export function detectIntent(
  message: string
): AIIntent {
  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    text.includes("cancelar") ||
    text.includes("cancela mi viaje") ||
    text.includes("cancelar viaje")
  ) {
    return "cancel_trip";
  }

  if (
    text.includes("pedir viaje") ||
    text.includes("solicitar viaje") ||
    text.includes("crear viaje")
  ) {
    return "create_trip";
  }

  if (
    text.includes("historial") ||
    text.includes("viajes recientes") ||
    text.includes("ultimo viaje") ||
    text.includes("mis viajes")
  ) {
    return "trip_history";
  }

  if (
    text.includes("cuanto he gastado") ||
    text.includes("cuanto gaste") ||
    text.includes("cuantos viajes") ||
    text.includes("kilometros") ||
    text.includes("estadisticas") ||
    text.includes("resumen de viajes")
  ) {
    return "passenger_stats";
  }

  if (
    text.includes("perfil") ||
    text.includes("mi cuenta") ||
    text.includes("mis datos")
  ) {
    return "show_profile";
  }

  if (
    text.includes("pago") ||
    text.includes("tarjeta") ||
    text.includes("metodo de pago") ||
    text.includes("recibo")
  ) {
    return "show_payments";
  }

  return "chat";
}
