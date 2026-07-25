"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FinanceSidebar from "@/components/finance/FinanceSidebar";
import { isFinance, type UserRole } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    async function validateAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, account_active")
        .eq("id", session.user.id)
        .single();

      if (
        error ||
        profile?.account_active === false ||
        !isFinance(profile?.role as UserRole | null)
      ) {
        router.replace("/dashboard");
        return;
      }

      setAuthorized(true);
      setCheckingAccess(false);
    }

    void validateAccess();
  }, [router]);

  if (checkingAccess || !authorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-yellow-400" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Verificando acceso a Finanzas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <FinanceSidebar />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
