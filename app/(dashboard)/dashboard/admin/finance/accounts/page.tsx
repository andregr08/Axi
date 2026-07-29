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
  getPaginatedFinancialView,
  sumFinancialColumn,
  type FinancialFilter,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

const EXPORT_LIMIT = 50000;

const SEARCH_COLUMNS = ["account_code", "account_name", "account_type"];

const accountTypeLabels: Record<string, string> = {
  asset: "Activo",
  liability: "Pasivo",
  equity: "Capital",
  income: "Ingreso",
  expense: "Gasto",
};

export default function FinancialAccountsPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
    if (type === "all") {
      return [];
    }

    return [
      {
        column: "account_type",
        operator: "eq",
        value: type,
      },
    ];
  }, [type]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getPaginatedFinancialView(
        "finance_trial_balance_v1",
        {
          page,
          pageSize,
          orderBy: "account_code",
          ascending: true,
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
          : "No fue posible cargar la balanza.",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page, pageSize]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalDebits = sumFinancialColumn(rows, "total_debits");
  const totalCredits = sumFinancialColumn(rows, "total_credits");
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.005;

  async function handleExport() {
    try {
      setExporting(true);
      setError(null);

      if (totalRows > EXPORT_LIMIT) {
        throw new Error(
          `La exportación supera el límite de ${EXPORT_LIMIT.toLocaleString(
            "es-MX",
          )} cuentas. Aplica un filtro o una búsqueda más específica.`,
        );
      }

      const exportRows = await getFinancialView("finance_trial_balance_v1", {
        orderBy: "account_code",
        ascending: true,
        limit: EXPORT_LIMIT,
        filters,
        search: debouncedSearch,
        searchColumns: SEARCH_COLUMNS,
      });

      exportFinancialCsv({
        filename: createFinancialFilename("balanza-de-comprobacion"),
        rows: exportRows,
        columns: [
          {
            key: "account_code",
            label: "Código",
          },
          {
            key: "account_name",
            label: "Cuenta",
          },
          {
            key: "account_type",
            label: "Tipo",
            format: (value) =>
              accountTypeLabels[String(value)] ?? String(value ?? ""),
          },
          {
            key: "total_debits",
            label: "Debe",
          },
          {
            key: "total_credits",
            label: "Haber",
          },
          {
            key: "balance",
            label: "Saldo",
          },
          {
            key: "last_movement_at",
            label: "Último movimiento",
            format: formatDateTime,
          },
        ],
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar la balanza.",
      );
    } finally {
      setExporting(false);
    }
  }

  function handleTypeChange(value: string) {
    setType(value);
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
        title="Balanza de comprobación"
        description="Catálogo, cargos, abonos y saldos de las cuentas contables de AXI."
      />

      <FinanceReportToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código o nombre de cuenta"
        onRefresh={() => void loadData()}
        onExport={() => void handleExport()}
        loading={loading || exporting}
        exportDisabled={totalRows === 0}
      >
        <select
          value={type}
          onChange={(event) => handleTypeChange(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
          aria-label="Tipo de cuenta"
        >
          <option value="all">Todas las cuentas</option>
          <option value="asset">Activos</option>
          <option value="liability">Pasivos</option>
          <option value="equity">Capital</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>

        <p className="self-center text-sm text-slate-500">
          {totalRows} cuentas encontradas
        </p>
      </FinanceReportToolbar>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EnterpriseMetricCard
          label="Cuentas encontradas"
          value={String(totalRows)}
          detail="Total según los filtros actuales"
          tone="info"
        />

        <EnterpriseMetricCard
          label="Debe en página"
          value={formatCurrency(totalDebits)}
          detail={`${rows.length} cuentas visibles`}
          tone="default"
        />

        <EnterpriseMetricCard
          label="Haber en página"
          value={formatCurrency(totalCredits)}
          detail={`${rows.length} cuentas visibles`}
          tone="default"
        />

        <EnterpriseMetricCard
          label="Diferencia en página"
          value={formatCurrency(difference)}
          detail={isBalanced ? "Página cuadrada" : "Movimientos parciales"}
          tone={isBalanced ? "success" : "warning"}
        />
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Cargando cuentas…
        </div>
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
            emptyMessage="No hay cuentas que coincidan con los filtros."
            columns={[
              {
                key: "account_code",
                label: "Código",
              },
              {
                key: "account_name",
                label: "Cuenta",
              },
              {
                key: "account_type",
                label: "Tipo",
                render: (value) =>
                  accountTypeLabels[String(value)] ?? String(value ?? "—"),
              },
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
