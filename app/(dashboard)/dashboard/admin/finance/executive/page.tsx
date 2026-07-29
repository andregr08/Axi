"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import EnterpriseMetricCard from "@/components/enterprise/EnterpriseMetricCard";
import EnterprisePageHeader from "@/components/enterprise/EnterprisePageHeader";
import { isFinance } from "@/lib/auth/roles";
import {
  getFinanceDashboard,
  type FinanceDashboard,
} from "@/lib/finance/dashboard";
import {
  getFinanceExecutiveKpis,
  type FinanceExecutiveKpis,
} from "@/lib/finance/executive";
import { supabase } from "@/lib/supabaseClient";

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const preciseMoneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("es-MX", {
  notation: "compact",
  maximumFractionDigits: 1,
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

function formatPreciseMoney(value: number) {
  return preciseMoneyFormatter.format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return dateFormatter.format(new Date(year, month - 1, day));
}

function calculateAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) /
    values.length;
}

function calculatePercentageChange(
  currentValue: number,
  previousValue: number,
) {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

type ExecutiveAlert = {
  id: string;
  title: string;
  detail: string;
  level: "critical" | "warning";
  href: string;
};

export default function FinanceExecutivePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] =
    useState<FinanceDashboard | null>(null);
  const [executiveKpis, setExecutiveKpis] =
    useState<FinanceExecutiveKpis | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const loadExecutiveData = useCallback(
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
        const [dashboard, executive] = await Promise.all([
          getFinanceDashboard(),
          getFinanceExecutiveKpis(),
        ]);

        setStats(dashboard);
        setExecutiveKpis(executive);
        setLastUpdated(new Date());
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No fue posible cargar el centro ejecutivo.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadExecutiveData();
  }, [loadExecutiveData]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null =
      null;

    const requestRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        void loadExecutiveData(true);
      }, 800);
    };

    const channel = supabase
      .channel(`finance-executive-${crypto.randomUUID()}`)
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
          table: "withdrawal_requests",
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
      .subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadExecutiveData]);

  const chartData = useMemo(
    () =>
      stats?.dailyRevenue.map((item) => ({
        ...item,
        label: formatDate(item.date),
      })) ?? [],
    [stats],
  );

  const forecast = useMemo(() => {
    if (!stats || stats.dailyRevenue.length === 0) {
      return {
        projectedGrossRevenue: 0,
        projectedPlatformRevenue: 0,
        projectedDriverEarnings: 0,
        recentGrowth: 0,
        averageDailyRevenue: 0,
      };
    }

    const daily = stats.dailyRevenue;
    const last30 = daily.slice(-30);
    const last7 = daily.slice(-7);
    const previous7 = daily.slice(-14, -7);

    const averageDailyRevenue = calculateAverage(
      last30.map((item) => item.grossRevenue),
    );

    const averageDailyCommission = calculateAverage(
      last30.map((item) => item.platformCommission),
    );

    const averageDailyDriverEarnings = calculateAverage(
      last30.map((item) => item.netDriverEarnings),
    );

    const currentSevenDays = last7.reduce(
      (total, item) => total + item.grossRevenue,
      0,
    );

    const previousSevenDays = previous7.reduce(
      (total, item) => total + item.grossRevenue,
      0,
    );

    return {
      projectedGrossRevenue: averageDailyRevenue * 30,
      projectedPlatformRevenue: averageDailyCommission * 30,
      projectedDriverEarnings:
        averageDailyDriverEarnings * 30,
      recentGrowth: calculatePercentageChange(
        currentSevenDays,
        previousSevenDays,
      ),
      averageDailyRevenue,
    };
  }, [stats]);

  const reconciliationSummary = useMemo(() => {
    const items = stats?.reconciliation ?? [];

    const reconciled = items
      .filter((item) => item.status === "reconciled")
      .reduce((total, item) => total + item.payments, 0);

    const unreconciled = items
      .filter((item) => item.status !== "reconciled")
      .reduce((total, item) => total + item.payments, 0);

    const total = reconciled + unreconciled;

    return {
      reconciled,
      unreconciled,
      total,
      percentage:
        total > 0 ? (reconciled / total) * 100 : 100,
    };
  }, [stats]);

  const alerts = useMemo<ExecutiveAlert[]>(() => {
    if (!stats) {
      return [];
    }

    const result: ExecutiveAlert[] = [];

    if (reconciliationSummary.unreconciled > 0) {
      result.push({
        id: "reconciliation",
        title: "Pagos sin conciliar",
        detail: `${reconciliationSummary.unreconciled} pagos necesitan revisión financiera.`,
        level: "critical",
        href: "/dashboard/admin/finance/reconciliation",
      });
    }

    if (stats.pendingFinancialTransactions > 0) {
      result.push({
        id: "pending-transactions",
        title: "Movimientos contables pendientes",
        detail: `${stats.pendingFinancialTransactions} transacciones todavía no han sido publicadas.`,
        level: "critical",
        href: "/dashboard/admin/finance/journal",
      });
    }

    if (stats.pendingWithdrawals > 0) {
      result.push({
        id: "withdrawals",
        title: "Retiros pendientes",
        detail: `${stats.pendingWithdrawals} retiros por ${formatPreciseMoney(
          stats.pendingWithdrawalAmount,
        )}.`,
        level: "warning",
        href: "/dashboard/admin/finance/withdrawals",
      });
    }

    if (stats.pendingRefunds > 0) {
      result.push({
        id: "refunds",
        title: "Reembolsos pendientes",
        detail: `${stats.pendingRefunds} reembolsos por ${formatPreciseMoney(
          stats.pendingRefundAmount,
        )}.`,
        level: "warning",
        href: "/dashboard/admin/finance/refunds",
      });
    }

    if (stats.cashDebt > 0) {
      result.push({
        id: "cash-debt",
        title: "Deuda de efectivo",
        detail: `${formatPreciseMoney(
          stats.cashDebt,
        )} deben recuperarse de conductores.`,
        level: "warning",
        href: "/dashboard/admin/finance/cash-debts",
      });
    }

    return result;
  }, [reconciliationSummary, stats]);

  const paymentTotal =
    (stats?.cashPaymentsAmount ?? 0) +
    (stats?.digitalPaymentsAmount ?? 0);

  const cashPercentage =
    paymentTotal > 0
      ? ((stats?.cashPaymentsAmount ?? 0) /
          paymentTotal) *
        100
      : 0;

  const digitalPercentage =
    paymentTotal > 0
      ? ((stats?.digitalPaymentsAmount ?? 0) /
          paymentTotal) *
        100
      : 0;

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Cargando centro ejecutivo...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <EnterprisePageHeader
        eyebrow="Dirección financiera"
        title="Executive Center"
        description="Visión ejecutiva de ingresos, rentabilidad, flujo operativo, obligaciones y riesgos financieros de AXI."
        actions={
          <button
            type="button"
            onClick={() => void loadExecutiveData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                refreshing ? "animate-spin" : "",
              ].join(" ")}
            />
            Actualizar
          </button>
        }
      />

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-300">
              Volumen procesado este mes
            </p>

            <p className="mt-2 text-4xl font-bold tracking-tight">
              {formatPreciseMoney(
                stats?.grossRevenueMonth ?? 0,
              )}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              <span>
                Comisión AXI:{" "}
                <strong className="text-white">
                  {formatPreciseMoney(
                    stats?.platformCommissionMonth ?? 0,
                  )}
                </strong>
              </span>

              <span>
                Conductores:{" "}
                <strong className="text-white">
                  {formatPreciseMoney(
                    stats?.netDriverEarningsMonth ?? 0,
                  )}
                </strong>
              </span>

              <span>
                Pagos completados:{" "}
                <strong className="text-white">
                  {stats?.totalPaidPayments.toLocaleString(
                    "es-MX",
                  ) ?? "0"}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs text-slate-300">Hoy</p>
              <p className="mt-1 font-semibold">
                {formatMoney(stats?.grossRevenueToday ?? 0)}
              </p>
            </div>

            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs text-slate-300">Semana</p>
              <p className="mt-1 font-semibold">
                {formatMoney(stats?.grossRevenueWeek ?? 0)}
              </p>
            </div>

            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs text-slate-300">Año</p>
              <p className="mt-1 font-semibold">
                {formatMoney(stats?.grossRevenueYear ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Indicadores principales
          </h2>
          <p className="text-sm text-slate-500">
            Métricas consolidadas de operación y finanzas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseMetricCard
            label="Volumen procesado"
            value={formatMoney(
              executiveKpis?.grossBookingValue ?? 0,
            )}
            detail={`${(
              executiveKpis?.paidPayments ?? 0
            ).toLocaleString("es-MX")} pagos completados`}
            icon={<CircleDollarSign className="h-5 w-5" />}
            tone="info"
          />

          <EnterpriseMetricCard
            label="Ingresos reales de AXI"
            value={formatMoney(
              executiveKpis?.platformRevenue ?? 0,
            )}
            detail="Comisiones reconocidas por la plataforma"
            icon={<TrendingUp className="h-5 w-5" />}
            tone="success"
          />

          <EnterpriseMetricCard
            label="Gastos contables"
            value={formatMoney(
              executiveKpis?.totalExpenses ?? 0,
            )}
            detail="Gastos publicados en el libro contable"
            icon={<ReceiptText className="h-5 w-5" />}
            tone={
              (executiveKpis?.totalExpenses ?? 0) > 0
                ? "warning"
                : "default"
            }
          />

          <EnterpriseMetricCard
            label="Resultado operativo neto"
            value={formatMoney(
              executiveKpis?.netOperatingResult ?? 0,
            )}
            detail="Ingresos AXI menos gastos contables"
            icon={
              (executiveKpis?.netOperatingResult ?? 0) >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )
            }
            tone={
              (executiveKpis?.netOperatingResult ?? 0) >= 0
                ? "success"
                : "danger"
            }
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Tendencia de ingresos
              </h2>
              <p className="text-sm text-slate-500">
                Volumen procesado, comisión AXI y ganancias de conductores.
              </p>
            </div>

            <span className="text-xs text-slate-400">
              Últimos {chartData.length} días
            </span>
          </div>

          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="grossRevenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#2563eb"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#2563eb"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={24}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    compactNumberFormatter.format(Number(value))
                  }
                />

                <Tooltip
                  formatter={(value, name) => [
                    formatPreciseMoney(Number(value ?? 0)),
                    name === "grossRevenue"
                      ? "Volumen procesado"
                      : name === "platformCommission"
                        ? "Comisión AXI"
                        : "Ganancia conductores",
                  ]}
                />

                <Legend
                  formatter={(value) =>
                    value === "grossRevenue"
                      ? "Volumen procesado"
                      : value === "platformCommission"
                        ? "Comisión AXI"
                        : "Conductores"
                  }
                />

                <Area
                  type="monotone"
                  dataKey="grossRevenue"
                  stroke="#2563eb"
                  fill="url(#grossRevenueGradient)"
                  strokeWidth={2}
                />

                <Area
                  type="monotone"
                  dataKey="platformCommission"
                  stroke="#16a34a"
                  fill="transparent"
                  strokeWidth={2}
                />

                <Area
                  type="monotone"
                  dataKey="netDriverEarnings"
                  stroke="#9333ea"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">
              Proyección a 30 días
            </h2>
            <p className="text-sm text-slate-500">
              Estimación basada en el promedio diario reciente.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Volumen proyectado
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(forecast.projectedGrossRevenue)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">
                  Comisión AXI
                </p>
                <p className="mt-1 font-bold text-emerald-900">
                  {formatMoney(
                    forecast.projectedPlatformRevenue,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-purple-50 p-4">
                <p className="text-xs text-purple-700">
                  Conductores
                </p>
                <p className="mt-1 font-bold text-purple-900">
                  {formatMoney(
                    forecast.projectedDriverEarnings,
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Tendencia últimos 7 días
                </span>

                <span
                  className={[
                    "inline-flex items-center gap-1 text-sm font-bold",
                    forecast.recentGrowth >= 0
                      ? "text-emerald-600"
                      : "text-red-600",
                  ].join(" ")}
                >
                  {forecast.recentGrowth >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}

                  {forecast.recentGrowth >= 0 ? "+" : ""}
                  {forecast.recentGrowth.toFixed(1)}%
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Promedio diario:{" "}
                {formatPreciseMoney(
                  forecast.averageDailyRevenue,
                )}
              </p>
            </div>

            <p className="text-xs leading-5 text-slate-400">
              Esta proyección es una estimación operativa y no sustituye
              un presupuesto financiero aprobado.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-6">
            <h2 className="font-bold text-slate-900">
              Distribución del valor
            </h2>
            <p className="text-sm text-slate-500">
              Comisión AXI frente a ganancias netas de conductores.
            </p>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.slice(-14)}
                barGap={2}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={16}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    compactNumberFormatter.format(Number(value))
                  }
                />

                <Tooltip
                  formatter={(value, name) => [
                    formatPreciseMoney(Number(value ?? 0)),
                    name === "platformCommission"
                      ? "AXI"
                      : "Conductores",
                  ]}
                />

                <Legend
                  formatter={(value) =>
                    value === "platformCommission"
                      ? "Comisión AXI"
                      : "Conductores"
                  }
                />

                <Bar
                  dataKey="platformCommission"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="netDriverEarnings"
                  fill="#9333ea"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-6">
            <h2 className="font-bold text-slate-900">
              Métodos de pago
            </h2>
            <p className="text-sm text-slate-500">
              Distribución histórica entre efectivo y pagos digitales.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <Banknote className="h-4 w-4" />
                  Efectivo
                </span>

                <span className="font-bold text-slate-900">
                  {cashPercentage.toFixed(1)}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${cashPercentage}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {formatPreciseMoney(
                  stats?.cashPaymentsAmount ?? 0,
                )}{" "}
                · {stats?.cashPaymentsCount ?? 0} pagos
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <CreditCard className="h-4 w-4" />
                  Digital
                </span>

                <span className="font-bold text-slate-900">
                  {digitalPercentage.toFixed(1)}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${digitalPercentage}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {formatPreciseMoney(
                  stats?.digitalPaymentsAmount ?? 0,
                )}{" "}
                · {stats?.digitalPaymentsCount ?? 0} pagos
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Wallet pasajeros aplicada
                </p>
                <p className="mt-1 font-bold text-slate-900">
                  {formatMoney(
                    stats?.passengerWalletAppliedTotal ?? 0,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Deuda en efectivo
                </p>
                <p className="mt-1 font-bold text-slate-900">
                  {formatMoney(stats?.cashDebt ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Alertas ejecutivas
              </h2>
              <p className="text-sm text-slate-500">
                Pendientes que pueden requerir intervención.
              </p>
            </div>

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-bold",
                alerts.length > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {alerts.length} activas
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
              No existen alertas financieras críticas en este momento.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() => router.push(alert.href)}
                  className={[
                    "flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left transition hover:shadow-sm",
                    alert.level === "critical"
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50",
                  ].join(" ")}
                >
                  <div className="flex gap-3">
                    <AlertTriangle
                      className={[
                        "mt-0.5 h-5 w-5 shrink-0",
                        alert.level === "critical"
                          ? "text-red-600"
                          : "text-amber-600",
                      ].join(" ")}
                    />

                    <div>
                      <p
                        className={[
                          "font-semibold",
                          alert.level === "critical"
                            ? "text-red-900"
                            : "text-amber-900",
                        ].join(" ")}
                      >
                        {alert.title}
                      </p>

                      <p
                        className={[
                          "mt-1 text-sm",
                          alert.level === "critical"
                            ? "text-red-700"
                            : "text-amber-700",
                        ].join(" ")}
                      >
                        {alert.detail}
                      </p>
                    </div>
                  </div>

                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-slate-900">
            Control financiero
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Conciliación
                </span>
                <span className="font-bold text-slate-900">
                  {reconciliationSummary.percentage.toFixed(1)}%
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      reconciliationSummary.percentage,
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="text-slate-500">
                Transacciones publicadas
              </span>
              <span className="font-bold text-slate-900">
                {stats?.postedFinancialTransactions ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Transacciones pendientes
              </span>
              <span className="font-bold text-amber-600">
                {stats?.pendingFinancialTransactions ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Transacciones revertidas
              </span>
              <span className="font-bold text-red-600">
                {stats?.reversedFinancialTransactions ?? 0}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <ReceiptText className="h-4 w-4 text-slate-500" />
                <p className="mt-2 text-xs text-slate-500">
                  Reembolsos
                </p>
                <p className="font-bold text-slate-900">
                  {stats?.pendingRefunds ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <Users className="h-4 w-4 text-slate-500" />
                <p className="mt-2 text-xs text-slate-500">
                  Retiros
                </p>
                <p className="font-bold text-slate-900">
                  {stats?.pendingWithdrawals ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Accesos ejecutivos
          </h2>
          <p className="text-sm text-slate-500">
            Consulta el detalle contable y operativo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Estados financieros",
              detail: "Resultados, balance y flujo",
              href: "/dashboard/admin/finance/statements",
              icon: Landmark,
            },
            {
              title: "Libro mayor",
              detail: "Detalle por cuenta contable",
              href: "/dashboard/admin/finance/general-ledger",
              icon: ReceiptText,
            },
            {
              title: "Conciliación",
              detail: "Pagos y movimientos",
              href: "/dashboard/admin/finance/reconciliation",
              icon: CreditCard,
            },
            {
              title: "Centro fiscal",
              detail: "IVA, ISR y obligaciones",
              href: "/dashboard/admin/finance/taxes",
              icon: CalendarDays,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.href}
                onClick={() => router.push(item.href)}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>

                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-600" />
                </div>

                <p className="mt-4 font-bold text-slate-900">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.detail}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400">
        <span>
          Información financiera consolidada de AXI.
        </span>

        <span>
          Última actualización:{" "}
          {lastUpdated
            ? dateTimeFormatter.format(lastUpdated)
            : "Sin información"}
        </span>
      </footer>
    </div>
  );
}
