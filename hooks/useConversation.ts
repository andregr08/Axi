"use client";

import { useState } from "react";
import { createConversation } from "@/lib/ai/conversation";
import type { AIConversation } from "@/types/ai";

const initialConversation: AIConversation = {
  id: "axi-default-conversation",
  userId: "",
  title: "Nueva conversación",
  status: "active",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  messages: [],
};

export function useConversation() {
  const [conversations, setConversations] =
    useState<AIConversation[]>([initialConversation]);

  const [currentConversationId, setCurrentConversationId] =
    useState(initialConversation.id);

  function newConversation() {
    const conversation: AIConversation = {
      ...createConversation(),
      userId: "",
    };

    setConversations((current) => [
      conversation,
      ...current,
    ]);

    setCurrentConversationId(conversation.id);
  }

  function selectConversation(id: string) {
    setCurrentConversationId(id);
  }

  const currentConversation =
    conversations.find(
      (conversation) =>
        conversation.id === currentConversationId
    ) ?? conversations[0];

  return {
    conversations,
    currentConversation,
    currentConversationId,
    newConversation,
    selectConversation,
  };
}
