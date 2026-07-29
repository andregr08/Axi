"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import {
  formatCurrency,
  formatDateTime,
  getFinancialView,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

export default function FinancialAccountsPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      setRows(
        await getFinancialView("finance_trial_balance_v1", {
          orderBy: "account_code",
          ascending: true,
          limit: 500,
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la balanza.",
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
      type === "all"
        ? rows
        : rows.filter((row) => row.account_type === type),
    [rows, type],
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Contabilidad</p>
        <h1 className="text-2xl font-bold text-slate-900">
          Cuentas contables
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Catálogo y balanza de comprobación de AXI.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
        >
          <option value="all">Todas las cuentas</option>
          <option value="asset">Activos</option>
          <option value="liability">Pasivos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>

        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando cuentas…</p>}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <EnterpriseReportTable
          rows={filteredRows}
          columns={[
            { key: "account_code", label: "Código" },
            { key: "account_name", label: "Cuenta" },
            { key: "account_type", label: "Tipo" },
            {
              key: "total_debits",
              label: "Debe",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "total_credits",
              label: "Haber",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "balance",
              label: "Saldo",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "last_movement_at",
              label: "Último movimiento",
              render: formatDateTime,
            },
          ]}
        />
      )}
    </div>
  );
}
