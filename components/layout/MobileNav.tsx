"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Headphones,
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
import type { UserRole } from "@/components/layout/Sidebar";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/utils/cn";

interface MobileNavProps {
  role: UserRole | null;
  onLogout: () => void;
}

type NavigationItem = {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  visible: boolean;
};

export function MobileNav({
  role,
  onLogout,
}: MobileNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryItems: NavigationItem[] = [
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
      href: "/dashboard/payments",
      label: "Pagos",
      icon: CreditCard,
      visible: true,
    },
    {
      href: "/dashboard/profile",
      label: "Cuenta",
      icon: UserRound,
      visible: true,
    },
  ];

  const secondaryItems: NavigationItem[] = [
    {
      href: "/dashboard/passenger/profile",
      label: "Perfil de pasajero",
      description: "Estadísticas y lugares guardados",
      icon: UserRound,
      visible: role === "passenger",
    },
    {
      href: "/dashboard/passenger/history",
      label: "Historial",
      description: "Viajes, pagos y recibos",
      icon: Route,
      visible: role === "passenger",
    },
    {
      href: "/dashboard/driver-application",
      label: "Ser conductor",
      description: "Envía tu solicitud para conducir",
      icon: ClipboardCheck,
      visible: role === "passenger",
    },
    {
      href: "/dashboard/driver/status",
      label: "Disponibilidad",
      description: "Activa o pausa tu operación",
      icon: Gauge,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/available-trips",
      label: "Viajes disponibles",
      description: "Consulta solicitudes cercanas",
      icon: CarFront,
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/profile",
      label: "Mi rendimiento",
      description: "Ganancias, viajes y reseñas",
      icon: Gauge,
      visible: role === "driver",
    },
    {
      href: "/dashboard/vehicles",
      label: "Mis vehículos",
      description: "Administra tus unidades",
      icon: CarFront,
      visible:
        role === "driver" ||
        role === "admin",
    },
    {
      href: "/dashboard/support",
      label: "Centro de ayuda",
      description: "Solicitudes y soporte",
      icon: Headphones,
      visible:
        role === "driver" ||
        role === "passenger",
    },
    {
      href: "/dashboard/security",
      label: "Seguridad",
      description: "Contactos de emergencia y SOS",
      icon: ShieldCheck,
      visible:
        role === "driver" ||
        role === "passenger",
    },
    {
      href: "/dashboard/admin/driver-applications",
      label: "Solicitudes",
      description: "Revisa nuevos conductores",
      icon: ClipboardCheck,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/drivers",
      label: "Conductores",
      description: "Administra conductores",
      icon: CarFront,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/passengers",
      label: "Pasajeros",
      description: "Consulta usuarios registrados",
      icon: UsersRound,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/vehicles",
      label: "Vehículos",
      description: "Supervisa la flotilla",
      icon: CarFront,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/trips",
      label: "Operación de viajes",
      description: "Supervisa todos los viajes",
      icon: Route,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/payments",
      label: "Transacciones",
      description: "Revisa pagos y reembolsos",
      icon: CreditCard,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/promotions",
      label: "Promociones",
      description: "Crea y administra cupones",
      icon: ClipboardCheck,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/support",
      label: "Soporte",
      description: "Gestiona tickets",
      icon: Headphones,
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/sos",
      label: "Alertas SOS",
      description: "Atiende emergencias",
      icon: ShieldCheck,
      visible: role === "admin",
    },
  ];

  const visiblePrimaryItems =
    primaryItems.filter(
      (item) => item.visible
    );

  const visibleSecondaryItems =
    secondaryItems.filter(
      (item) => item.visible
    );

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

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
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
                  aria-label="Cerrar menú"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"
                >
                  <X size={21} />
                </button>
              </div>

              <div className="mt-5 rounded-3xl bg-[#0B0F19] p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">
                  Mi cuenta AXI
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 font-black text-black">
                    A
                  </span>

                  <div>
                    <p className="font-black">
                      {role === "admin" && "Administrador"}
                      {role === "driver" && "Conductor"}
                      {role === "passenger" && "Pasajero"}
                      {!role && "Usuario AXI"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Movilidad segura e inteligente
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Herramientas
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
                          "flex items-center gap-4 rounded-2xl border p-4 transition",
                          active
                            ? "border-yellow-400 bg-yellow-50"
                            : "border-slate-100 bg-white hover:bg-slate-50"
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
                            {item.label}
                          </span>

                          {item.description && (
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {item.description}
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
                  onLogout();
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-4 font-bold text-red-600"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </section>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {visiblePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold",
                  active
                    ? "bg-yellow-400 text-black"
                    : "text-slate-500"
                )}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold text-slate-500"
          >
            <Menu size={20} />
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
