"use client";

import Link from "next/link";
import { ChevronRight, UserRound } from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import type { UserRole } from "@/components/layout/Sidebar";

type NavbarProps = {
  role: UserRole | null;
};

const roleNames: Record<UserRole, string> = {
  admin: "Administrador",
  driver: "Conductor",
  passenger: "Pasajero",
};

export function Navbar({ role }: NavbarProps) {
  return (
    <header className="sticky top-0 z-[9999] border-b border-slate-200 bg-white/95 backdrop-blur-xl pointer-events-auto">
      <div className="relative z-[9999] flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8 pointer-events-auto">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Panel AXI
          </p>

          <p className="mt-1 hidden text-sm font-bold text-slate-700 sm:block">
            Movilidad segura e inteligente
          </p>
        </div>

        <div className="relative z-[9999] flex items-center gap-3 pointer-events-auto">
          <NotificationsBell />

          <Link
            href="/dashboard/profile"
            className="relative z-[9999] flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] pointer-events-auto"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-black">
              <UserRound size={18} />
            </span>

            <span className="hidden text-left sm:block">
              <span className="block text-xs font-bold text-slate-400">
                Mi cuenta
              </span>

              <span className="block text-sm font-black text-slate-950">
                {role ? roleNames[role] : "Usuario AXI"}
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