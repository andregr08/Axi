"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Banknote,
  CircleDollarSign,
  Clock3,
  Gift,
  HandCoins,
  LoaderCircle,
  RefreshCw,
  ReceiptText,
  TrendingUp,
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

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

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
      <div className="overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              AXI Finanzas
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Centro Financiero
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Control de saldos, comisiones, retiros, bonos, incentivos,
              reembolsos y deudas de conductores.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadFinance(true)}
            disabled={refreshing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 text-sm font-black text-slate-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualizar
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FinanceCard
          title="Comisiones de hoy"
          value={formatMoney(stats.commissionsToday)}
          subtitle="Ingresos generados para AXI"
          icon={TrendingUp}
        />

        <FinanceCard
          title="Saldo disponible"
          value={formatMoney(stats.availableBalance)}
          subtitle="Disponible en wallets"
          icon={CircleDollarSign}
        />

        <FinanceCard
          title="Saldo pendiente"
          value={formatMoney(stats.pendingBalance)}
          subtitle="Pendiente para conductores"
          icon={Wallet}
        />

        <FinanceCard
          title="Retiros pendientes"
          value={String(stats.pendingWithdrawals)}
          subtitle={formatMoney(stats.pendingWithdrawalAmount)}
          icon={Clock3}
        />

        <FinanceCard
          title="Bonos pendientes"
          value={String(stats.pendingBonuses)}
          subtitle={formatMoney(stats.pendingBonusAmount)}
          icon={Gift}
        />

        <FinanceCard
          title="Incentivos pendientes"
          value={String(stats.pendingIncentives)}
          subtitle={formatMoney(stats.pendingIncentiveAmount)}
          icon={HandCoins}
        />

        <FinanceCard
          title="Deuda en efectivo"
          value={formatMoney(stats.cashDebt)}
          subtitle="Comisiones por recuperar"
          icon={Banknote}
        />

        <FinanceCard
          title="Reembolsos pendientes"
          value={String(stats.pendingRefunds)}
          subtitle="Solicitudes por revisar"
          icon={ReceiptText}
        />

        <FinanceCard
          title="Wallets registradas"
          value={String(stats.totalWallets)}
          subtitle="Cuentas de conductores"
          icon={Users}
        />

        <FinanceCard
          title="Operación financiera"
          value="Activa"
          subtitle="Datos conectados con Supabase"
          icon={BadgeDollarSign}
        />
      </div>
    </div>
  );
}
