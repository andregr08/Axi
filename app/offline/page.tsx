"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Signal,
  SignalZero,
} from "lucide-react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined"
      ? navigator.onLine
      : false
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
          {isOnline ? (
            <Signal className="h-10 w-10" />
          ) : (
            <SignalZero className="h-10 w-10" />
          )}
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
          AXI Mobility
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          {isOnline
            ? "Conexión recuperada"
            : "Estás sin conexión"}
        </h1>

        <p className="mt-4 text-sm leading-6 text-white/60">
          {isOnline
            ? "Tu conexión a internet volvió. Presiona el botón para regresar a AXI."
            : "Revisa tu conexión móvil o Wi-Fi. Algunas pantallas visitadas anteriormente pueden seguir disponibles."}
        </p>

        <button
          type="button"
          onClick={handleRetry}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-semibold text-slate-950 transition hover:bg-white/90 active:scale-[0.98]"
        >
          <RefreshCw className="h-5 w-5" />
          Intentar nuevamente
        </button>
      </section>
    </main>
  );
}
