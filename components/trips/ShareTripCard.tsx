"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  MessageCircle,
  Share2,
  Users,
} from "lucide-react";

export function ShareTripCard({
  tripId,
}: {
  tripId: string;
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trip/${tripId}`
      : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {}
  }

  function shareWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        "Estoy realizando un viaje en AXI. Puedes seguir mi recorrido aquí:\n\n" +
          shareUrl
      )}`,
      "_blank"
    );
  }

  function nativeShare() {
    if (navigator.share) {
      navigator.share({
        title: "Mi viaje AXI",
        text: "Sigue mi viaje en tiempo real.",
        url: shareUrl,
      });

      return;
    }

    copyLink();
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <Users size={26} />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Compartir viaje
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Comparte tu recorrido
          </h2>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-500">
        Envía el seguimiento de tu viaje a familiares o amigos para que
        puedan ver dónde te encuentras en tiempo real.
      </p>

      <div className="mt-7 grid gap-3">
        <button
          onClick={nativeShare}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-black font-black text-white transition hover:bg-slate-800"
        >
          <Share2 size={20} />
          Compartir
        </button>

        <button
          onClick={shareWhatsApp}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-green-600 font-black text-white transition hover:bg-green-700"
        >
          <MessageCircle size={20} />
          WhatsApp
        </button>

        <button
          onClick={copyLink}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl border font-black"
        >
          {copied ? (
            <>
              <Check size={20} />
              Copiado
            </>
          ) : (
            <>
              <Copy size={20} />
              Copiar enlace
            </>
          )}
        </button>
      </div>
    </div>
  );
}
