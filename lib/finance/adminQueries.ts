import { supabase } from "@/lib/supabaseClient";

export async function getFinanceDashboard() {
  const { data, error } = await supabase
    .from("finance_dashboard_summary")
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function getWallets() {
  const { data, error } = await supabase
    .from("driver_wallets")
    .select(`
      *,
      profiles(
        id,
        full_name,
        email,
        role
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getFinanceTransactions(limit = 100) {
  const { data, error } = await supabase
    .from("finance_transactions_view")
    .select("*")
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

export async function getPendingWithdrawals() {
  const { data, error } = await supabase
    .from("withdraw_requests")
    .select(`
      *,
      profiles(
        full_name,
        email
      )
    `)
    .eq("status", "pending")
    .order("created_at");

  if (error) throw error;

  return data ?? [];
}

export async function getPendingBonuses() {
  const { data, error } = await supabase
    .from("driver_bonus_requests")
    .select(`
      *,
      profiles(
        full_name,
        email
      )
    `)
    .eq("status", "pending")
    .order("created_at");

  if (error) throw error;

  return data ?? [];
}

export async function getPendingIncentives() {
  const { data, error } = await supabase
    .from("driver_incentives")
    .select(`
      *,
      profiles(
        full_name,
        email
      )
    `)
    .eq("status", "pending")
    .order("created_at");

  if (error) throw error;

  return data ?? [];
}
