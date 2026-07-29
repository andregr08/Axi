"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BrainCircuit,
  CircleDollarSign,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getFinanceDashboard,
  type FinanceDashboard,
} from "@/lib/finance/dashboard";
import {
  getFinanceExecutiveKpis,
  type FinanceExecutiveKpis,
} from "@/lib/finance/executive";
import {
  getFinanceIntelligenceFromDatabase,
  type FinanceIntelligence,
  type IntelligenceSeverity,
} from "@/lib/finance/intelligence";
import { supabase } from "@/lib/supabaseClient";

const moneyFormatter = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("es-US", {
  day: "2-digit",
  month: "short",
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatCompactMoney(value: number): string {
  return compactMoneyFormatter.format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function severityClasses(severity: IntelligenceSeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-blue-200 bg-blue-50 text-blue-800";
  }
}

function severityIcon(severity: IntelligenceSeverity) {
  switch (severity) {
    case "critical":
      return <ShieldAlert className="h-5 w-5" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5" />;
    case "positive":
      return <TrendingUp className="h-5 w-5" />;
    default:
      return <Activity className="h-5 w-5" />;
  }
}

type MetricCardProps = {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend?: number;
};

function MetricCard({
  label,
  value,
  description,
  icon,
  trend,
}: MetricCardProps) {
  const trendIsPositive = (trend ?? 0) >= 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        {trend !== undefined ? (
          <span
            className={[
              "inline-flex items-center gap-1 font-semibold",
              trendIsPositive ? "text-emerald-600" : "text-red-600",
            ].join(" ")}
          >
            {trendIsPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}

            {formatPercentage(Math.abs(trend))}
          </span>
        ) : null}

        <span>{description}</span>
      </div>
    </article>
  );
}

export default function FinanceIntelligencePage() {
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);

  const [executive, setExecutive] = useState<FinanceExecutiveKpis | null>(null);

  const [intelligence, setIntelligence] = useState<FinanceIntelligence | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const [dashboardResult, executiveResult] = await Promise.all([
        getFinanceDashboard(),
        getFinanceExecutiveKpis(),
      ]);

      const intelligenceResult =
        await getFinanceIntelligenceFromDatabase(dashboardResult);

      setDashboard(dashboardResult);
      setExecutive(executiveResult);
      setIntelligence(intelligenceResult);
      setLastUpdated(new Date());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la inteligencia financiera.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    const channel = supabase
      .channel("finance-intelligence-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => void loadData(true),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transactions",
        },
        () => void loadData(true),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "refund_requests",
        },
        () => void loadData(true),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const trendChart = useMemo(() => {
    return (
      dashboard?.dailyRevenue.map((day) => ({
        date: dateFormatter.format(new Date(`${day.date}T12:00:00`)),
        volumen: day.grossRevenue,
        ingresoAxi: day.platformCommission,
        pagos: day.paidPayments,
      })) ?? []
    );
  }, [dashboard]);

  const forecastChart = useMemo(() => {
    return (
      intelligence?.forecast.map((point) => ({
        periodo: point.period,
        volumen: point.projectedRevenue,
        ingresoAxi: point.projectedPlatformRevenue,
        resultado: point.projectedOperatingResult,
      })) ?? []
    );
  }, [intelligence]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-9 w-9 animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Analizando la operación financiera...
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard || !executive || !intelligence) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="font-bold text-red-900">
          No se pudo generar el análisis
        </h1>
        <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const trendLabel =
    intelligence.revenueTrend === "growing"
      ? "Crecimiento"
      : intelligence.revenueTrend === "declining"
        ? "Contracción"
        : "Estable";

  return (
    <div className="space-y-6 pb-10">
      <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-blue-300">
              <BrainCircuit className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-[0.2em]">
                AXI Finance Intelligence
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Centro de Inteligencia Financiera
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Análisis automático de rentabilidad, tendencias, concentración,
              anomalías y proyecciones construido con información financiera
              real de AXI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lastUpdated ? (
              <p className="text-xs text-slate-400">
                Actualizado{" "}
                {lastUpdated.toLocaleTimeString("es-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw
                className={["h-4 w-4", refreshing ? "animate-spin" : ""].join(
                  " ",
                )}
              />
              Actualizar análisis
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tendencia actual
            </p>
            <div className="mt-2 flex items-center gap-2">
              {intelligence.revenueTrend === "growing" ? (
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              ) : intelligence.revenueTrend === "declining" ? (
                <TrendingDown className="h-5 w-5 text-red-400" />
              ) : (
                <Activity className="h-5 w-5 text-blue-400" />
              )}
              <p className="text-xl font-bold">{trendLabel}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Margen operativo
            </p>
            <p className="mt-2 text-xl font-bold">
              {formatPercentage(intelligence.operatingMarginPercentage)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Alertas activas
            </p>
            <p className="mt-2 text-xl font-bold">
              {intelligence.alerts.length}
            </p>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Proyección mensual"
          value={formatMoney(intelligence.projectedMonthlyRevenue)}
          description="Volumen estimado a 30 días"
          icon={<Target className="h-5 w-5" />}
          trend={intelligence.sevenDayGrowthPercentage}
        />

        <MetricCard
          label="Ingreso AXI proyectado"
          value={formatMoney(intelligence.projectedMonthlyPlatformRevenue)}
          description="Comisión estimada a 30 días"
          icon={<CircleDollarSign className="h-5 w-5" />}
        />

        <MetricCard
          label="Resultado proyectado"
          value={formatMoney(intelligence.projectedMonthlyOperatingResult)}
          description="Manteniendo el margen actual"
          icon={<BarChart3 className="h-5 w-5" />}
        />

        <MetricCard
          label="Ingreso diario promedio"
          value={formatMoney(intelligence.averageDailyRevenue)}
          description="Promedio de días con operación"
          icon={<Activity className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="font-bold text-slate-950">Tendencia diaria</h2>
            <p className="text-sm text-slate-500">
              Volumen procesado e ingreso reconocido por AXI.
            </p>
          </div>

          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChart}>
                <defs>
                  <linearGradient
                    id="volumeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={25} />
                <YAxis
                  tickFormatter={formatCompactMoney}
                  tick={{ fontSize: 11 }}
                  width={74}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatMoney(Number(value ?? 0)),
                    name === "volumen" ? "Volumen" : "Ingreso AXI",
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="volumen"
                  name="Volumen"
                  stroke="#2563eb"
                  fill="url(#volumeGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="ingresoAxi"
                  name="Ingreso AXI"
                  stroke="#059669"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">
            Indicadores de rentabilidad
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Eficiencia del modelo financiero acumulado.
          </p>

          <div className="mt-6 space-y-5">
            {[
              {
                label: "Margen operativo",
                value: intelligence.operatingMarginPercentage,
              },
              {
                label: "Take rate de plataforma",
                value: intelligence.platformTakeRatePercentage,
              },
              {
                label: "Gastos sobre ingresos AXI",
                value: intelligence.expenseRatioPercentage,
              },
              {
                label: "Volatilidad diaria",
                value: intelligence.volatilityPercentage,
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-slate-600">
                    {item.label}
                  </span>
                  <span className="font-bold text-slate-950">
                    {formatPercentage(item.value)}
                  </span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${Math.min(Math.max(item.value, 0), 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <Banknote className="h-5 w-5 text-amber-600" />
              <p className="mt-3 text-xs text-slate-500">Efectivo</p>
              <p className="text-lg font-bold text-slate-950">
                {formatPercentage(intelligence.cashSharePercentage)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <WalletCards className="h-5 w-5 text-blue-600" />
              <p className="mt-3 text-xs text-slate-500">Digital</p>
              <p className="text-lg font-bold text-slate-950">
                {formatPercentage(intelligence.digitalSharePercentage)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-slate-950">
              Alertas y recomendaciones
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Reglas automáticas basadas en la operación actual.
          </p>

          <div className="mt-5 space-y-3">
            {intelligence.alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className={[
                  "block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
                  severityClasses(alert.severity),
                ].join(" ")}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {severityIcon(alert.severity)}
                  </div>

                  <div>
                    <p className="text-sm font-bold">{alert.title}</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      {alert.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Pronóstico financiero</h2>
          <p className="mt-1 text-sm text-slate-500">
            Proyección lineal basada en el promedio diario disponible.
          </p>

          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={formatCompactMoney}
                  tick={{ fontSize: 11 }}
                  width={74}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      volumen: "Volumen",
                      ingresoAxi: "Ingreso AXI",
                      resultado: "Resultado operativo",
                    };

                    return [
                      formatMoney(Number(value ?? 0)),
                      labels[String(name)] ?? String(name),
                    ];
                  }}
                />
                <Legend />
                <Bar
                  dataKey="volumen"
                  name="Volumen"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="ingresoAxi"
                  name="Ingreso AXI"
                  fill="#0891b2"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="resultado"
                  name="Resultado operativo"
                  radius={[6, 6, 0, 0]}
                >
                  {forecastChart.map((entry) => (
                    <Cell
                      key={entry.periodo}
                      fill={entry.resultado >= 0 ? "#059669" : "#dc2626"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">
          Días con comportamiento atípico
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Jornadas que se alejaron significativamente del promedio observado.
        </p>

        {intelligence.anomalies.length === 0 ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center">
            <Activity className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              No hay suficientes anomalías relevantes
            </p>
            <p className="mt-1 text-xs text-slate-500">
              El análisis mejorará conforme AXI acumule más días con operación.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Ingreso real</th>
                  <th className="px-3 py-3">Esperado</th>
                  <th className="px-3 py-3">Desviación</th>
                  <th className="px-3 py-3">Lectura</th>
                </tr>
              </thead>

              <tbody>
                {intelligence.anomalies.map((anomaly) => (
                  <tr
                    key={`${anomaly.date}-${anomaly.direction}`}
                    className="border-b border-slate-100"
                  >
                    <td className="px-3 py-4 font-medium text-slate-700">
                      {new Date(`${anomaly.date}T12:00:00`).toLocaleDateString(
                        "es-US",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </td>

                    <td className="px-3 py-4 font-bold text-slate-950">
                      {formatMoney(anomaly.actualRevenue)}
                    </td>

                    <td className="px-3 py-4 text-slate-600">
                      {formatMoney(anomaly.expectedRevenue)}
                    </td>

                    <td
                      className={[
                        "px-3 py-4 font-bold",
                        anomaly.direction === "above"
                          ? "text-emerald-600"
                          : "text-red-600",
                      ].join(" ")}
                    >
                      {anomaly.deviationPercentage > 0 ? "+" : ""}
                      {formatPercentage(anomaly.deviationPercentage)}
                    </td>

                    <td className="px-3 py-4 text-slate-600">
                      {anomaly.direction === "above"
                        ? "Rendimiento superior al patrón"
                        : "Rendimiento inferior al patrón"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
