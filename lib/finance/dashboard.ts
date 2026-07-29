import { supabase } from "@/lib/supabaseClient";

type FinanceSummaryRow = {
  total_wallets: number | string | null;
  total_available_balance: number | string | null;
  total_pending_balance: number | string | null;
  pending_withdrawals: number | string | null;
  pending_withdrawal_amount: number | string | null;
  total_reserved_balance: number | string | null;
};

type CashDebtRow = {
  cash_debt: number | string | null;
};

type CommissionRow = {
  commission_amount: number | string | null;
};

export type FinanceDashboard = {
  totalWallets: number;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;

  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;

  pendingRefunds: number;
  cashDebt: number;
  commissionsToday: number;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getLocalStartOfDayISO() {
  const now = new Date();

  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );

  return startOfDay.toISOString();
}

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  const startOfDay = getLocalStartOfDayISO();

  const [
    summaryResult,
    cashDebtResult,
    commissionsResult,
    refundsResult,
  ] = await Promise.all([
    supabase
      .from("finance_dashboard_summary")
      .select("*")
      .single(),

    supabase
      .from("cash_debts_view")
      .select("cash_debt"),

    supabase
      .from("driver_commissions_view")
      .select("commission_amount")
      .gte("created_at", startOfDay),

    supabase
      .from("refund_requests")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending"),
  ]);

  if (summaryResult.error) {
    throw new Error(
      `No se pudo cargar el resumen financiero: ${summaryResult.error.message}`,
    );
  }

  if (cashDebtResult.error) {
    throw new Error(
      `No se pudo cargar la deuda en efectivo: ${cashDebtResult.error.message}`,
    );
  }

  if (commissionsResult.error) {
    throw new Error(
      `No se pudieron cargar las comisiones: ${commissionsResult.error.message}`,
    );
  }

  if (refundsResult.error) {
    throw new Error(
      `No se pudieron cargar los reembolsos: ${refundsResult.error.message}`,
    );
  }

  const summary = summaryResult.data as FinanceSummaryRow;

  const cashDebt = ((cashDebtResult.data ?? []) as CashDebtRow[]).reduce(
    (total, row) => total + toNumber(row.cash_debt),
    0,
  );

  const commissionsToday = (
    (commissionsResult.data ?? []) as CommissionRow[]
  ).reduce(
    (total, row) => total + toNumber(row.commission_amount),
    0,
  );

  return {
    totalWallets: toNumber(summary.total_wallets),
    availableBalance: toNumber(summary.total_available_balance),
    pendingBalance: toNumber(summary.total_pending_balance),
    reservedBalance: toNumber(summary.total_reserved_balance),

    pendingWithdrawals: toNumber(summary.pending_withdrawals),
    pendingWithdrawalAmount: toNumber(
      summary.pending_withdrawal_amount,
    ),


    pendingRefunds: refundsResult.count ?? 0,
    cashDebt,
    commissionsToday,
  };
}
