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
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/lib/supabaseClient";

export function ShareTripCard({
  tripId,
}: {
  tripId: string;
}) {
  const { t } = useLanguage();

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
        setMessage(t("shareTrip.backendPending"));
      } else {
        setMessage(
          `${t("shareTrip.createError")}: ${error.message}`
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
      setMessage(t("shareTrip.invalidToken"));
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
        `${t("shareTrip.whatsappMessage")}\n\n${url}`
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
        title: t("shareTrip.nativeTitle"),
        text: t("shareTrip.shareText"),
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
            {t("shareTrip.section")}
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {t("shareTrip.heading")}
          </h2>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-500">
        {t("shareTrip.description")}
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <ShieldCheck
          size={19}
          className="mt-0.5 shrink-0 text-emerald-600"
        />

        <p className="text-xs leading-6 text-emerald-800">
          {t("shareTrip.security")}
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
              {t("shareTrip.preparing")}
            </>
          ) : (
            <>
              <Link2 size={20} />
              {t("shareTrip.prepare")}
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
            {t("shareTrip.share")}
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
                {t("shareTrip.copied")}
              </>
            ) : (
              <>
                <Copy size={20} />
                {t("shareTrip.copy")}
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