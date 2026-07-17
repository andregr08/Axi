export type AIPageContext = {
  page: string;

  selectedTripId?: string | null;

  selectedVehicleId?: string | null;

  selectedDriverId?: string | null;

  selectedPassengerId?: string | null;

  selectedPaymentId?: string | null;

  filters?: Record<string, unknown>;

  timestamp: string;
};

export function createPageContext(
  context: Partial<AIPageContext>
): AIPageContext {
  return {
    page: context.page ?? "/",

    selectedTripId:
      context.selectedTripId ?? null,

    selectedVehicleId:
      context.selectedVehicleId ?? null,

    selectedDriverId:
      context.selectedDriverId ?? null,

    selectedPassengerId:
      context.selectedPassengerId ?? null,

    selectedPaymentId:
      context.selectedPaymentId ?? null,

    filters: context.filters ?? {},

    timestamp: new Date().toISOString(),
  };
}
