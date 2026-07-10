"use client";

import Link from "next/link";
import { Bell, ChevronDown, Search } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import type { UserRole } from "@/components/layout/Sidebar";

interface NavbarProps {
  role: UserRole | null;
}

const roleNames: Record<UserRole, string> = {
  admin: "Administrador",
  driver: "Conductor",
  passenger: "Pasajero",
};

export function Navbar({ role }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <Logo href="/dashboard" compact />
        </div>

        <div className="hidden max-w-md flex-1 lg:block">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              placeholder="Buscar viajes, pagos o direcciones..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Notificaciones"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <Bell size={19} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-white" />
          </button>

          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-1.5 pr-3 transition hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B0F19] text-sm font-black text-yellow-400">
              A
            </span>

            <span className="hidden text-left sm:block">
              <span className="block text-sm font-bold text-slate-900">
                Mi cuenta
              </span>
              <span className="block text-xs text-slate-500">
                {role ? roleNames[role] : "Cargando..."}
              </span>
            </span>

            <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
          </Link>
        </div>
      </div>
    </header>
  );
}
