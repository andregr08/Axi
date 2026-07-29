"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EnterpriseMetricCard,
  EnterprisePageHeader,
} from "@/components/enterprise";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import FinanceReportToolbar from "@/components/finance/FinanceReportToolbar";

import {
  createFinancialFilename,
  exportFinancialCsv,
  formatCurrency,
  formatDate,
  getFinancialView,
  getMexicoToday,
  getMexicoYearStart,
  sumFinancialColumn,
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
  const [dateFrom, setDateFrom] = useState(getMexicoYearStart());
  const [dateTo, setDateTo] = useState(getMexicoToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profitLoss, balanceSheet, cashFlow] = await Promise.all([
        getFinancialView("finance_profit_loss_v1", {
          orderBy: "period_start",
          limit: 120,
          filters: [
            {
              column: "period_start",
              operator: "gte",
              value: dateFrom,
            },
            {
              column: "period_start",
              operator: "lte",
              value: dateTo,
            },
          ],
        }),

        getFinancialView("finance_balance_sheet_v1", {
          limit: 1,
        }),

        getFinancialView("finance_cash_flow_v1", {
          orderBy: "finance_date",
          limit: 5000,
          filters: [
            {
              column: "finance_date",
              operator: "gte",
              value: dateFrom,
            },
            {
              column: "finance_date",
              operator: "lte",
              value: dateTo,
            },
          ],
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
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const balance = data.balanceSheet[0];

  const periodTotals = useMemo(
    () => ({
      income: sumFinancialColumn(data.profitLoss, "total_income"),
      expenses: sumFinancialColumn(data.profitLoss, "total_expenses"),
      netIncome: sumFinancialColumn(data.profitLoss, "net_income"),
      cashFlow: sumFinancialColumn(data.cashFlow, "net_cash_flow"),
    }),
    [data.cashFlow, data.profitLoss],
  );

  function exportProfitLoss() {
    try {
      exportFinancialCsv({
        filename: createFinancialFilename(
          "estado-de-resultados",
          dateFrom,
          dateTo,
        ),
        rows: data.profitLoss,
        columns: [
          {
            key: "period_start",
            label: "Periodo",
            format: formatDate,
          },
          {
            key: "total_income",
            label: "Ingresos",
          },
          {
            key: "total_expenses",
            label: "Gastos",
          },
          {
            key: "net_income",
            label: "Utilidad neta",
          },
          {
            key: "net_margin_percentage",
            label: "Margen porcentual",
          },
        ],
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar el reporte.",
      );
    }
  }

  function exportCashFlow() {
    try {
      exportFinancialCsv({
        filename: createFinancialFilename(
          "flujo-de-efectivo",
          dateFrom,
          dateTo,
        ),
        rows: data.cashFlow,
        columns: [
          {
            key: "finance_date",
            label: "Fecha",
            format: formatDate,
          },
          {
            key: "cash_inflows",
            label: "Entradas",
          },
          {
            key: "cash_outflows",
            label: "Salidas",
          },
          {
            key: "net_cash_flow",
            label: "Flujo neto",
          },
        ],
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar el flujo de efectivo.",
      );
    }
  }

  return (
    <div className="space-y-8">
      <EnterprisePageHeader
        eyebrow="Finanzas"
        title="Estados financieros"
        description="Estado de resultados, balance general y flujo de efectivo de AXI."
      />

      <FinanceReportToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onRefresh={() => void loadData()}
        onExport={exportProfitLoss}
        loading={loading}
        exportDisabled={data.profitLoss.length === 0}
      >
        <button
          type="button"
          onClick={exportCashFlow}
          disabled={loading || data.cashFlow.length === 0}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Exportar flujo de efectivo
        </button>
      </FinanceReportToolbar>

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
              <EnterpriseMetricCard
                label="Activos"
                value={formatCurrency(balance?.total_assets)}
                tone="info"
              />

              <EnterpriseMetricCard
                label="Pasivos"
                value={formatCurrency(balance?.total_liabilities)}
                tone="warning"
              />

              <EnterpriseMetricCard
                label="Resultado acumulado"
                value={formatCurrency(balance?.retained_result)}
                tone={
                  Number(balance?.retained_result ?? 0) >= 0
                    ? "success"
                    : "danger"
                }
              />

              <EnterpriseMetricCard
                label="Diferencia contable"
                value={formatCurrency(balance?.accounting_difference)}
                detail={
                  balance?.is_balanced
                    ? "Balance cuadrado"
                    : "Requiere revisión"
                }
                tone={balance?.is_balanced ? "success" : "danger"}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Resultado del periodo seleccionado
            </h2>

            <div className="grid gap-4 md:grid-cols-4">
              <EnterpriseMetricCard
                label="Ingresos"
                value={formatCurrency(periodTotals.income)}
                tone="success"
              />

              <EnterpriseMetricCard
                label="Gastos"
                value={formatCurrency(periodTotals.expenses)}
                tone="warning"
              />

              <EnterpriseMetricCard
                label="Utilidad neta"
                value={formatCurrency(periodTotals.netIncome)}
                tone={periodTotals.netIncome >= 0 ? "success" : "danger"}
              />

              <EnterpriseMetricCard
                label="Flujo neto"
                value={formatCurrency(periodTotals.cashFlow)}
                tone={periodTotals.cashFlow >= 0 ? "info" : "danger"}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Estado de resultados mensual
            </h2>

            <EnterpriseReportTable
              rows={data.profitLoss}
              emptyMessage="No hay resultados para el periodo seleccionado."
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
              emptyMessage="No hay movimientos de caja o bancos para el periodo seleccionado."
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
