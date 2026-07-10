"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Navbar } from "@/components/layout/Navbar";
import {
  Sidebar,
  type UserRole,
} from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error cargando rol:", error.message);
      }

      setRole((data?.role as UserRole) ?? "passenger");
    }

    void loadRole();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
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

      <MobileNav role={role} />
    </div>
  );
}
