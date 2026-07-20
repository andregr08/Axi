"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

type NotificationItem = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  href: string;
  read: boolean;
};

const initialNotifications: NotificationItem[] = [
  {
    id: "welcome",
    titleKey: "notifications.welcomeTitle",
    descriptionKey: "notifications.welcomeDescription",
    href: "/dashboard",
    read: false,
  },
];

export default function NotificationsBell() {
  const { t } = useLanguage();

  const [open, setOpen] = useState(false);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);

  const containerRef =
    useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !notification.read
      ).length,
    [notifications]
  );

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
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

  function markAsRead(
    notificationId: string
  ) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              read: true,
            }
          : notification
      )
    );
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto relative z-[10000]"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-label={t(
          "notifications.openNotifications"
        )}
        aria-expanded={open}
        className="pointer-events-auto relative z-[10000] flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="pointer-events-auto absolute right-0 top-14 z-[10001] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {t("notifications.title")}
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                {t("notifications.recentActivity")}
              </h2>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label={t(
                "notifications.markAllAsRead"
              )}
            >
              <CheckCheck size={17} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-3">
            {notifications.map(
              (notification) => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => {
                    markAsRead(notification.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-slate-50"
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      notification.read
                        ? "bg-slate-300"
                        : "bg-yellow-400"
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-slate-950">
                      {t(notification.titleKey)}
                    </span>

                    <span className="mt-1 block text-sm leading-5 text-slate-500">
                      {t(
                        notification.descriptionKey
                      )}
                    </span>
                  </span>

                  <ChevronRight
                    size={17}
                    className="mt-1 shrink-0 text-slate-300"
                  />
                </Link>
              )
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800"
            >
              {t(
                "notifications.configureNotifications"
              )}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
