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

    const previousMessages = messages;
    const userMessage = createMessage("user", clean);

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

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

      const conversationHistory =
        previousMessages
          .filter(
            (message) =>
              message.role === "user" ||
              message.role === "assistant"
          )
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content: message.content,
          }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: clean,
          history: conversationHistory,
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al conectar con AXI AI.";

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          errorMessage
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
