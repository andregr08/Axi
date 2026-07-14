"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  MessageCircle,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export function ShareTripCard({
  tripId,
}: {
  tripId: string;
}) {
  const [shareUrl, setShareUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function prepareSecureLink() {
    if (shareUrl) return shareUrl;

    setCreating(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "create_trip_share_link",
      {
        requested_trip_id: tripId,
      }
    );

    if (error) {
      setCreating(false);

      if (
        error.message
          .toLowerCase()
          .includes("could not find the function")
      ) {
        setMessage(
          "El enlace seguro está preparado en frontend, pero falta que Gali conecte la función en Supabase."
        );
      } else {
        setMessage(
          `No fue posible crear el enlace: ${error.message}`
        );
      }

      return "";
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    const token =
      typeof result === "string"
        ? result
        : result?.share_token ?? result?.token ?? "";

    if (!token) {
      setCreating(false);
      setMessage(
        "Supabase no devolvió un token válido."
      );
      return "";
    }

    const url = `${window.location.origin}/trip/${token}`;

    setShareUrl(url);
    setCreating(false);

    return url;
  }

  async function copyLink() {
    const url = await prepareSecureLink();

    if (!url) return;

    await navigator.clipboard.writeText(url);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  async function shareWhatsApp() {
    const url = await prepareSecureLink();

    if (!url) return;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        `Estoy realizando un viaje en AXI. Puedes seguirlo de forma segura aquí:\n\n${url}`
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function nativeShare() {
    const url = await prepareSecureLink();

    if (!url) return;

    if (navigator.share) {
      await navigator.share({
        title: "Mi viaje AXI",
        text: "Sigue mi viaje de forma segura.",
        url,
      });

      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
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
        Genera un enlace temporal para que familiares o amigos puedan
        consultar el estado de tu viaje.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <ShieldCheck
          size={19}
          className="mt-0.5 shrink-0 text-emerald-600"
        />

        <p className="text-xs leading-6 text-emerald-800">
          El enlace no utiliza directamente el identificador del viaje y
          deberá expirar automáticamente.
        </p>
      </div>

      {!shareUrl && (
        <button
          type="button"
          onClick={prepareSecureLink}
          disabled={creating}
          className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-yellow-400 font-black text-black transition hover:bg-yellow-300 disabled:opacity-60"
        >
          {creating ? (
            <>
              <LoaderCircle
                size={20}
                className="animate-spin"
              />
              Preparando enlace...
            </>
          ) : (
            <>
              <Link2 size={20} />
              Preparar enlace seguro
            </>
          )}
        </button>
      )}

      {shareUrl && (
        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={nativeShare}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-slate-950 font-black text-white transition hover:bg-slate-800"
          >
            <Share2 size={20} />
            Compartir
          </button>

          <button
            type="button"
            onClick={shareWhatsApp}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-green-600 font-black text-white transition hover:bg-green-700"
          >
            <MessageCircle size={20} />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={copyLink}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-slate-200 font-black"
          >
            {copied ? (
              <>
                <Check size={20} />
                Enlace copiado
              </>
            ) : (
              <>
                <Copy size={20} />
                Copiar enlace
              </>
            )}
          </button>
        </div>
      )}

      {message && (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-6 text-amber-800">
          {message}
        </p>
      )}
    </div>
  );
}
