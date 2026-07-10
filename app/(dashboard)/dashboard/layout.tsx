"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "admin" | "driver" | "passenger";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    async function loadRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error cargando rol:", error.message);
        setRole("passenger");
      } else {
        setRole(data.role);
      }

      setLoadingRole(false);
    }

    loadRole();
  }, [router]);

  const menuItems = [
    { href: "/dashboard", label: "Inicio", visible: true },
    { href: "/dashboard/profile", label: "Perfil", visible: true },
    { href: "/dashboard/trips", label: "Mis viajes", visible: true },

    {
      href: "/dashboard/driver/status",
      label: "Disponibilidad",
      visible: role === "driver",
    },
    {
      href: "/dashboard/driver/available-trips",
      label: "Viajes disponibles",
      visible: role === "driver",
    },

    {
      href: "/dashboard/driver-application",
      label: "Ser conductor",
      visible: role === "passenger",
    },

    {
      href: "/dashboard/vehicles",
      label: "Mis vehículos",
      visible: role === "driver" || role === "admin",
    },

    { href: "/dashboard/payments", label: "Pagos", visible: true },

    {
      href: "/dashboard/admin/driver-applications",
      label: "Solicitudes",
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/drivers",
      label: "Conductores",
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/passengers",
      label: "Pasajeros",
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/vehicles",
      label: "Vehículos admin",
      visible: role === "admin",
    },
    {
      href: "/dashboard/admin/trips",
      label: "Viajes admin",
      visible: role === "admin",
    },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-black p-6 text-white">
        <h1 className="mb-10 text-3xl font-bold">AXI</h1>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {!loadingRole &&
            menuItems
              .filter((item) => item.visible)
              .map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-4 py-3 ${
                      active
                        ? "bg-white text-black"
                        : "hover:bg-gray-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-4 rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700"
        >
          Cerrar sesión
        </button>
      </aside>

      <div className="ml-64">
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
          <h2 className="text-xl font-semibold">Panel de control</h2>

          <div className="text-right">
            <p className="text-sm font-semibold">AXI Mobility</p>
            <p className="text-xs text-gray-500">
              {role === "admin" && "Administrador"}
              {role === "driver" && "Conductor"}
              {role === "passenger" && "Pasajero"}
            </p>
          </div>
        </header>

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
