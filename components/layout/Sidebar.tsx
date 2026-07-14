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
import { cn } from "@/utils/cn";

export type UserRole = "admin" | "driver" | "passenger";

interface SidebarProps {
  role: UserRole | null;
  onLogout: () => void;
}

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
};

export function Sidebar({ role, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const menuItems: MenuItem[] = [
    {
      href: "/dashboard",
      label: "Inicio",
      icon: Home,
      visible: true,
    },
    {
      href: "/dashboard/trips",
      label: "Mis viajes",
      icon: Route,
      visible: true,
    },
    {
      href: "/dashboard/driver/status",
      label: "Disponibilidad",
      icon: Gauge,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/available-trips",
      label: "Viajes disponibles",
      icon: CarFront,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/profile",
      label: "Mi rendimiento",
      icon: UserRound,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver-application",
      label: "Ser conductor",
      icon: ClipboardCheck,
      visible: role === "passenger",
    },
    {
      href: "/dashboard/vehicles",
      label: "Mis vehículos",
      icon: CarFront,
      visible: role === "driver" || role === "admin",
    },
    {
      href: "/dashboard/payments",
      label: "Pagos",
      icon: CreditCard,
      visible: true,
    },
    {
      href: "/dashboard/profile",
      label: "Perfil",
      icon: UserRound,
      visible: true,
    },
    {
      href: "/dashboard/admin/driver-applications",
      label: "Solicitudes",
      icon: ClipboardCheck,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/drivers",
      label: "Conductores",
      icon: CarFront,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/passengers",
      label: "Pasajeros",
      icon: UsersRound,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/vehicles",
      label: "Vehículos admin",
      icon: CarFront,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/trips",
      label: "Viajes admin",
      icon: ShieldCheck,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/support",
      label: "Soporte",
      icon: Headphones,
      visible: role === "admin",
    },
  ];

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/10 bg-[#0B0F19] px-5 py-6 text-white lg:flex">
      <div className="px-3">
        <Logo href="/dashboard" dark />
      </div>

      <div className="mt-10 px-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Navegación
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
                  <Icon size={20} strokeWidth={2.2} />
                </span>

                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-bold text-white">AXI Mobility</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Movilidad segura, rápida e inteligente.
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
