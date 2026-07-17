import type { AIUserRole } from "@/types/ai";

export function getSuggestions(role: AIUserRole): string[] {
  if (role === "driver") {
    return [
      "Ver mis ganancias de hoy",
      "Consultar viajes disponibles",
      "Necesito ayuda con mis documentos",
      "Reportar un problema con un pasajero",
    ];
  }

  if (role === "admin") {
    return [
      "Muéstrame el reporte del día",
      "Ayúdame a crear una promoción",
      "Ver conductores pendientes",
      "Consultar tickets abiertos",
    ];
  }

  return [
    "¿Dónde está mi conductor?",
    "Necesito cancelar mi viaje",
    "Olvidé un objeto en el vehículo",
    "Quiero contactar a soporte",
  ];
}
