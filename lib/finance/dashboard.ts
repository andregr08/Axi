import { supabase } from "@/lib/supabaseClient";

type NumericValue = number | string | null;

type FinanceDashboardRow = {
  generated_at: string | null;

  total_paid_payments: NumericValue;
  pending_payments: NumericValue;
  failed_payments: NumericValue;
  refunded_payments: NumericValue;

  gross_revenue_all_time: NumericValue;
  gross_revenue_today: NumericValue;
  gross_revenue_week: NumericValue;
  gross_revenue_month: NumericValue;
  gross_revenue_year: NumericValue;

  platform_commission_all_time: NumericValue;
  platform_commission_today: NumericValue;
  platform_commission_month: NumericValue;

  gross_driver_earnings_all_time: NumericValue;
  net_driver_earnings_all_time: NumericValue;
  net_driver_earnings_month: NumericValue;

  cash_payments_amount: NumericValue;
  digital_payments_amount: NumericValue;
  cash_payments_count: NumericValue;
  digital_payments_count: NumericValue;

  passenger_wallet_applied_total: NumericValue;

  total_driver_wallets: NumericValue;
  total_available_balance: NumericValue;
  total_pending_balance: NumericValue;
  total_reserved_balance: NumericValue;
  total_cash_debt: NumericValue;
  wallet_lifetime_earnings: NumericValue;
  total_withdrawn: NumericValue;

  open_withdrawals: NumericValue;
  open_withdrawal_amount: NumericValue;
  paid_withdrawals: NumericValue;
  paid_withdrawal_amount: NumericValue;
  failed_withdrawals: NumericValue;

  pending_refunds: NumericValue;
  pending_refund_amount: NumericValue;
  approved_refunds: NumericValue;
  approved_refund_amount: NumericValue;
  rejected_refunds: NumericValue;

  platform_commission_iva_total: NumericValue;
  iva_withholding_total: NumericValue;
  isr_withholding_total: NumericValue;

  posted_financial_transactions: NumericValue;
  pending_financial_transactions: NumericValue;
  reversed_financial_transactions: NumericValue;

  net_platform_revenue_before_expenses: NumericValue;
};

type DailyRevenueRow = {
  finance_date: string;
  paid_payments: NumericValue;
  gross_revenue: NumericValue;
  platform_commission: NumericValue;
  gross_driver_earnings: NumericValue;
  net_driver_earnings: NumericValue;
  cash_amount: NumericValue;
  digital_amount: NumericValue;
  platform_commission_iva: NumericValue;
  iva_withholding: NumericValue;
  isr_withholding: NumericValue;
};

type ReconciliationRow = {
  reconciliation_status: string | null;
  total_amount: NumericValue;
};

export type FinanceDailyRevenue = {
  date: string;
  paidPayments: number;
  grossRevenue: number;
  platformCommission: number;
  grossDriverEarnings: number;
  netDriverEarnings: number;
  cashAmount: number;
  digitalAmount: number;
  platformCommissionIva: number;
  ivaWithholding: number;
  isrWithholding: number;
};

export type FinanceReconciliation = {
  status: string;
  payments: number;
  totalAmount: number;
};

export type FinanceDashboard = {
  generatedAt: string | null;

  totalPaidPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;

  grossRevenueAllTime: number;
  grossRevenueToday: number;
  grossRevenueWeek: number;
  grossRevenueMonth: number;
  grossRevenueYear: number;

  platformCommissionAllTime: number;
  platformCommissionToday: number;
  platformCommissionMonth: number;

  grossDriverEarningsAllTime: number;
  netDriverEarningsAllTime: number;
  netDriverEarningsMonth: number;

  cashPaymentsAmount: number;
  digitalPaymentsAmount: number;
  cashPaymentsCount: number;
  digitalPaymentsCount: number;

  passengerWalletAppliedTotal: number;

  totalWallets: number;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  cashDebt: number;
  walletLifetimeEarnings: number;
  totalWithdrawn: number;

  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
  paidWithdrawals: number;
  paidWithdrawalAmount: number;
  failedWithdrawals: number;

  pendingRefunds: number;
  pendingRefundAmount: number;
  approvedRefunds: number;
  approvedRefundAmount: number;
  rejectedRefunds: number;

  platformCommissionIvaTotal: number;
  ivaWithholdingTotal: number;
  isrWithholdingTotal: number;

  postedFinancialTransactions: number;
  pendingFinancialTransactions: number;
  reversedFinancialTransactions: number;

  netPlatformRevenueBeforeExpenses: number;

  dailyRevenue: FinanceDailyRevenue[];
  reconciliation: FinanceReconciliation[];
};

