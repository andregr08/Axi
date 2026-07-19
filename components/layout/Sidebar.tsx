"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFront,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Headphones,
  Home,
  LogOut,
  Route,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

export type UserRole = "admin" | "driver" | "passenger";

interface SidebarProps {
  role: UserRole | null;
  onLogout: () => void;
}

type MenuItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  visible: boolean;
};

export function Sidebar({
  role,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const menuItems: MenuItem[] = [
    {
      href: "/dashboard",
      labelKey: "navigation.home",
      icon: Home,
      visible: true,
    },
    {
      href: "/dashboard/trips",
      labelKey: "navigation.myTrips",
      icon: Route,
      visible: true,
    },
    {
      href: "/dashboard/driver/status",
      labelKey: "navigation.availability",
      icon: Gauge,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/available-trips",
      labelKey: "navigation.availableTrips",
      icon: CarFront,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver-application",
      labelKey: "navigation.becomeDriver",
      icon: ClipboardCheck,
      visible: role === "passenger",
    },
    {
      href: "/dashboard/vehicles",
      labelKey: "navigation.myVehicles",
      icon: CarFront,
      visible: role === "driver" || role === "admin",
    },
    {
      href: "/dashboard/payments",
      labelKey: "navigation.payments",
      icon: CreditCard,
      visible: true,
    },
    {
      href: "/dashboard/profile",
      labelKey: "navigation.profile",
      icon: UserRound,
      visible: true,
    },
    {
      href: "/dashboard/admin/driver-applications",
      labelKey: "navigation.applications",
      icon: ClipboardCheck,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/drivers",
      labelKey: "navigation.drivers",
      icon: CarFront,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/passengers",
      labelKey: "navigation.passengers",
      icon: UsersRound,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/vehicles",
      labelKey: "navigation.adminVehicles",
      icon: CarFront,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/trips",
      labelKey: "navigation.adminTrips",
      icon: ShieldCheck,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/support",
      labelKey: "navigation.support",
      icon: Headphones,
      visible: role === "admin",
    },
  ];

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/10 bg-[#0B0F19] px-5 py-6 text-white lg:flex">
      <div className="px-3">
        <Logo href="/dashboard" dark />
      </div>

      <div className="mt-10 px-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
          {t("navigation.navigation")}
        </p>
      </div>

      <nav className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {menuItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/10"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                    active
                      ? "bg-black/10"
                      : "bg-white/5 group-hover:bg-white/10"
                  )}
                >
                  <Icon
                    size={20}
                    strokeWidth={2.2}
                  />
                </span>

                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
      </nav>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-bold text-white">
          AXI Mobility
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t("navigation.mobilityDescription")}
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={17} />
          {t("navigation.logout")}
        </button>
      </div>
    </aside>
  );
}