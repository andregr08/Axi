"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Navbar } from "@/components/layout/Navbar";
import {
  Sidebar,
  type UserRole,
} from "@/components/layout/Sidebar";
import { PushServiceWorker } from "@/components/notifications/PushServiceWorker";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        setRole((data?.role as UserRole) ?? "passenger");
      }

      setLoadingRole(false);
    }

    void loadRole();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-yellow-400" />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Cargando AXI...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-950">
      <Sidebar role={role} onLogout={handleLogout} />

      <div className="min-h-screen lg:ml-72">
        <Navbar role={role} />

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <MobileNav role={role} onLogout={handleLogout} />
    </div>
  );
}
