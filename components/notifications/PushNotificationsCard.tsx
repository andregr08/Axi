"use client";

import {
  Bell,
  BellOff,
  CheckCircle2,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";

type PushStatus =
  | "loading"
  | "unsupported"
  | "blocked"
  | "inactive"
  | "active";

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) =>
      character.charCodeAt(0)
    )
  );
}

export function PushNotificationsCard() {
  const [status, setStatus] =
    useState<PushStatus>("loading");

  const [processing, setProcessing] =
    useState(false);

  const [testingPush, setTestingPush] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const checkStatus = useCallback(
    async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }

      if (
        Notification.permission ===
        "denied"
      ) {
        setStatus("blocked");
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        setStatus(
          subscription
            ? "active"
            : "inactive"
        );
      } catch (error) {
        console.error(
          "Error revisando notificaciones:",
          error
        );

        setStatus("inactive");
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkStatus();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [checkStatus]);

  async function activateNotifications() {
    setProcessing(true);
    setMessage("");

    try {
      const publicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error(
          "Falta configurar la clave pública VAPID."
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "Tu sesión no está disponible."
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(
          permission === "denied"
            ? "blocked"
            : "inactive"
        );

        setMessage(
          "No se concedió permiso para enviar notificaciones."
        );

        return;
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe(
            {
              userVisibleOnly: true,
              applicationServerKey:
                urlBase64ToUint8Array(
                  publicKey
                ),
            }
          );
      }

      const subscriptionData =
        subscription.toJSON();

      if (
        !subscriptionData.endpoint ||
        !subscriptionData.keys?.p256dh ||
        !subscriptionData.keys?.auth
      ) {
        throw new Error(
          "El navegador no devolvió una suscripción válida."
        );
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: session.user.id,
            endpoint:
              subscriptionData.endpoint,
            p256dh:
              subscriptionData.keys.p256dh,
            auth_key:
              subscriptionData.keys.auth,
            user_agent:
              navigator.userAgent,
            device_name:
              navigator.platform ||
              "Dispositivo web",
            enabled: true,
          },
          {
            onConflict: "endpoint",
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      setStatus("active");

      setMessage(
        "Las notificaciones quedaron activadas en este dispositivo."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible activar las notificaciones."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function sendTestNotification() {
    setTestingPush(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "Tu sesión no está disponible."
        );
      }

      const response = await fetch(
        "/api/push/test",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const result = (await response.json()) as {
        success?: boolean;
        sent?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "No fue posible enviar la prueba."
        );
      }

      setMessage(
        `Notificación enviada a ${
          result.sent ?? 1
        } dispositivo.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible enviar la notificación."
      );
    } finally {
      setTestingPush(false);
    }
  }

  async function deactivateNotifications() {
    setProcessing(true);
    setMessage("");

    try {
      const registration =
        await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint =
          subscription.endpoint;

        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);

        if (error) {
          throw new Error(error.message);
        }

        await subscription.unsubscribe();
      }

      setStatus("inactive");

      setMessage(
        "Las notificaciones se desactivaron en este dispositivo."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible desactivar las notificaciones."
      );
    } finally {
      setProcessing(false);
    }
  }

  const active =
    status === "active";

  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {active ? (
              <Bell size={23} />
            ) : (
              <BellOff size={23} />
            )}
          </span>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Notificaciones
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Alertas de AXI
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Recibe avisos de viajes, mensajes, cancelaciones, pagos y seguridad.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
            active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {active && (
            <CheckCircle2 size={14} />
          )}

          {status === "loading" &&
            "Revisando"}

          {status === "active" &&
            "Activadas"}

          {status === "inactive" &&
            "Desactivadas"}

          {status === "blocked" &&
            "Bloqueadas"}

          {status === "unsupported" &&
            "No compatibles"}
        </span>
      </div>

      {status === "blocked" && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <ShieldAlert
            size={20}
            className="shrink-0"
          />

          <p>
            El navegador bloqueó las notificaciones. Debes permitirlas desde la configuración del sitio.
          </p>
        </div>
      )}

      {status === "unsupported" && (
        <div className="mt-6 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
          Este navegador o dispositivo todavía no admite notificaciones web.
        </div>
      )}

      {message && (
        <div
          className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
            message
              .toLowerCase()
              .includes("activadas") ||
            message
              .toLowerCase()
              .includes("desactivaron")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {active && (
        <button
          type="button"
          onClick={sendTestNotification}
          disabled={
            testingPush || processing
          }
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {testingPush ? (
            <>
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
              Enviando prueba...
            </>
          ) : (
            <>
              <Bell size={19} />
              Enviar notificación de prueba
            </>
          )}
        </button>
      )}

      {status !== "unsupported" &&
        status !== "blocked" && (
          <button
            type="button"
            disabled={
              processing ||
              status === "loading"
            }
            onClick={
              active
                ? deactivateNotifications
                : activateNotifications
            }
            className={`mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 font-black transition disabled:pointer-events-none disabled:opacity-50 ${
              active
                ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                : "bg-yellow-400 text-black hover:bg-yellow-300"
            }`}
          >
            {processing ? (
              <>
                <LoaderCircle
                  size={19}
                  className="animate-spin"
                />
                Procesando...
              </>
            ) : active ? (
              <>
                <BellOff size={19} />
                Desactivar notificaciones
              </>
            ) : (
              <>
                <Bell size={19} />
                Activar notificaciones
              </>
            )}
          </button>
        )}
    </Card>
  );
}
