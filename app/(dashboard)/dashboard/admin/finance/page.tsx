"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Banknote,
  Clock3,
  Gift,
  LoaderCircle,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";

import FinanceCard from "@/components/finance/FinanceCard";
import { isFinance } from "@/lib/auth/roles";
import {
  getFinanceDashboard,
  type FinanceDashboard,
} from "@/lib/finance/dashboard";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceAdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<FinanceDashboard | null>(null);
  const [message, setMessage] = useState("");

  const loadFinance = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !isFinance(profile?.role)) {
        router.replace("/dashboard");
        return;
      }

      try {
        const dashboard = await getFinanceDashboard();
        setStats(dashboard);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No fue posible cargar la información financiera.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">
          {message || "No fue posible cargar el Centro Financiero."}
        </p>

        <button
          type="button"
          onClick={() => void loadFinance()}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Centro Financiero</h1>

          <p className="text-gray-500">
            Administración financiera de AXI
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadFinance(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Actualizar
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FinanceCard
          title="Saldo pendiente"
          value={`$${stats.pendingBalance.toFixed(2)}`}
          subtitle="Conductores"
          icon={Wallet}
        />

        <FinanceCard
          title="Retiros pendientes"
          value={String(stats.pendingWithdrawals)}
          subtitle="Esperando aprobación"
          icon={Clock3}
        />

        <FinanceCard
          title="Bonos pendientes"
          value={String(stats.pendingBonuses)}
          subtitle="Por revisar"
          icon={Gift}
        />

        <FinanceCard
          title="Deuda efectivo"
          value={`$${stats.cashDebt.toFixed(2)}`}
          subtitle="Conductores"
          icon={Banknote}
        />

        <FinanceCard
          title="Comisiones hoy"
          value={`$${stats.commissionsToday.toFixed(2)}`}
          subtitle="Ingresos AXI"
          icon={BadgeDollarSign}
        />

        <FinanceCard
          title="Wallets activas"
          value={String(stats.activeWallets)}
          subtitle="Conductores"
          icon={Users}
        />
      </div>
    </div>
  );
}
