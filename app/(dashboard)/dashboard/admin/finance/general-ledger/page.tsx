"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EnterpriseMetricCard,
  EnterprisePageHeader,
} from "@/components/enterprise";
import EnterprisePagination from "@/components/enterprise/EnterprisePagination";
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
  getPaginatedFinancialView,
  sumFinancialColumn,
  type FinancialFilter,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

const SEARCH_COLUMNS = [
  "ledger_folio",
  "transaction_type",
  "transaction_description",
  "account_code",
  "account_name",
];

const EXPORT_LIMIT = 50000;

export default function GeneralLedgerPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(getMexicoMonthStart());
  const [dateTo, setDateTo] = useState(getMexicoToday());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const filters = useMemo<FinancialFilter[]>(() => {
    const nextFilters: FinancialFilter[] = [];

    if (dateFrom) {
      nextFilters.push({
        column: "effective_at",
        operator: "gte",
        value: `${dateFrom}T00:00:00-06:00`,
      });
    }

    if (dateTo) {
      nextFilters.push({
        column: "effective_at",
        operator: "lte",
        value: `${dateTo}T23:59:59.999-06:00`,
      });
    }

    return nextFilters;
  }, [dateFrom, dateTo]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getPaginatedFinancialView(
        "finance_general_ledger_v1",
        {
          page,
          pageSize,
          orderBy: "effective_at",
          ascending: false,
          filters,
          search: debouncedSearch,
          searchColumns: SEARCH_COLUMNS,
        },
      );

      if (page > result.totalPages) {
        setPage(result.totalPages);
        return;
      }

      setRows(result.rows);
      setTotalRows(result.totalRows);
    } catch (loadError) {
      setRows([]);
      setTotalRows(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar el libro mayor.",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page, pageSize]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalDebits = sumFinancialColumn(rows, "debit");
  const totalCredits = sumFinancialColumn(rows, "credit");
  const difference = totalDebits - totalCredits;

  async function handleExport() {
    try {
      setExporting(true);
      setError(null);

      const exportRows = await getFinancialView("finance_general_ledger_v1", {
        orderBy: "effective_at",
        ascending: false,
        limit: EXPORT_LIMIT,
        filters,
        search: debouncedSearch,
        searchColumns: SEARCH_COLUMNS,
      });

      if (totalRows > EXPORT_LIMIT) {
        throw new Error(
          `La exportación supera el límite de ${EXPORT_LIMIT.toLocaleString(
            "es-MX",
          )} registros. Reduce el periodo o aplica una búsqueda.`,
        );
      }

      exportFinancialCsv({
        filename: createFinancialFilename("libro-mayor", dateFrom, dateTo),
        rows: exportRows,
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
    } finally {
      setExporting(false);
    }
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    setPage(1);
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    setPage(1);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
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
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
        onRefresh={() => void loadData()}
        onExport={() => void handleExport()}
        loading={loading || exporting}
        exportDisabled={totalRows === 0}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EnterpriseMetricCard
          label="Registros encontrados"
          value={String(totalRows)}
          detail="Total según filtros actuales"
          tone="info"
        />

        <EnterpriseMetricCard
          label="Debe en página"
          value={formatCurrency(totalDebits)}
          detail={`${rows.length} movimientos visibles`}
        />

        <EnterpriseMetricCard
          label="Haber en página"
          value={formatCurrency(totalCredits)}
          detail={`${rows.length} movimientos visibles`}
        />

        <EnterpriseMetricCard
          label="Diferencia en página"
          value={formatCurrency(difference)}
          detail={
            Math.abs(difference) < 0.005
              ? "Página balanceada"
              : "La página contiene movimientos parciales"
          }
          tone={Math.abs(difference) < 0.005 ? "success" : "warning"}
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
        <div className="space-y-4">
          <EnterpriseReportTable
            rows={rows}
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

          <EnterprisePagination
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
