"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationsBell from "@/components/NotificationsBell";
import {
  Sidebar,
  type UserRole,
} from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [role, setRole] =
    useState<UserRole | null>(null);

  const [loadingRole, setLoadingRole] =
    useState(true);

  useEffect(() => {
    const timer = window.setTimeout(
      async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const { data, error } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

        if (error) {
          console.error(
            "Error cargando rol:",
            error.message
          );

          setRole("passenger");
        } else {
          setRole(
            data.role as UserRole
          );
        }

        setLoadingRole(false);
      },
      0
    );

    return () =>
      window.clearTimeout(timer);
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white px-8 py-6 font-semibold text-slate-600 shadow-sm">
          Cargando AXI...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        onLogout={handleLogout}
      />

      <div className="min-h-screen lg:pl-72">
        <Navbar
          role={role}
          notifications={
            <NotificationsBell />
          }
        />

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav
        role={role}
        onLogout={handleLogout}
      />
    </div>
  );
}
