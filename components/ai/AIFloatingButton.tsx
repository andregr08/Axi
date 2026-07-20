"use client";

import { Bot } from "lucide-react";

interface AIFloatingButtonProps {
  onClick: () => void;
}

export default function AIFloatingButton({
  onClick,
}: AIFloatingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir AXI AI"
      className="fixed bottom-24 right-5 z-[997] flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400 text-slate-950 shadow-xl transition hover:scale-105 hover:bg-yellow-300 active:scale-95 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
    >
      <Bot className="h-7 w-7 lg:h-8 lg:w-8" />
    </button>
  );
}
