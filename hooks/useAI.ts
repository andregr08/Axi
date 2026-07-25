"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSuggestions } from "@/lib/aiSuggestions";
import { supabase } from "@/lib/supabaseClient";
import type {
  AIConversation,
  AIConversationStatus,
  AIMessage,
  AIMessageRole,
  AIUserRole,
} from "@/types/ai";

type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  status: AIConversationStatus;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "assistant" | "support" | "system";
  content: string;
  created_at: string;
};

function mapMessage(row: MessageRow): AIMessage {
  return {
    id: row.id,
    role: row.sender_type as AIMessageRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

function createLocalMessage(
  role: AIMessageRole,
  content: string,
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

  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState("");

  const suggestions = useMemo(() => getSuggestions(role), [role]);

  const currentConversation =
    conversations.find(
      (conversation) => conversation.id === currentConversationId,
    ) ?? conversations[0] ?? null;

  const messages = currentConversation?.messages ?? [];

  const loadConversations = useCallback(
    async (preferredConversationId?: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      let { data: conversationRows, error: conversationsError } = await supabase
        .from("ai_conversations")
        .select("id, user_id, title, status, created_at, updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", {
          ascending: false,
        });

      if (conversationsError) {
        console.error(
          "Error cargando conversaciones AI:",
          conversationsError.message,
        );
        return;
      }

      if (!conversationRows || conversationRows.length === 0) {
        const { data: createdId, error: createError } = await supabase.rpc(
          "create_ai_conversation",
          {
            conversation_title: "Nueva conversación",
          },
        );

        if (createError || !createdId) {
          console.error(
            "Error creando conversación AI:",
            createError?.message,
          );
          return;
        }

        const result = await supabase
          .from("ai_conversations")
          .select("id, user_id, title, status, created_at, updated_at")
          .eq("user_id", session.user.id)
          .order("updated_at", {
            ascending: false,
          });

        conversationRows = result.data ?? [];
        conversationsError = result.error;

        if (conversationsError) {
          console.error(
            "Error recargando conversaciones AI:",
            conversationsError.message,
          );
          return;
        }

        preferredConversationId = String(createdId);
      }

      const ids = conversationRows.map((conversation) => conversation.id);

      const { data: messageRows, error: messagesError } = await supabase
        .from("ai_messages")
        .select("id, conversation_id, sender_type, content, created_at")
        .in("conversation_id", ids)
        .order("created_at", {
          ascending: true,
        });

      if (messagesError) {
        console.error(
          "Error cargando mensajes AI:",
          messagesError.message,
        );
      }

      const messagesByConversation = new Map<string, AIMessage[]>();

      for (const row of (messageRows ?? []) as MessageRow[]) {
        const current = messagesByConversation.get(row.conversation_id) ?? [];

        messagesByConversation.set(row.conversation_id, [
          ...current,
          mapMessage(row),
        ]);
      }

      const loadedConversations = (
        conversationRows as ConversationRow[]
      ).map((conversation) => ({
        id: conversation.id,
        userId: conversation.user_id,
        title: conversation.title,
        status: conversation.status,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: messagesByConversation.get(conversation.id) ?? [],
      }));

      setConversations(loadedConversations);

      setCurrentConversationId((current) => {
        if (
          preferredConversationId &&
          loadedConversations.some(
            (conversation) => conversation.id === preferredConversationId,
          )
        ) {
          return preferredConversationId;
        }

        if (
          current &&
          loadedConversations.some(
            (conversation) => conversation.id === current,
          )
        ) {
          return current;
        }

        return loadedConversations[0]?.id ?? "";
      });
    },
    [],
  );

  const refreshConversation = useCallback(async (conversationId: string) => {
    if (!conversationId) {
      return;
    }

    const [conversationResult, messagesResult] = await Promise.all([
      supabase
        .from("ai_conversations")
        .select("id, user_id, title, status, created_at, updated_at")
        .eq("id", conversationId)
        .maybeSingle(),

      supabase
        .from("ai_messages")
        .select("id, conversation_id, sender_type, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", {
          ascending: true,
        }),
    ]);

    if (conversationResult.error || !conversationResult.data) {
      return;
    }

    if (messagesResult.error) {
      console.error(
        "Error actualizando mensajes AI:",
        messagesResult.error.message,
      );
      return;
    }

    const conversation = conversationResult.data as ConversationRow;

    const updatedConversation: AIConversation = {
      id: conversation.id,
      userId: conversation.user_id,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages: ((messagesResult.data ?? []) as MessageRow[]).map(mapMessage),
    };

    setConversations((current) => {
      const exists = current.some((item) => item.id === conversationId);

      if (!exists) {
        return [updatedConversation, ...current];
      }

      return current.map((item) =>
        item.id === conversationId ? updatedConversation : item,
      );
    });
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!open || !currentConversationId) {
      return;
    }

    void refreshConversation(currentConversationId);

    const interval = window.setInterval(() => {
      void refreshConversation(currentConversationId);
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentConversationId, open, refreshConversation]);

  async function newConversation() {
    const { data, error } = await supabase.rpc("create_ai_conversation", {
      conversation_title: "Nueva conversación",
    });

    if (error || !data) {
      console.error("Error creando conversación:", error?.message);
      return null;
    }

    const conversationId = String(data);

    await loadConversations(conversationId);

    return conversationId;
  }

  function selectConversation(id: string) {
    setCurrentConversationId(id);
    void refreshConversation(id);
  }

  function appendLocalMessage(
    conversationId: string,
    message: AIMessage,
  ) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              updatedAt: new Date().toISOString(),
              messages: [...conversation.messages, message],
            }
          : conversation,
      ),
    );
  }

  async function sendMessage(content: string) {
    const clean = content.trim();

    if (!clean || isStreaming) {
      return;
    }

    let conversationId = currentConversationId;
    let conversationStatus = currentConversation?.status ?? "active";

    if (!conversationId) {
      const createdId = await newConversation();

      if (!createdId) {
        return;
      }

      conversationId = createdId;
      conversationStatus = "active";
    }

    if (conversationStatus === "closed") {
      appendLocalMessage(
        conversationId,
        createLocalMessage(
          "system",
          "Esta conversación está cerrada. Crea una nueva conversación para continuar.",
        ),
      );
      return;
    }

    const optimisticMessage = createLocalMessage("user", clean);

    appendLocalMessage(conversationId, optimisticMessage);

    /*
     * Cuando soporte humano está activo, el mensaje se guarda
     * directamente sin pedir respuesta a Gemini.
     */
    if (conversationStatus === "waiting_human") {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const { error } = await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        sender_type: "user",
        sender_user_id: session.user.id,
        content: clean,
      });

      if (error) {
        appendLocalMessage(
          conversationId,
          createLocalMessage(
            "system",
            `No se pudo enviar el mensaje a soporte: ${error.message}`,
          ),
        );
      } else {
        await refreshConversation(conversationId);
      }

      return;
    }

    setIsStreaming(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No existe una sesión activa.");
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: clean,
          conversationId,
        }),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData.error ?? "AXI AI no pudo responder.",
        );
      }

      await refreshConversation(conversationId);
    } catch (error) {
      await refreshConversation(conversationId);

      appendLocalMessage(
        conversationId,
        createLocalMessage(
          "system",
          error instanceof Error
            ? error.message
            : "Ocurrió un error al conectar con AXI AI.",
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return {
    open,
    conversations,
    currentConversation,
    currentConversationId,
    messages,
    suggestions,
    isStreaming,
    openAI: () => setOpen(true),
    closeAI: () => setOpen(false),
    sendMessage,
    newConversation,
    selectConversation,
  };
}
