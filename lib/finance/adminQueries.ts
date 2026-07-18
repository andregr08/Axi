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

export async function getPendingRefunds() {
  const { data: refunds, error } = await supabase
    .from("refund_requests")
    .select(`
      *,
      trips(
        id,
        origin_address,
        destination_address
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const passengerIds = [
    ...new Set(
      (refunds ?? [])
        .map((refund) => refund.passenger_id)
        .filter(Boolean)
    ),
  ];

  if (passengerIds.length === 0) {
    return refunds ?? [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", passengerIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return (refunds ?? []).map((refund) => ({
    ...refund,
    profiles: profilesById.get(refund.passenger_id) ?? null,
  }));
}

export async function getDrivers() {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email
    `)
    .eq("role", "driver")
    .order("full_name");

  if (error) throw error;

  return data ?? [];
}


export async function getFinanceAuditLogs() {
  const { data, error } = await supabase
    .from("finance_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return data ?? [];
}


export async function getCashDebts() {
  const { data, error } = await supabase
    .from("cash_debts_view")
    .select("*")
    .order("cash_debt", { ascending: false });

  if (error) throw error;

  return data ?? [];
}