function toNumber(value: NumericValue | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  const [dashboardResult, dailyResult, reconciliationResult] =
    await Promise.all([
      supabase
        .from("finance_dashboard_v2")
        .select("*")
        .single(),

      supabase
        .from("finance_daily_revenue_v2")
        .select("*")
        .order("finance_date", { ascending: false })
        .limit(30),

      supabase
        .from("finance_payment_reconciliation_v2")
        .select("reconciliation_status,total_amount"),
    ]);

  if (dashboardResult.error) {
    throw new Error(
      `No se pudo cargar el resumen financiero: ${dashboardResult.error.message}`,
    );
  }

  if (dailyResult.error) {
    throw new Error(
      `No se pudo cargar el historial diario: ${dailyResult.error.message}`,
    );
  }

  if (reconciliationResult.error) {
    throw new Error(
      `No se pudo cargar la conciliación: ${reconciliationResult.error.message}`,
    );
  }

  const row = dashboardResult.data as FinanceDashboardRow;

  const dailyRevenue = (
    (dailyResult.data ?? []) as DailyRevenueRow[]
  )
    .map((daily) => ({
      date: daily.finance_date,
      paidPayments: toNumber(daily.paid_payments),
      grossRevenue: toNumber(daily.gross_revenue),
      platformCommission: toNumber(daily.platform_commission),
      grossDriverEarnings: toNumber(daily.gross_driver_earnings),
      netDriverEarnings: toNumber(daily.net_driver_earnings),
      cashAmount: toNumber(daily.cash_amount),
      digitalAmount: toNumber(daily.digital_amount),
      platformCommissionIva: toNumber(
        daily.platform_commission_iva,
      ),
      ivaWithholding: toNumber(daily.iva_withholding),
      isrWithholding: toNumber(daily.isr_withholding),
    }))
    .reverse();

  const reconciliationMap = new Map<
    string,
    FinanceReconciliation
  >();

  for (
    const reconciliationRow of
      (reconciliationResult.data ?? []) as ReconciliationRow[]
  ) {
    const status =
      reconciliationRow.reconciliation_status ?? "unknown";

    const current = reconciliationMap.get(status) ?? {
      status,
      payments: 0,
      totalAmount: 0,
    };

    current.payments += 1;
    current.totalAmount += toNumber(
      reconciliationRow.total_amount,
    );

    reconciliationMap.set(status, current);
  }

  return {
    generatedAt: row.generated_at,

    totalPaidPayments: toNumber(row.total_paid_payments),
    pendingPayments: toNumber(row.pending_payments),
    failedPayments: toNumber(row.failed_payments),
    refundedPayments: toNumber(row.refunded_payments),

    grossRevenueAllTime: toNumber(row.gross_revenue_all_time),
    grossRevenueToday: toNumber(row.gross_revenue_today),
    grossRevenueWeek: toNumber(row.gross_revenue_week),
    grossRevenueMonth: toNumber(row.gross_revenue_month),
    grossRevenueYear: toNumber(row.gross_revenue_year),

    platformCommissionAllTime: toNumber(
      row.platform_commission_all_time,
    ),
    platformCommissionToday: toNumber(
      row.platform_commission_today,
    ),
    platformCommissionMonth: toNumber(
      row.platform_commission_month,
    ),

    grossDriverEarningsAllTime: toNumber(
      row.gross_driver_earnings_all_time,
    ),
    netDriverEarningsAllTime: toNumber(
      row.net_driver_earnings_all_time,
    ),
    netDriverEarningsMonth: toNumber(
      row.net_driver_earnings_month,
    ),

    cashPaymentsAmount: toNumber(row.cash_payments_amount),
    digitalPaymentsAmount: toNumber(
      row.digital_payments_amount,
    ),
    cashPaymentsCount: toNumber(row.cash_payments_count),
    digitalPaymentsCount: toNumber(
      row.digital_payments_count,
    ),

    passengerWalletAppliedTotal: toNumber(
      row.passenger_wallet_applied_total,
    ),

    totalWallets: toNumber(row.total_driver_wallets),
    availableBalance: toNumber(row.total_available_balance),
    pendingBalance: toNumber(row.total_pending_balance),
    reservedBalance: toNumber(row.total_reserved_balance),
    cashDebt: toNumber(row.total_cash_debt),
    walletLifetimeEarnings: toNumber(
      row.wallet_lifetime_earnings,
    ),
    totalWithdrawn: toNumber(row.total_withdrawn),

    pendingWithdrawals: toNumber(row.open_withdrawals),
    pendingWithdrawalAmount: toNumber(
      row.open_withdrawal_amount,
    ),
    paidWithdrawals: toNumber(row.paid_withdrawals),
    paidWithdrawalAmount: toNumber(
      row.paid_withdrawal_amount,
    ),
    failedWithdrawals: toNumber(row.failed_withdrawals),

    pendingRefunds: toNumber(row.pending_refunds),
    pendingRefundAmount: toNumber(row.pending_refund_amount),
    approvedRefunds: toNumber(row.approved_refunds),
    approvedRefundAmount: toNumber(
      row.approved_refund_amount,
    ),
    rejectedRefunds: toNumber(row.rejected_refunds),

    platformCommissionIvaTotal: toNumber(
      row.platform_commission_iva_total,
    ),
    ivaWithholdingTotal: toNumber(
      row.iva_withholding_total,
    ),
    isrWithholdingTotal: toNumber(
      row.isr_withholding_total,
    ),

    postedFinancialTransactions: toNumber(
      row.posted_financial_transactions,
    ),
    pendingFinancialTransactions: toNumber(
      row.pending_financial_transactions,
    ),
    reversedFinancialTransactions: toNumber(
      row.reversed_financial_transactions,
    ),

    netPlatformRevenueBeforeExpenses: toNumber(
      row.net_platform_revenue_before_expenses,
    ),

    dailyRevenue,
    reconciliation: Array.from(
      reconciliationMap.values(),
    ).sort((a, b) => a.status.localeCompare(b.status)),
  };
}
