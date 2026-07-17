"use client";

import { useMemo, useState } from "react";
import { getSuggestions } from "@/lib/aiSuggestions";
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

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "axi-ai-welcome",
      role: "assistant",
      content:
        "Hola, soy AXI AI. Puedo ayudarte con viajes, pagos, soporte y consultas de tu cuenta.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const suggestions = useMemo(
    () => getSuggestions(role),
    [role]
  );

  function openAI() {
    setOpen(true);
  }

  function closeAI() {
    setOpen(false);
  }

  function sendMessage(content: string) {
    const cleanContent = content.trim();

    if (!cleanContent) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage("user", cleanContent),
    ]);
  }

  return {
    open,
    messages,
    suggestions,
    openAI,
    closeAI,
    sendMessage,
  };
}
