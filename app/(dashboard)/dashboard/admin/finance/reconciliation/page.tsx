"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import {
  formatCurrency,
  formatDateTime,
  getFinancialView,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

export default function FinanceReconciliationPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      setRows(
        await getFinancialView("finance_payment_reconciliation_v2", {
          orderBy: "paid_at",
          limit: 1000,
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la conciliación.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(
    () =>
      status === "all"
        ? rows
        : rows.filter((row) => row.reconciliation_status === status),
    [rows, status],
  );

  const pendingCount = rows.filter(
    (row) =>
      row.reconciliation_status !== "reconciled" &&
      row.reconciliation_status !== "not_applicable",
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Control financiero</p>
        <h1 className="text-2xl font-bold text-slate-900">
          Conciliación de pagos
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Compara pagos, transacciones financieras y movimientos de wallet.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">
          Operaciones con diferencias
        </p>
        <p className="mt-1 text-3xl font-bold text-slate-900">
          {pendingCount}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="reconciled">Conciliados</option>
          <option value="missing_financial_transaction">
            Sin transacción financiera
          </option>
          <option value="financial_transaction_not_posted">
            Transacción no contabilizada
          </option>
          <option value="missing_driver_wallet_transaction">
            Sin movimiento de wallet
          </option>
          <option value="not_applicable">No aplica</option>
        </select>

        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Cargando conciliación…</p>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <EnterpriseReportTable
          rows={filteredRows}
          columns={[
            {
              key: "paid_at",
              label: "Fecha",
              render: formatDateTime,
            },
            { key: "payment_transaction_id", label: "Pago" },
            { key: "method", label: "Método" },
            {
              key: "total_amount",
              label: "Total",
              align: "right",
              render: formatCurrency,
            },
            { key: "financial_status", label: "Estado contable" },
            {
              key: "reconciliation_status",
              label: "Conciliación",
            },
          ]}
        />
      )}
    </div>
  );
}
