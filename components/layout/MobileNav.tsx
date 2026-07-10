"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFront,
  CreditCard,
  Home,
  Route,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/components/layout/Sidebar";
import { cn } from "@/utils/cn";

interface MobileNavProps {
  role: UserRole | null;
}

type MobileItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
};

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();

  const items: MobileItem[] = [
    {
      href: "/dashboard",
      label: "Inicio",
      icon: Home,
      visible: true,
    },
    {
      href: "/dashboard/trips",
      label: "Viajes",
      icon: Route,
      visible: true,
    },
    {
      href: "/dashboard/vehicles",
      label: "Vehículo",
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
  ];

  const visibleItems = items.filter((item) => item.visible);

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl lg:hidden">
      <div
        className="mx-auto grid max-w-lg"
        style={{
          gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))`,
        }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold transition",
                active ? "text-slate-950" : "text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-12 items-center justify-center rounded-xl transition",
                  active && "bg-yellow-400 text-black"
                )}
              >
                <Icon size={19} strokeWidth={2.2} />
              </span>

              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
