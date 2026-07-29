"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import FinanceReportToolbar from "@/components/finance/FinanceReportToolbar";
import {
  EnterpriseMetricCard,
  EnterprisePageHeader,
} from "@/components/enterprise";

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
      <EnterprisePageHeader
        eyebrow="Contabilidad"
        title="Libro mayor"
        description="Todos los cargos y abonos registrados en el ledger de AXI."
      />

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
        <EnterpriseMetricCard
          label="Movimientos"
          value={String(filteredRows.length)}
        />

        <EnterpriseMetricCard
          label="Total debe"
          value={formatCurrency(totalDebits)}
        />

        <EnterpriseMetricCard
          label="Total haber"
          value={formatCurrency(totalCredits)}
        />

        <EnterpriseMetricCard
          label="Diferencia"
          value={formatCurrency(difference)}
          detail={
            Math.abs(difference) < 0.005
              ? "Movimientos balanceados"
              : "Requiere revisión"
          }
          tone={Math.abs(difference) < 0.005 ? "success" : "danger"}
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
