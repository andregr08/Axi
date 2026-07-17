"use client";

import { useEffect, useMemo, useState } from "react";
import { getSuggestions } from "@/lib/aiSuggestions";
import { aiProvider } from "@/lib/ai/provider";
import { getCurrentSession } from "@/lib/ai/session";
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
  const [userId, setUserId] = useState<string>("local");

  useEffect(() => {
    async function loadSession() {
      const session = await getCurrentSession();

      if (session) {
        setUserId(session.user.id);
      }
    }

    void loadSession();
  }, []);

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

    if (!clean) return;

    const userMessage = createMessage("user", clean);
    const updated = [...messages, userMessage];

    setMessages(updated);

    const response =
      await aiProvider.generateResponse({
        conversationId: "local",
        userId,
        messages: updated,
      });

    setMessages((current) => [
      ...current,
      createMessage("assistant", response.content),
    ]);
  }

  return {
    open,
    messages,
    suggestions,
    openAI: () => setOpen(true),
    closeAI: () => setOpen(false),
    sendMessage,
  };
}
