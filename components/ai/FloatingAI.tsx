"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

export default function FloatingAI() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-24 right-5 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400 text-slate-950 shadow-2xl transition hover:scale-105 hover:bg-yellow-300 active:scale-95 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-24 top-20 z-[1001] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-zinc-900 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[650px] sm:w-[390px] lg:bottom-28 lg:right-8">

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
