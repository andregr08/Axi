import { supabase } from "@/lib/supabaseClient";

export type FinanceDashboard = {
  activeWallets: number;
  pendingWithdrawals: number;
  pendingBonuses: number;
  pendingBalance: number;
  cashDebt: number;
  commissionsToday: number;
};

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  const [
    wallets,
    withdrawals,
    bonuses,
  ] = await Promise.all([
    supabase
      .from("driver_wallets")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("withdraw_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),

    supabase
      .from("driver_bonus_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const { data: walletRows } = await supabase
    .from("driver_wallets")
    .select("pending_balance,cash_debt");

  let pendingBalance = 0;
  let cashDebt = 0;

  for (const wallet of walletRows ?? []) {
    pendingBalance += Number(wallet.pending_balance ?? 0);
    cashDebt += Number(wallet.cash_debt ?? 0);
  }

  return {
    activeWallets: wallets.count ?? 0,
    pendingWithdrawals: withdrawals.count ?? 0,
    pendingBonuses: bonuses.count ?? 0,
    pendingBalance,
    cashDebt,
    commissionsToday: 0,
  };
}
