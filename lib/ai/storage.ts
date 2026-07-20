import { supabase } from "@/lib/supabaseClient";
import type { AIConversation } from "@/types/ai";

const TABLE = "ai_conversations";

export async function saveConversation(
  conversation: AIConversation
) {
  return supabase
    .from(TABLE)
    .upsert(conversation);
}

export async function getConversation(
  id: string
) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();
}

export async function getUserConversations(
  userId: string
) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", {
      ascending: false,
    });
}

export async function deleteConversation(
  id: string
) {
  return supabase
    .from(TABLE)
    .delete()
    .eq("id", id);
}
