"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import type { AIPageContext } from "@/lib/ai/pageContext";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIContextValue = {
  messages: ChatMessage[];

  loading: boolean;

  pageContext: AIPageContext | null;

  setPageContext: (
    context: AIPageContext
  ) => void;

  addMessage: (
    message: ChatMessage
  ) => void;

  clearConversation: () => void;

  setLoading: (
    loading: boolean
  ) => void;
};

const AIContext =
  createContext<AIContextValue | null>(
    null
  );

export function AIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [
    pageContext,
    setPageContext,
  ] = useState<AIPageContext | null>(
    null
  );

  const value = useMemo(
    () => ({
      messages,

      loading,

      pageContext,

      setPageContext,

      setLoading,

      addMessage(message: ChatMessage) {
        setMessages((old) => [
          ...old,
          message,
        ]);
      },

      clearConversation() {
        setMessages([]);
      },
    }),
    [messages, loading, pageContext]
  );

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context =
    useContext(AIContext);

  if (!context) {
    throw new Error(
      "AIProvider no encontrado."
    );
  }

  return context;
}
