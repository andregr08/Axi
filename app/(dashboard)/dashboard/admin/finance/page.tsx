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
  Landmark,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
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
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">
            Rendimiento
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ingresos generados por los viajes
            completados.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceCard
            title="Ingresos hoy"
            value={formatMoney(
              stats.grossRevenueToday,
            )}
            subtitle={`${stats.totalPaidPayments} pagos históricos`}
            icon={CircleDollarSign}
          />

          <FinanceCard
            title="Ingresos esta semana"
            value={formatMoney(
              stats.grossRevenueWeek,
            )}
            subtitle="Ventas brutas"
            icon={TrendingUp}
          />

          <FinanceCard
            title="Ingresos este mes"
            value={formatMoney(
              stats.grossRevenueMonth,
            )}
            subtitle={formatMoney(
              stats.platformCommissionMonth,
            ).concat(" para AXI")}
            icon={BadgeDollarSign}
          />

          <FinanceCard
            title="Ingresos históricos"
            value={formatMoney(
              stats.grossRevenueAllTime,
            )}
            subtitle={`${stats.totalPaidPayments} viajes pagados`}
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
            title="Ingreso neto AXI"
            value={formatMoney(
              stats.netPlatformRevenueBeforeExpenses,
            )}
            subtitle="Antes de gastos operativos"
            icon={TrendingUp}
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
          <h2 className="text-lg font-black text-slate-950">
            Impuestos y retenciones
          </h2>

          <div className="mt-6 divide-y divide-slate-100">
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-slate-600">
                IVA de comisión AXI
              </span>
              <span className="font-black text-slate-950">
                {formatMoney(
                  stats.platformCommissionIvaTotal,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-slate-600">
                Retención de IVA
              </span>
              <span className="font-black text-slate-950">
                {formatMoney(
                  stats.ivaWithholdingTotal,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-slate-600">
                Retención de ISR
              </span>
              <span className="font-black text-slate-950">
                {formatMoney(
                  stats.isrWithholdingTotal,
                )}
              </span>
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
