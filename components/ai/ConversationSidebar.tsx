"use client";

import { Plus, MessageSquare } from "lucide-react";
import type { AIConversation } from "@/types/ai";

interface Props {
  conversations: AIConversation[];
  currentConversationId: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
}

export default function ConversationSidebar({
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
}: Props) {
  return (
    <aside className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col">
      <div className="p-4">
        <button
          onClick={onNewConversation}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 font-semibold hover:bg-yellow-300 transition"
        >
          <Plus size={18} />
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={`w-full rounded-xl p-3 text-left transition ${
              currentConversationId === conversation.id
                ? "bg-yellow-100 border border-yellow-400"
                : "hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={16} />
              <span className="truncate font-medium">
                {conversation.title}
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
