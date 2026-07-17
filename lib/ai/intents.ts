export type AIIntent =
  | "active_trip"
  | "trip_history"
  | "payments"
  | "support"
  | "driver"
  | "admin"
  | "general";

export function detectIntent(message: string): AIIntent {
  const text = message.toLowerCase();

  if (
    text.includes("viaje actual") ||
    text.includes("mi viaje") ||
    text.includes("conductor")
  ) {
    return "active_trip";
  }

  if (
    text.includes("historial") ||
    text.includes("mis viajes")
  ) {
    return "trip_history";
  }

  if (
    text.includes("pago") ||
    text.includes("reembolso") ||
    text.includes("factura")
  ) {
    return "payments";
  }

  if (
    text.includes("soporte") ||
    text.includes("ayuda") ||
    text.includes("ticket")
  ) {
    return "support";
  }

  if (
    text.includes("conductor") ||
    text.includes("chofer")
  ) {
    return "driver";
  }

  if (
    text.includes("admin") ||
    text.includes("administrador")
  ) {
    return "admin";
  }

  return "general";
}
