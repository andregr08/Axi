import { supabase } from "@/lib/supabaseClient";
import type {
  DriverWallet,
  WalletTransaction,
} from "./walletTypes";

export async function getDriverWallet(driverId?: string) {
  let query = supabase
    .from("driver_wallets")
    .select("*");

  if (driverId) {
    query = query.eq("driver_id", driverId);
  }

  const { data, error } = await query.single();

  if (error) throw error;

  return data as DriverWallet;
}

export async function getWalletTransactions(
  limit = 50,
  driverId?: string,
) {
  let query = supabase
    .from("wallet_transactions")
    .select("*");

  if (driverId) {
    query = query.eq("driver_id", driverId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []) as WalletTransaction[];
}
