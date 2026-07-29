"use client";

import { useCallback, useEffect, useState } from "react";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import {
  formatCurrency,
  formatDate,
  getFinancialView,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

interface StatementData {
  profitLoss: FinancialRow[];
  balanceSheet: FinancialRow[];
  cashFlow: FinancialRow[];
}

const initialData: StatementData = {
  profitLoss: [],
  balanceSheet: [],
  cashFlow: [],
};

export default function FinancialStatementsPage() {
  const [data, setData] = useState<StatementData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profitLoss, balanceSheet, cashFlow] = await Promise.all([
        getFinancialView("finance_profit_loss_v1", {
          orderBy: "period_start",
          limit: 36,
        }),
        getFinancialView("finance_balance_sheet_v1", {
          limit: 1,
        }),
        getFinancialView("finance_cash_flow_v1", {
          orderBy: "finance_date",
          limit: 90,
        }),
      ]);

      setData({
        profitLoss,
        balanceSheet,
        cashFlow,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los estados financieros.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const balance = data.balanceSheet[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Finanzas</p>
          <h1 className="text-2xl font-bold text-slate-900">
            Estados financieros
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Estado de resultados, balance general y flujo de efectivo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </header>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Cargando estados financieros…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Balance general
            </h2>

            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Activos"
                value={formatCurrency(balance?.total_assets)}
              />
              <MetricCard
                label="Pasivos"
                value={formatCurrency(balance?.total_liabilities)}
              />
              <MetricCard
                label="Resultado acumulado"
                value={formatCurrency(balance?.retained_result)}
              />
              <MetricCard
                label="Diferencia contable"
                value={formatCurrency(balance?.accounting_difference)}
                detail={
                  balance?.is_balanced
                    ? "Balance cuadrado"
                    : "Requiere revisión"
                }
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Estado de resultados mensual
            </h2>

            <EnterpriseReportTable
              rows={data.profitLoss}
              columns={[
                {
                  key: "period_start",
                  label: "Periodo",
                  render: formatDate,
                },
                {
                  key: "total_income",
                  label: "Ingresos",
                  align: "right",
                  render: formatCurrency,
                },
                {
                  key: "total_expenses",
                  label: "Gastos",
                  align: "right",
                  render: formatCurrency,
                },
                {
                  key: "net_income",
                  label: "Utilidad neta",
                  align: "right",
                  render: formatCurrency,
                },
                {
                  key: "net_margin_percentage",
                  label: "Margen",
                  align: "right",
                  render: (value) => `${Number(value ?? 0).toFixed(2)}%`,
                },
              ]}
            />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Flujo de efectivo
            </h2>

            <EnterpriseReportTable
              rows={data.cashFlow}
              emptyMessage="Todavía no hay movimientos registrados en las cuentas de caja o bancos."
              columns={[
                {
                  key: "finance_date",
                  label: "Fecha",
                  render: formatDate,
                },
                {
                  key: "cash_inflows",
                  label: "Entradas",
                  align: "right",
                  render: formatCurrency,
                },
                {
                  key: "cash_outflows",
                  label: "Salidas",
                  align: "right",
                  render: formatCurrency,
                },
                {
                  key: "net_cash_flow",
                  label: "Flujo neto",
                  align: "right",
                  render: formatCurrency,
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
