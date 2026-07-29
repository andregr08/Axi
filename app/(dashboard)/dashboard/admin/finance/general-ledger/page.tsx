"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import {
  formatCurrency,
  formatDateTime,
  getFinancialView,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

export default function GeneralLedgerPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getFinancialView("finance_general_ledger_v1", {
        orderBy: "effective_at",
        limit: 1000,
      });

      setRows(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar el libro mayor.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) return rows;

    return rows.filter((row) =>
      [
        row.ledger_folio,
        row.transaction_type,
        row.transaction_description,
        row.account_code,
        row.account_name,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(normalized)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Contabilidad</p>
        <h1 className="text-2xl font-bold text-slate-900">Libro mayor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Todos los cargos y abonos registrados en el ledger de AXI.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar folio, cuenta o descripción"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando movimientos…</p>}

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
              key: "ledger_folio",
              label: "Folio",
            },
            {
              key: "effective_at",
              label: "Fecha",
              render: formatDateTime,
            },
            {
              key: "transaction_type",
              label: "Tipo",
            },
            {
              key: "account_code",
              label: "Cuenta",
            },
            {
              key: "account_name",
              label: "Nombre",
            },
            {
              key: "debit",
              label: "Debe",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "credit",
              label: "Haber",
              align: "right",
              render: formatCurrency,
            },
          ]}
        />
      )}
    </div>
  );
}
