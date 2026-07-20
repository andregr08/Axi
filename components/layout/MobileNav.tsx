"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Home,
  LogOut,
  Menu,
  Route,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  getRoleLabel,
  isAdmin,
  isFinance,
  isSupport,
  type UserRole,
} from "@/lib/auth/roles";
import { Logo } from "@/components/shared/Logo";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

interface MobileNavProps {
  role: UserRole | null;
  onLogout?: () => void;
}

type NavigationItem = {
  href: string;
  labelKey?: string;
  label?: string;
  descriptionKey?: string;
  description?: string;
  icon: LucideIcon;
  visible: boolean;
};

export function MobileNav({
  role,
  onLogout,
}: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryItems: NavigationItem[] = [
    {
      href: "/dashboard",
      labelKey: "navigation.home",
      icon: Home,
      visible: true,
    },
    {
      href:
        role === "driver"
          ? "/dashboard/driver/available-trips"
          : "/dashboard/trips",
      labelKey:
        role === "driver"
          ? "navigation.availableTrips"
          : "navigation.myTrips",
      icon: Route,
      visible: true,
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
  ];

  const secondaryItems: NavigationItem[] = [
    {
      href: "/dashboard/driver-application",
      labelKey: "navigation.becomeDriver",
      descriptionKey:
        "navigation.sendDriverApplication",
      icon: ClipboardCheck,
      visible: role === "passenger",
    },
    {
      href: "/dashboard/driver/status",
      labelKey: "navigation.availability",
      descriptionKey:
        "navigation.manageAvailability",
      icon: Gauge,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/available-trips",
      labelKey: "navigation.availableTrips",
      descriptionKey:
        "navigation.nearbyRequests",
      icon: Route,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/profile",
      label: "Mi rendimiento",
      description: "Consulta ganancias, viajes y calificación",
      icon: UserRound,
      visible: role === "driver",
    },
    {
      href: "/dashboard/vehicles",
      labelKey: "navigation.myVehicles",
      descriptionKey: "navigation.manageFleet",
      icon: CarFront,

      visible: role === "driver" || isAdmin(role),

    },
    {
      href:
        "/dashboard/admin/driver-applications",
      labelKey: "navigation.applications",
      descriptionKey:
        "navigation.reviewDrivers",
      icon: ClipboardCheck,
      visible: isAdmin(role),
    },
    {
      href: "/dashboard/admin/drivers",
      labelKey: "navigation.drivers",
      descriptionKey:
        "navigation.manageDrivers",
      icon: CarFront,
      visible: isAdmin(role),
    },
    {
      href: "/dashboard/admin/passengers",
      labelKey: "navigation.passengers",
      descriptionKey:
        "navigation.registeredUsers",
      icon: UsersRound,
      visible: isAdmin(role),
    },
    {
      href: "/dashboard/admin/vehicles",
      labelKey: "navigation.adminVehicles",
      descriptionKey:
        "navigation.superviseFleet",
      icon: CarFront,
      visible: isAdmin(role),
    },
    {
      href: "/dashboard/admin/trips",
      labelKey: "navigation.adminTrips",
      descriptionKey:
        "navigation.superviseTrips",
      icon: ShieldCheck,
      visible: isAdmin(role),
    },
    {
      href: "/dashboard/admin/support",
      label: "Soporte",
      description: "Gestiona tickets, reportes e incidentes",
      icon: ShieldCheck,
      visible: isSupport(role),
    },
    {
      href: "/dashboard/admin/finance",
      label: "Finanzas",
      description: "Pagos, retiros, comisiones e incentivos",
      icon: CreditCard,
      visible: isFinance(role),
    },
  ];

  const visiblePrimaryItems =
    primaryItems.filter((item) => item.visible);

  const visibleSecondaryItems =
    secondaryItems.filter((item) => item.visible);

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  const roleName = role
    ? t(`roles.${role}`)
    : t("navigation.userFallback");

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label={t(
              "navigation.closeMenu"
            )}
            onClick={closeMenu}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />

          <section className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] bg-white pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <Logo href="/dashboard" />

                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label={t(
                    "navigation.closeMenu"
                  )}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition active:scale-95"
                >
                  <X size={21} />
                </button>
              </div>

              <div className="mt-5 rounded-3xl bg-[#0B0F19] p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">
                  {t("navigation.accountTitle")}
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 font-black text-black">
                    A
                  </span>

                  <div>
                    <p className="font-black">

                      {getRoleLabel(role)}

                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {t(
                        "navigation.safeSmartMobility"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {t("navigation.tools")}
              </p>

              <div className="space-y-2">
                {visibleSecondaryItems.map(
                  (item) => {
                    const Icon = item.icon;
                    const active = isActive(
                      item.href
                    );

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMenu}
                        className={cn(
                          "flex items-center gap-4 rounded-2xl border p-4 transition active:scale-[0.99]",
                          active
                            ? "border-yellow-400 bg-yellow-50"
                            : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                            active
                              ? "bg-yellow-400 text-black"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          <Icon size={21} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block font-black text-slate-950">
                            {item.labelKey ? t(item.labelKey) : item.label}
                          </span>

                          {item.descriptionKey && (
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {t(
                                item.descriptionKey
                              )}
                            </span>
                          )}
                        </span>
                      </Link>
                    );
                  }
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onLogout?.();
                }}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-black text-red-700 transition active:scale-[0.99]"
              >
                <LogOut size={19} />
                {t("navigation.logout")}
              </button>
            </div>
          </section>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {visiblePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold transition",
                  active
                    ? "text-slate-950"
                    : "text-slate-400"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-12 items-center justify-center rounded-xl transition",
                    active &&
                      "bg-yellow-400 text-black"
                  )}
                >
                  <Icon
                    size={19}
                    strokeWidth={2.2}
                  />
                </span>

                <span className="truncate">
                  {item.labelKey ? t(item.labelKey) : item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold text-slate-400 transition"
          >
            <span className="flex h-9 w-12 items-center justify-center rounded-xl">
              <Menu
                size={20}
                strokeWidth={2.2}
              />
            </span>

            <span>{t("navigation.more")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}