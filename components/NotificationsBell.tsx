"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  trip_id: string | null;
  offer_id: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsBell() {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const loadNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        type,
        title,
        body,
        trip_id,
        offer_id,
        read_at,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setMessage(`Error cargando notificaciones: ${error.message}`);
    } else {
      setNotifications((data ?? []) as Notification[]);
      setMessage("");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || cancelled) {
        setLoading(false);
        return;
      }

      setUserId(session.user.id);
      await loadNotifications();

      if (cancelled) return;

      channel = supabase
        .channel(
          `notifications-${session.user.id}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            void loadNotifications();
          }
        )
        .subscribe();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;

  async function markAsRead(notificationId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .is("read_at", null);

    if (error) {
      setMessage(`Error marcando notificación: ${error.message}`);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              read_at: notification.read_at ?? new Date().toISOString(),
            }
          : notification
      )
    );
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return;

    setProcessing(true);
    setMessage("");

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      setMessage(`Error marcando notificaciones: ${error.message}`);
    } else {
      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? readAt,
        }))
      );
    }

    setProcessing(false);
  }

  function notificationLink(notification: Notification) {
    if (
      notification.type === "chat_message" &&
      notification.trip_id
    ) {
      return `/dashboard/trips/${notification.trip_id}/chat`;
    }

    if (
      notification.type === "trip_offer"
    ) {
      return "/dashboard/driver/available-trips";
    }

    if (notification.trip_id) {
      return `/dashboard/trips/${notification.trip_id}`;
    }

    return "/dashboard";
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border bg-white text-xl hover:bg-gray-50"
        aria-label="Notificaciones"
      >
        <span aria-hidden="true">🔔</span>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[360px] max-w-[90vw] overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h3 className="font-bold">Notificaciones</h3>
              <p className="text-xs text-gray-500">
                {unreadCount} sin leer
              </p>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={processing || unreadCount === 0}
              className="text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              {processing ? "Procesando..." : "Marcar todas"}
            </button>
          </div>

          {message && (
            <div className="border-b bg-red-50 p-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <div className="max-h-[460px] overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-gray-500">
                Cargando notificaciones...
              </p>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-gray-700">
                  No tienes notificaciones
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Las novedades de tus viajes aparecerán aquí.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notificationLink(notification)}
                  onClick={() => {
                    setOpen(false);

                    if (!notification.read_at) {
                      void markAsRead(notification.id);
                    }
                  }}
                  className={`block border-b p-4 transition hover:bg-gray-50 ${
                    notification.read_at ? "bg-white" : "bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${
                        notification.read_at
                          ? "bg-gray-300"
                          : "bg-blue-600"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">
                        {notification.title}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        {notification.body}
                      </p>

                      <p className="mt-2 text-xs text-gray-400">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
