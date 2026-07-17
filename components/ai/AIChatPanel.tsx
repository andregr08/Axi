"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Menu,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import ConversationSidebar from "@/components/ai/ConversationSidebar";
import { useConversation } from "@/hooks/useConversation";
import type {
  AIMessage,
  AIUserRole,
} from "@/types/ai";

interface AIChatPanelProps {
  open: boolean;
  role: AIUserRole;
  messages: AIMessage[];
  suggestions: string[];
  onClose: () => void;
  onSendMessage: (content: string) => void;
}

function getRoleLabel(role: AIUserRole) {
  if (role === "admin") return "Copilot administrativo";
  if (role === "driver") return "Asistente para conductores";
  return "Asistente para pasajeros";
}

export default function AIChatPanel({
  open,
  role,
  messages,
  suggestions,
  onClose,
  onSendMessage,
}: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const [showMobileHistory, setShowMobileHistory] =
    useState(false);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const {
    conversations,
    currentConversation,
    currentConversationId,
    newConversation,
    selectConversation,
  } = useConversation();

  useEffect(() => {
    if (!open) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [open, onClose]);

  function submitMessage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const content = input.trim();

    if (!content) return;

    onSendMessage(content);
    setInput("");
  }

  function handleSelectConversation(id: string) {
    selectConversation(id);
    setShowMobileHistory(false);
  }

  function handleNewConversation() {
    newConversation();
    setShowMobileHistory(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[998]">
      <button
        type="button"
        aria-label="Cerrar AXI AI"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-sm"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="AXI AI"
        className="absolute right-0 top-0 flex h-full w-full overflow-hidden bg-white shadow-2xl lg:max-w-5xl"
      >
        <div className="hidden md:flex">
          <ConversationSidebar
            conversations={conversations}
            currentConversationId={
              currentConversationId
            }
            onNewConversation={
              handleNewConversation
            }
            onSelectConversation={
              handleSelectConversation
            }
          />
        </div>

        {showMobileHistory && (
          <div className="absolute inset-0 z-20 flex md:hidden">
            <ConversationSidebar
              conversations={conversations}
              currentConversationId={
                currentConversationId
              }
              onNewConversation={
                handleNewConversation
              }
              onSelectConversation={
                handleSelectConversation
              }
            />

            <button
              type="button"
              aria-label="Cerrar historial"
              onClick={() =>
                setShowMobileHistory(false)
              }
              className="flex-1 bg-slate-950/30"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowMobileHistory(true)
                }
                aria-label="Abrir historial"
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-slate-950">
                <Bot className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-slate-950">
                  AXI AI
                </h2>

                <p className="truncate text-xs font-medium text-slate-500">
                  {currentConversation?.title ??
                    getRoleLabel(role)}
                  {" · "}
                  {getRoleLabel(role)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel"
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message) => {
                const isUser =
                  message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={
                      isUser
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm leading-6 text-white"
                          : "max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
                      }
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />

              <div className="pt-3">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Sparkles className="h-4 w-4" />
                  Sugerencias
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestions.map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() =>
                          onSendMessage(
                            suggestion
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-yellow-400 hover:bg-yellow-50"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={submitMessage}
            className="border-t border-slate-200 bg-white p-4"
          >
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-100">
                <textarea
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe un mensaje..."
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />

                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Enviar mensaje"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-slate-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-2 text-center text-[11px] text-slate-400">
                AXI AI no ejecutará acciones críticas
                sin tu confirmación.
              </p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
