"use client";

import { useEffect, useState } from "react";

import FinanceCard from "@/components/finance/FinanceCard";
import {
  getFinanceDashboard,
  type FinanceDashboard,
} from "@/lib/finance/dashboard";

import {
  Wallet,
  Clock3,
  Gift,
  Banknote,
  BadgeDollarSign,
  Users,
  LoaderCircle,
} from "lucide-react";

export default function FinanceAdminPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FinanceDashboard | null>(null);

  useEffect(() => {
    getFinanceDashboard()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Centro Financiero
        </h1>

        <p className="text-gray-500">
          Administración financiera de AXI
        </p>
      </div>

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
