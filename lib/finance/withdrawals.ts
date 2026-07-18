import { supabase } from "@/lib/supabaseClient";

export async function getPendingWithdrawals() {
  const { data, error } = await supabase
    .from("withdraw_requests")
    .select(`
      *,
      driver:driver_id(
        full_name
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}
