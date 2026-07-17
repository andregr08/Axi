"use client";

import { useMemo, useState } from "react";
import { getSuggestions } from "@/lib/aiSuggestions";
import { supabase } from "@/lib/supabaseClient";
import type {
  AIMessage,
  AIUserRole,
} from "@/types/ai";

function createMessage(
  role: AIMessage["role"],
  content: string
): AIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function useAI(role: AIUserRole) {
  const [open, setOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [messages, setMessages] = useState<AIMessage[]>([
    createMessage(
      "assistant",
      "Hola, soy AXI AI. ¿En qué puedo ayudarte?"
    ),
  ]);

  const suggestions = useMemo(
    () => getSuggestions(role),
    [role]
  );

  async function sendMessage(content: string) {
    const clean = content.trim();

    if (!clean || isStreaming) return;

    const userMessage = createMessage("user", clean);

    const updated = [...messages, userMessage];

    setMessages(updated);
    setIsStreaming(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "No existe una sesión activa."
        );
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: clean,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ??
            "AXI AI no pudo responder."
        );
      }

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          data.response
        ),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          "Ocurrió un error al conectar con AXI AI."
        ),
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  return {
    open,
    messages,
    suggestions,
    isStreaming,
    openAI: () => setOpen(true),
    closeAI: () => setOpen(false),
    sendMessage,
  };
}
