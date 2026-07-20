export type AIActionType =
  | "create_ticket"
  | "cancel_trip"
  | "refund_trip"
  | "approve_driver"
  | "reject_driver"
  | "create_promotion";

export interface AIAction {
  type: AIActionType;
  title: string;
  description: string;
  requiresConfirmation: boolean;
}

export const AI_ACTIONS: Record<AIActionType, AIAction> = {
  create_ticket: {
    type: "create_ticket",
    title: "Crear ticket",
    description: "Escalar el caso a un humano.",
    requiresConfirmation: false,
  },
  cancel_trip: {
    type: "cancel_trip",
    title: "Cancelar viaje",
    description: "Cancelar el viaje actual.",
    requiresConfirmation: true,
  },
  refund_trip: {
    type: "refund_trip",
    title: "Reembolsar viaje",
    description: "Solicitar un reembolso.",
    requiresConfirmation: true,
  },
  approve_driver: {
    type: "approve_driver",
    title: "Aprobar conductor",
    description: "Aprobar el registro del conductor.",
    requiresConfirmation: true,
  },
  reject_driver: {
    type: "reject_driver",
    title: "Rechazar conductor",
    description: "Rechazar el registro del conductor.",
    requiresConfirmation: true,
  },
  create_promotion: {
    type: "create_promotion",
    title: "Crear promoción",
    description: "Crear una nueva promoción.",
    requiresConfirmation: true,
  },
};
