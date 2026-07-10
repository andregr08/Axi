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

  useEffect(() => {
    async function loadRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setRole(data?.role ?? "passenger");
    }

    loadRole();
  }, [router]);

  const menuItems = [
    { href: "/dashboard", label: "Inicio", visible: true },
    { href: "/dashboard/profile", label: "Perfil", visible: true },
    { href: "/dashboard/trips", label: "Viajes", visible: true },
    {
      href: "/dashboard/vehicles",
      label: "Vehículos",
      visible: role === "driver" || role === "admin",
    },
    { href: "/dashboard/payments", label: "Pagos", visible: true },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-black p-6 text-white">
        <h1 className="mb-10 text-3xl font-bold">AXI</h1>

        <nav className="space-y-2">
          {menuItems
            .filter((item) => item.visible)
            .map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-4 py-3 ${
                    active ? "bg-white text-black" : "hover:bg-gray-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <button
          onClick={handleLogout}
          className="absolute bottom-6 left-6 right-6 rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700"
        >
          Cerrar sesión
        </button>
      </aside>

      <div className="ml-64">
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
          <h2 className="text-xl font-semibold">Panel de control</h2>
          <span className="text-sm text-gray-500">AXI Mobility</span>
        </header>

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
