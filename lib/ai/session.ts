import { supabase } from "@/lib/supabaseClient";

export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function getCurrentProfile() {
  const session = await getCurrentSession();

  if (!session) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
