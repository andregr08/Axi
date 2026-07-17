"use client";

import { useState } from "react";
import { createConversation } from "@/lib/ai/conversation";
import type { AIConversation } from "@/types/ai";

export function useConversation() {
  const [conversations, setConversations] = useState<AIConversation[]>([
    createConversation(),
  ]);

  const [currentConversationId, setCurrentConversationId] = useState(
    conversations[0].id
  );

  function newConversation() {
    const conversation = createConversation();

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
      (conversation) => conversation.id === currentConversationId
    ) ?? conversations[0];

  return {
    conversations,
    currentConversation,
    currentConversationId,
    newConversation,
    selectConversation,
  };
}
