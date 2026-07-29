"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import FinanceReportToolbar from "@/components/finance/FinanceReportToolbar";

import {
  createFinancialFilename,
  exportFinancialCsv,
  formatCurrency,
  formatDateTime,
  getFinancialView,
  getMexicoMonthStart,
  getMexicoToday,
  normalizeSearchValue,
  sumFinancialColumn,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

export default function GeneralLedgerPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(getMexicoMonthStart());
  const [dateTo, setDateTo] = useState(getMexicoToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = [];

      if (dateFrom) {
        filters.push({
          column: "effective_at",
          operator: "gte" as const,
          value: `${dateFrom}T00:00:00-06:00`,
        });
      }

      if (dateTo) {
        filters.push({
          column: "effective_at",
          operator: "lte" as const,
          value: `${dateTo}T23:59:59.999-06:00`,
        });
      }

      const result = await getFinancialView("finance_general_ledger_v1", {
        orderBy: "effective_at",
        limit: 5000,
        filters,
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
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const normalized = normalizeSearchValue(search);

    if (!normalized) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.ledger_folio,
        row.transaction_type,
        row.transaction_description,
        row.account_code,
        row.account_name,
      ].some((value) => normalizeSearchValue(value).includes(normalized)),
    );
  }, [rows, search]);

  const totalDebits = sumFinancialColumn(filteredRows, "debit");

  const totalCredits = sumFinancialColumn(filteredRows, "credit");

  const difference = totalDebits - totalCredits;

  function handleExport() {
    try {
      exportFinancialCsv({
        filename: createFinancialFilename("libro-mayor", dateFrom, dateTo),
        rows: filteredRows,
        columns: [
          {
            key: "ledger_folio",
            label: "Folio",
          },
          {
            key: "effective_at",
            label: "Fecha",
            format: formatDateTime,
          },
          {
            key: "transaction_type",
            label: "Tipo de transacción",
          },
          {
            key: "transaction_description",
            label: "Descripción",
          },
          {
            key: "account_code",
            label: "Código de cuenta",
          },
          {
            key: "account_name",
            label: "Cuenta",
          },
          {
            key: "debit",
            label: "Debe",
          },
          {
            key: "credit",
            label: "Haber",
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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Contabilidad</p>

        <h1 className="text-2xl font-bold text-slate-900">Libro mayor</h1>

        <p className="mt-1 text-sm text-slate-500">
          Todos los cargos y abonos registrados en el ledger de AXI.
        </p>
      </header>

      <FinanceReportToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar folio, cuenta o descripción"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onRefresh={() => void loadData()}
        onExport={handleExport}
        loading={loading}
        exportDisabled={filteredRows.length === 0}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Movimientos" value={String(filteredRows.length)} />

        <MetricCard label="Total debe" value={formatCurrency(totalDebits)} />

        <MetricCard label="Total haber" value={formatCurrency(totalCredits)} />

        <MetricCard
          label="Diferencia"
          value={formatCurrency(difference)}
          detail={
            Math.abs(difference) < 0.005
              ? "Movimientos balanceados"
              : "Requiere revisión"
          }
          warning={Math.abs(difference) >= 0.005}
        />
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Cargando movimientos…</p>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <EnterpriseReportTable
          rows={filteredRows}
          emptyMessage="No hay movimientos para el periodo seleccionado."
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

function MetricCard({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5",
        warning ? "border-red-200 bg-red-50" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <p
        className={warning ? "text-sm text-red-700" : "text-sm text-slate-500"}
      >
        {label}
      </p>

      <p
        className={[
          "mt-2 text-2xl font-bold",
          warning ? "text-red-900" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>

      {detail && (
        <p
          className={[
            "mt-1 text-xs",
            warning ? "text-red-700" : "text-slate-500",
          ].join(" ")}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
