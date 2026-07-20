"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

export default function FloatingAI() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-xl transition hover:scale-105"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 h-[650px] w-[390px] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-zinc-900">

          <div className="border-b px-5 py-4 font-semibold">
            AXI AI
          </div>

          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Chat próximamente...
          </div>

        </div>
      )}
    </>
  );
}
