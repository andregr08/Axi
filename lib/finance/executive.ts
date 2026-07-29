import { supabase } from "@/lib/supabaseClient";

type NumericValue = number | string | null;

type FinanceExecutiveKpisRow = {
  generated_at: string | null;
  paid_payments: NumericValue;
  gross_booking_value: NumericValue;
  platform_revenue: NumericValue;
  total_expenses: NumericValue;
  net_operating_result: NumericValue;
  driver_net_earnings: NumericValue;
};

export type FinanceExecutiveKpis = {
  generatedAt: string | null;
  paidPayments: number;
  grossBookingValue: number;
  platformRevenue: number;
  totalExpenses: number;
  netOperatingResult: number;
  driverNetEarnings: number;
};

function toNumber(value: NumericValue | undefined): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getFinanceExecutiveKpis(): Promise<FinanceExecutiveKpis> {
  const { data, error } = await supabase
    .from("finance_executive_kpis_v1")
    .select(
      [
        "generated_at",
        "paid_payments",
        "gross_booking_value",
        "platform_revenue",
        "total_expenses",
        "net_operating_result",
        "driver_net_earnings",
      ].join(","),
    )
    .single();

  if (error) {
    throw new Error(
      `No se pudieron cargar los KPIs ejecutivos: ${error.message}`,
    );
  }

  const row = data as unknown as FinanceExecutiveKpisRow;

  return {
    generatedAt: row.generated_at,
    paidPayments: toNumber(row.paid_payments),
    grossBookingValue: toNumber(row.gross_booking_value),
    platformRevenue: toNumber(row.platform_revenue),
    totalExpenses: toNumber(row.total_expenses),
    netOperatingResult: toNumber(row.net_operating_result),
    driverNetEarnings: toNumber(row.driver_net_earnings),
  };
}
