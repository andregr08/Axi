export type AIIntent =
  | "chat"
  | "cancel_trip"
  | "create_trip"
  | "show_profile"
  | "show_payments";

export function detectIntent(
  message: string
): AIIntent {
  const text = message.toLowerCase();

  if (
    text.includes("cancel") ||
    text.includes("cancelar")
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
    text.includes("perfil") ||
    text.includes("mi cuenta")
  ) {
    return "show_profile";
  }

  if (
    text.includes("pago") ||
    text.includes("tarjeta") ||
    text.includes("recibo")
  ) {
    return "show_payments";
  }

  return "chat";
}
