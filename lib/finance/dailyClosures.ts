import { supabase } from "@/lib/supabaseClient";

export type FinanceDailyClosure = {
  id: string;
  closure_folio: string;
  finance_date: string;
  status: "closed" | "reopened" | "superseded";
  currency: string;

  paid_payments: number;
  gross_revenue: number;
  platform_commission: number;
  gross_driver_earnings: number;
  net_driver_earnings: number;

  cash_amount: number;
  digital_amount: number;

  platform_commission_iva: number;
  iva_withholding: number;
  isr_withholding: number;

  pending_refunds: number;
  pending_refund_amount: number;
  approved_refunds: number;
  approved_refund_amount: number;

  open_withdrawals: number;
  open_withdrawal_amount: number;

  cash_debt_total: number;
  available_wallet_balance: number;
  pending_wallet_balance: number;
  reserved_wallet_balance: number;

  posted_financial_transactions: number;
  pending_financial_transactions: number;
  reversed_financial_transactions: number;

  unreconciled_payments: number;
  unreconciled_amount: number;

  integrity_hash: string;
  integrity_valid: boolean;

  closed_by: string | null;
  closed_at: string;
  reopened_by: string | null;
  reopened_at: string | null;
  reopening_reason: string | null;

  created_at: string;
  updated_at: string;
};

type VerifyClosureResult = {
  closure_id: string;
  closure_folio: string;
  stored_hash: string;
  calculated_hash: string;
  is_valid: boolean;
};

function normalizeClosure(
  value: Record<string, unknown>,
): FinanceDailyClosure {
  return {
    id: String(value.id),
    closure_folio: String(value.closure_folio),
    finance_date: String(value.finance_date),
    status: value.status as FinanceDailyClosure["status"],
    currency: String(value.currency ?? "MXN"),

    paid_payments: Number(value.paid_payments ?? 0),
    gross_revenue: Number(value.gross_revenue ?? 0),
    platform_commission: Number(
      value.platform_commission ?? 0,
    ),
    gross_driver_earnings: Number(
      value.gross_driver_earnings ?? 0,
    ),
    net_driver_earnings: Number(
      value.net_driver_earnings ?? 0,
    ),

    cash_amount: Number(value.cash_amount ?? 0),
    digital_amount: Number(value.digital_amount ?? 0),

    platform_commission_iva: Number(
      value.platform_commission_iva ?? 0,
    ),
    iva_withholding: Number(
      value.iva_withholding ?? 0,
    ),
    isr_withholding: Number(
      value.isr_withholding ?? 0,
    ),

    pending_refunds: Number(
      value.pending_refunds ?? 0,
    ),
    pending_refund_amount: Number(
      value.pending_refund_amount ?? 0,
    ),
    approved_refunds: Number(
      value.approved_refunds ?? 0,
    ),
    approved_refund_amount: Number(
      value.approved_refund_amount ?? 0,
    ),

    open_withdrawals: Number(
      value.open_withdrawals ?? 0,
    ),
    open_withdrawal_amount: Number(
      value.open_withdrawal_amount ?? 0,
    ),

    cash_debt_total: Number(
      value.cash_debt_total ?? 0,
    ),
    available_wallet_balance: Number(
      value.available_wallet_balance ?? 0,
    ),
    pending_wallet_balance: Number(
      value.pending_wallet_balance ?? 0,
    ),
    reserved_wallet_balance: Number(
      value.reserved_wallet_balance ?? 0,
    ),

    posted_financial_transactions: Number(
      value.posted_financial_transactions ?? 0,
    ),
    pending_financial_transactions: Number(
      value.pending_financial_transactions ?? 0,
    ),
    reversed_financial_transactions: Number(
      value.reversed_financial_transactions ?? 0,
    ),

    unreconciled_payments: Number(
      value.unreconciled_payments ?? 0,
    ),
    unreconciled_amount: Number(
      value.unreconciled_amount ?? 0,
    ),

    integrity_hash: String(value.integrity_hash ?? ""),
    integrity_valid: Boolean(value.integrity_valid),

    closed_by:
      typeof value.closed_by === "string"
        ? value.closed_by
        : null,
    closed_at: String(value.closed_at),
    reopened_by:
      typeof value.reopened_by === "string"
        ? value.reopened_by
        : null,
    reopened_at:
      typeof value.reopened_at === "string"
        ? value.reopened_at
        : null,
    reopening_reason:
      typeof value.reopening_reason === "string"
        ? value.reopening_reason
        : null,

    created_at: String(value.created_at),
    updated_at: String(value.updated_at),
  };
}

export async function getFinanceDailyClosures() {
  const { data, error } = await supabase
    .from("finance_daily_closures_view")
    .select("*")
    .order("finance_date", { ascending: false })
    .order("closed_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) =>
    normalizeClosure(item),
  );
}

export async function closeFinanceDay(
  financeDate: string,
) {
  const { data, error } = await supabase.rpc(
    "close_finance_day",
    {
      p_date: financeDate,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeClosure(
    data as Record<string, unknown>,
  );
}

export async function reopenFinanceDay(
  closureId: string,
  reason: string,
) {
  const { data, error } = await supabase.rpc(
    "reopen_finance_day",
    {
      p_closure_id: closureId,
      p_reason: reason,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeClosure(
    data as Record<string, unknown>,
  );
}

export async function verifyFinanceClosure(
  closureId: string,
) {
  const { data, error } = await supabase.rpc(
    "verify_finance_closure",
    {
      p_closure_id: closureId,
    },
  );

  if (error) {
    throw error;
  }

  const result = Array.isArray(data)
    ? data[0]
    : data;

  if (!result) {
    throw new Error(
      "No se encontró el cierre financiero.",
    );
  }

  return result as VerifyClosureResult;
}
