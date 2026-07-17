import { supabase } from "@/lib/supabaseClient";

export async function getCurrentUser(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}

export async function getUserTrips(userId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("passenger_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  return data ?? [];
}
