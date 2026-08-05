"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BadgeDollarSign,
  Banknote,
  CircleDollarSign,
  Clock3,
  Download,
  Landmark,
  LoaderCircle,
  Radio,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
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

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return dateFormatter.format(
    new Date(year, month - 1, day),
  );
}

function getReconciliationLabel(status: string) {
  const labels: Record<string, string> = {
    reconciled: "Conciliado",
    missing_financial_transaction:
      "Sin transacción financiera",
    missing_wallet_transaction: "Sin movimiento de wallet",
    amount_mismatch: "Diferencia de monto",
    pending: "Pendiente",
    unknown: "Desconocido",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

export default function FinanceAdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] =
    useState<FinanceDashboard | null>(null);
  const [message, setMessage] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "live" | "error"
  >("connecting");
  const [lastRealtimeUpdate, setLastRealtimeUpdate] =
    useState<Date | null>(null);

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

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

      if (
        profileError ||
        !isFinance(profile?.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      try {
        const dashboard =
          await getFinanceDashboard();

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

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null =
      null;

    const requestRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        setLastRealtimeUpdate(new Date());
        void loadFinance(true);
      }, 700);
    };

    const channel = supabase
      .channel(`finance-dashboard-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_transactions",
        },
        requestRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_wallets",
        },
        requestRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdraw_requests",
        },
        requestRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "refund_requests",
        },
        requestRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transactions",
        },
        requestRefresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          setRealtimeStatus("error");
          return;
        }

        setRealtimeStatus("connecting");
      });

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadFinance]);

  const maxDailyRevenue = useMemo(() => {
    if (!stats?.dailyRevenue.length) {
      return 0;
    }

    return Math.max(
      ...stats.dailyRevenue.map(
        (item) => item.grossRevenue,
      ),
    );
  }, [stats]);

  const totalPaymentAmount =
    (stats?.cashPaymentsAmount ?? 0) +
    (stats?.digitalPaymentsAmount ?? 0);

  const cashPercentage =
    totalPaymentAmount > 0
      ? ((stats?.cashPaymentsAmount ?? 0) /
          totalPaymentAmount) *
        100
      : 0;

  const digitalPercentage =
    totalPaymentAmount > 0
      ? ((stats?.digitalPaymentsAmount ?? 0) /
          totalPaymentAmount) *
        100
      : 0;

  const unreconciledPayments =
    stats?.reconciliation
      .filter((item) => item.status !== "reconciled")
      .reduce(
        (total, item) => total + item.payments,
        0,
      ) ?? 0;

  const totalReconciliationPayments =
    stats?.reconciliation.reduce(
      (total, item) => total + item.payments,
      0,
    ) ?? 0;

  const reconciledPayments =
    stats?.reconciliation
      .filter((item) => item.status === "reconciled")
      .reduce(
        (total, item) => total + item.payments,
        0,
      ) ?? 0;

  const reconciliationPercentage =
    totalReconciliationPayments > 0
      ? (reconciledPayments / totalReconciliationPayments) * 100
      : 100;

  const averageTicket =
    (stats?.totalPaidPayments ?? 0) > 0
      ? (stats?.grossRevenueAllTime ?? 0) /
        (stats?.totalPaidPayments ?? 1)
      : 0;

  const totalTaxesAdministered =
    (stats?.platformCommissionIvaTotal ?? 0) +
    (stats?.ivaWithholdingTotal ?? 0) +
    (stats?.isrWithholdingTotal ?? 0);

  const effectivePlatformMargin =
    (stats?.grossRevenueAllTime ?? 0) > 0
      ? ((stats?.platformCommissionAllTime ?? 0) /
          (stats?.grossRevenueAllTime ?? 1)) *
        100
      : 0;

  const financialAlerts = useMemo(() => {
    if (!stats) {
      return [];
    }

    const alerts: Array<{
      id: string;
      title: string;
      detail: string;
      severity: "warning" | "critical";
    }> = [];

    if (unreconciledPayments > 0) {
      alerts.push({
        id: "reconciliation",
        title: "Pagos sin conciliar",
        detail: `${unreconciledPayments} pago${
          unreconciledPayments === 1 ? "" : "s"
        } requieren revisión.`,
        severity: "critical",
      });
    }

    if (stats.pendingFinancialTransactions > 0) {
      alerts.push({
        id: "financial-transactions",
        title: "Movimientos contables pendientes",
        detail: `${stats.pendingFinancialTransactions} transacción${
          stats.pendingFinancialTransactions === 1
            ? ""
            : "es"
        } todavía no se ha publicado.`,
        severity: "critical",
      });
    }

    if (stats.pendingWithdrawals > 0) {
      alerts.push({
        id: "withdrawals",
        title: "Retiros por procesar",
        detail: `${stats.pendingWithdrawals} retiro${
          stats.pendingWithdrawals === 1 ? "" : "s"
        } por ${formatMoney(
          stats.pendingWithdrawalAmount,
        )}.`,
        severity: "warning",
      });
    }

    if (stats.pendingRefunds > 0) {
      alerts.push({
        id: "refunds",
        title: "Reembolsos pendientes",
        detail: `${stats.pendingRefunds} solicitud${
          stats.pendingRefunds === 1 ? "" : "es"
        } por ${formatMoney(stats.pendingRefundAmount)}.`,
        severity: "warning",
      });
    }

    if (stats.cashDebt > 0) {
      alerts.push({
        id: "cash-debt",
        title: "Deuda de efectivo activa",
        detail: `${formatMoney(
          stats.cashDebt,
        )} de participación de AXI está por recuperar.`,
        severity: "warning",
      });
    }

    return alerts;
  }, [stats, unreconciledPayments]);

  function exportDailyRevenueCsv() {
    if (!stats || stats.dailyRevenue.length === 0) {
      setMessage(
        "Todavía no existen movimientos diarios para exportar.",
      );
      return;
    }

    const headers = [
      "Fecha",
      "Pagos completados",
      "Ingreso bruto",
      "Comision AXI",
      "Ganancia bruta conductores",
      "Ganancia neta conductores",
      "Efectivo",
      "Digital",
      "IVA comision AXI",
      "Retencion IVA",
      "Retencion ISR",
    ];

    const rows = stats.dailyRevenue.map((item) => [
      item.date,
      item.paidPayments,
      item.grossRevenue.toFixed(2),
      item.platformCommission.toFixed(2),
      item.grossDriverEarnings.toFixed(2),
      item.netDriverEarnings.toFixed(2),
      item.cashAmount.toFixed(2),
      item.digitalAmount.toFixed(2),
      item.platformCommissionIva.toFixed(2),
      item.ivaWithholding.toFixed(2),
      item.isrWithholding.toFixed(2),
    ]);

    const escapeCsv = (
      value: string | number,
    ): string => {
      const stringValue = String(value);

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replaceAll('"', '""')}"`;
      }

      return stringValue;
    };

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) =>
        row.map(escapeCsv).join(","),
      ),
    ].join("\n");

    const blob = new Blob(
      ["\ufeff", csvContent],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    anchor.href = objectUrl;
    anchor.download = `axi-finanzas-${today}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }

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
          {message ||
            "No fue posible cargar el Centro Financiero."}
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
    <div className="space-y-8 pb-10">
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
              Ingresos, comisiones, ganancias de
              conductores, wallets, retiros, reembolsos
              y conciliación contable.
            </p>

            {stats.generatedAt && (
              <p className="mt-4 text-xs text-slate-400">
                Actualizado:{" "}
                {dateTimeFormatter.format(
                  new Date(stats.generatedAt),
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div
              className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-bold sm:self-auto ${
                realtimeStatus === "live"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : realtimeStatus === "error"
                    ? "bg-red-500/15 text-red-300"
                    : "bg-slate-700 text-slate-300"
              }`}
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  realtimeStatus === "live"
                    ? "animate-pulse"
                    : ""
                }`}
              />

              {realtimeStatus === "live"
                ? "En vivo"
                : realtimeStatus === "error"
                  ? "Sin conexión en vivo"
                  : "Conectando"}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={exportDailyRevenueCsv}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>

              <button
                type="button"
                onClick={() => void loadFinance(true)}
                disabled={refreshing}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 text-sm font-black text-slate-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Actualizar
              </button>
            </div>

            {lastRealtimeUpdate && (
              <p className="text-xs text-slate-400">
                Último cambio recibido:{" "}
                {lastRealtimeUpdate.toLocaleTimeString(
                  "es-MX",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  },
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section
        className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
          financialAlerts.length === 0
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`rounded-2xl p-3 ${
              financialAlerts.length === 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {financialAlerts.length === 0 ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <TriangleAlert className="h-6 w-6" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2
              className={`text-lg font-black ${
                financialAlerts.length === 0
                  ? "text-emerald-950"
                  : "text-amber-950"
              }`}
            >
              {financialAlerts.length === 0
                ? "Operación financiera saludable"
                : `${financialAlerts.length} alerta${
                    financialAlerts.length === 1
                      ? ""
                      : "s"
                  } financiera${
                    financialAlerts.length === 1
                      ? ""
                      : "s"
                  }`}
            </h2>

            {financialAlerts.length === 0 ? (
              <p className="mt-1 text-sm text-emerald-800">
                No existen pagos sin conciliar,
                movimientos contables pendientes,
                retiros ni reembolsos por revisar.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {financialAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border bg-white/80 px-4 py-3 ${
                      alert.severity === "critical"
                        ? "border-red-200"
                        : "border-amber-200"
                    }`}
                  >
                    <p
                      className={`text-sm font-black ${
                        alert.severity === "critical"
                          ? "text-red-800"
                          : "text-amber-900"
                      }`}
                    >
                      {alert.title}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {alert.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">
            Resumen ejecutivo
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Ingreso, participación de AXI y desempeño operativo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceCard
            title="Ingreso bruto"
            value={formatMoney(stats.grossRevenueAllTime)}
            subtitle={`${stats.totalPaidPayments} viajes pagados`}
            icon={CircleDollarSign}
          />

          <FinanceCard
            title="Comisión AXI"
            value={formatMoney(stats.platformCommissionAllTime)}
            subtitle={`${effectivePlatformMargin.toFixed(1)}% efectivo`}
            icon={BadgeDollarSign}
          />

          <FinanceCard
            title="Ingreso neto AXI"
            value={formatMoney(
              stats.netPlatformRevenueBeforeExpenses,
            )}
            subtitle="Antes de gastos operativos"
            icon={TrendingUp}
          />

          <FinanceCard
            title="Ticket promedio"
            value={formatMoney(averageTicket)}
            subtitle={formatMoney(
              stats.grossRevenueMonth,
            ).concat(" este mes")}
            icon={ReceiptText}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FinanceCard
            title="Ingreso hoy"
            value={formatMoney(stats.grossRevenueToday)}
            subtitle="Ventas brutas del día"
            icon={CircleDollarSign}
          />

          <FinanceCard
            title="Ingreso semanal"
            value={formatMoney(stats.grossRevenueWeek)}
            subtitle="Acumulado de la semana"
            icon={TrendingUp}
          />

          <FinanceCard
            title="Ingreso mensual"
            value={formatMoney(stats.grossRevenueMonth)}
            subtitle={formatMoney(
              stats.platformCommissionMonth,
            ).concat(" de comisión AXI")}
            icon={Landmark}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Ingresos diarios
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Últimos 30 días con actividad.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              MXN
            </span>
          </div>

          {stats.dailyRevenue.length === 0 ? (
            <div className="mt-8 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Todavía no hay movimientos diarios.
            </div>
          ) : (
            <div className="mt-8 flex h-64 items-end gap-2 overflow-x-auto pb-2">
              {stats.dailyRevenue.map((item) => {
                const height =
                  maxDailyRevenue > 0
                    ? Math.max(
                        (item.grossRevenue /
                          maxDailyRevenue) *
                          100,
                        5,
                      )
                    : 5;

                return (
                  <div
                    key={item.date}
                    className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2"
                    title={`${formatDate(
                      item.date,
                    )}: ${formatMoney(
                      item.grossRevenue,
                    )}`}
                  >
                    <span className="text-[10px] font-bold text-slate-500">
                      {formatMoney(
                        item.grossRevenue,
                      )}
                    </span>

                    <div className="flex h-44 w-full items-end rounded-xl bg-slate-100 p-1">
                      <div
                        className="w-full rounded-lg bg-slate-950 transition-all"
                        style={{
                          height: `${height}%`,
                        }}
                      />
                    </div>

                    <span className="text-[10px] font-semibold text-slate-500">
                      {formatDate(item.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black text-slate-950">
            Métodos de pago
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Distribución histórica por importe.
          </p>

          <div className="mt-7 space-y-6">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700">
                  Efectivo
                </span>
                <span className="text-slate-500">
                  {cashPercentage.toFixed(1)}%
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{
                    width: `${cashPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>
                  {stats.cashPaymentsCount} pagos
                </span>
                <span>
                  {formatMoney(
                    stats.cashPaymentsAmount,
                  )}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700">
                  Digital
                </span>
                <span className="text-slate-500">
                  {digitalPercentage.toFixed(1)}%
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{
                    width: `${digitalPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>
                  {stats.digitalPaymentsCount} pagos
                </span>
                <span>
                  {formatMoney(
                    stats.digitalPaymentsAmount,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">
            Participación y conductores
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceCard
            title="Participación AXI"
            value={formatMoney(
              stats.platformCommissionAllTime,
            )}
            subtitle="Ingreso histórico de la plataforma"
            icon={BadgeDollarSign}
          />

          <FinanceCard
            title="Conciliación"
            value={`${reconciliationPercentage.toFixed(1)}%`}
            subtitle={`${reconciledPayments} de ${totalReconciliationPayments} pagos`}
            icon={ShieldCheck}
          />

          <FinanceCard
            title="Ganancias conductores"
            value={formatMoney(
              stats.netDriverEarningsAllTime,
            )}
            subtitle={formatMoney(
              stats.netDriverEarningsMonth,
            ).concat(" este mes")}
            icon={Users}
          />

          <FinanceCard
            title="Deuda en efectivo"
            value={formatMoney(stats.cashDebt)}
            subtitle="Participación de AXI por recuperar"
            icon={Banknote}
          />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">
            Wallets y retiros
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceCard
            title="Saldo disponible"
            value={formatMoney(
              stats.availableBalance,
            )}
            subtitle="Listo para retiro"
            icon={CircleDollarSign}
          />

          <FinanceCard
            title="Saldo pendiente"
            value={formatMoney(stats.pendingBalance)}
            subtitle="Pagos digitales por confirmar"
            icon={Wallet}
          />

          <FinanceCard
            title="Saldo reservado"
            value={formatMoney(
              stats.reservedBalance,
            )}
            subtitle="Retiros en proceso"
            icon={Landmark}
          />

          <FinanceCard
            title="Retiros pendientes"
            value={String(
              stats.pendingWithdrawals,
            )}
            subtitle={formatMoney(
              stats.pendingWithdrawalAmount,
            )}
            icon={Clock3}
          />

          <FinanceCard
            title="Total retirado"
            value={formatMoney(stats.totalWithdrawn)}
            subtitle={`${stats.paidWithdrawals} retiros pagados`}
            icon={BadgeCheck}
          />

          <FinanceCard
            title="Wallets registradas"
            value={String(stats.totalWallets)}
            subtitle={formatMoney(
              stats.walletLifetimeEarnings,
            ).concat(" generado")}
            icon={Users}
          />

          <FinanceCard
            title="Reembolsos pendientes"
            value={String(stats.pendingRefunds)}
            subtitle={formatMoney(
              stats.pendingRefundAmount,
            )}
            icon={ReceiptText}
          />

          <FinanceCard
            title="Saldo de pasajeros usado"
            value={formatMoney(
              stats.passengerWalletAppliedTotal,
            )}
            subtitle="Wallet aplicada a viajes"
            icon={Wallet}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                Fiscal
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Impuestos y retenciones
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Obligaciones fiscales generadas por la operación.
              </p>
            </div>

            <a
              href="/dashboard/admin/finance/taxes"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Ver Centro Fiscal
            </a>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Total fiscal administrado
            </p>

            <p className="mt-2 text-3xl font-black">
              {formatMoney(totalTaxesAdministered)}
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Incluye IVA de la comisión de AXI, IVA retenido e ISR retenido.
              No representa utilidad de la plataforma.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    IVA cobrado por AXI
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    IVA trasladado sobre la comisión de la plataforma.
                  </p>
                </div>

                <span className="text-lg font-black text-slate-950">
                  {formatMoney(stats.platformCommissionIvaTotal)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    IVA retenido
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Retención aplicada a los ingresos de conductores.
                  </p>
                </div>

                <span className="text-lg font-black text-slate-950">
                  {formatMoney(stats.ivaWithholdingTotal)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    ISR retenido
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ISR retenido a conductores por la plataforma.
                  </p>
                </div>

                <span className="text-lg font-black text-slate-950">
                  {formatMoney(stats.isrWithholdingTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-2xl p-3 ${
                unreconciledPayments === 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-950">
                Conciliación financiera
              </h2>
              <p className="text-sm text-slate-500">
                Validación entre pagos, wallet y
                contabilidad.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {stats.reconciliation.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No existen pagos para conciliar.
              </div>
            ) : (
              stats.reconciliation.map((item) => {
                const reconciled =
                  item.status === "reconciled";

                return (
                  <div
                    key={item.status}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          reconciled
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                      />

                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {getReconciliationLabel(
                            item.status,
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.payments} pagos
                        </p>
                      </div>
                    </div>

                    <span className="text-sm font-black text-slate-950">
                      {formatMoney(item.totalAmount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-slate-950">
          Motor financiero
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-700">
              Publicadas
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {stats.postedFinancialTransactions}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-700">
              Pendientes
            </p>
            <p className="mt-2 text-3xl font-black text-amber-950">
              {stats.pendingFinancialTransactions}
            </p>
          </div>

          <div className="rounded-2xl bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">
              Revertidas
            </p>
            <p className="mt-2 text-3xl font-black text-red-950">
              {stats.reversedFinancialTransactions}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
