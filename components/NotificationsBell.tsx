"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  read: boolean;
};

const initialNotifications: NotificationItem[] = [
  {
    id: "welcome",
    title: "Bienvenido a AXI",
    description: "Aquí recibirás avisos sobre viajes, pagos y seguridad.",
    href: "/dashboard",
    read: false,
  },
];

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative z-[10000] pointer-events-auto"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Abrir notificaciones"
        aria-expanded={open}
        className="relative z-[10000] flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 pointer-events-auto"
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-[10001] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Notificaciones
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                Actividad reciente
              </h2>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
              aria-label="Marcar todas como leídas"
            >
              <CheckCheck size={17} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-3">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={() => {
                  setNotifications((current) =>
                    current.map((item) =>
                      item.id === notification.id
                        ? { ...item, read: true }
                        : item
                    )
                  );

                  setOpen(false);
                }}
                className="flex items-start gap-3 rounded-2xl p-3 hover:bg-slate-50"
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    notification.read ? "bg-slate-300" : "bg-yellow-400"
                  }`}
                />

                <span className="min-w-0 flex-1">
                  <span className="block font-black text-slate-950">
                    {notification.title}
                  </span>

                  <span className="mt-1 block text-sm leading-5 text-slate-500">
                    {notification.description}
                  </span>
                </span>

                <ChevronRight
                  size={17}
                  className="mt-1 shrink-0 text-slate-300"
                />
              </Link>
            ))}
          </div>

          <div className="border-t border-slate-100 p-3">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white hover:bg-slate-800"
            >
              Configurar notificaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}