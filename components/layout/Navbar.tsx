"use client";

import Link from "next/link";
import {
  ChevronRight,
  UserRound,
} from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import type { UserRole } from "@/components/layout/Sidebar";
import { useLanguage } from "@/hooks/useLanguage";

type NavbarProps = {
  role: UserRole | null;
};

export function Navbar({ role }: NavbarProps) {
  const { t } = useLanguage();

  const roleName = role
    ? t(`roles.${role}`)
    : t("navigation.userFallback");

  return (
    <header className="pointer-events-auto sticky top-0 z-[9999] border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="pointer-events-auto relative z-[9999] flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            {t("navigation.panel")}
          </p>

          <p className="mt-1 hidden text-sm font-bold text-slate-700 sm:block">
            {t("navigation.safeSmartMobility")}
          </p>
        </div>

        <div className="pointer-events-auto relative z-[9999] flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />

          <NotificationsBell />

          <Link
            href="/dashboard/profile"
            className="pointer-events-auto relative z-[9999] flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] sm:px-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-black">
              <UserRound size={18} />
            </span>

            <span className="hidden text-left sm:block">
              <span className="block text-xs font-bold text-slate-400">
                {t("navigation.myAccount")}
              </span>

              <span className="block text-sm font-black text-slate-950">
                {roleName}
              </span>
            </span>

            <ChevronRight
              size={17}
              className="hidden text-slate-300 sm:block"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}