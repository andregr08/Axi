"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EnterpriseMetricCard,
  EnterprisePageHeader,
} from "@/components/enterprise";
import EnterprisePagination from "@/components/enterprise/EnterprisePagination";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";

import {
  formatCurrency,
  formatDateTime,
  getPaginatedFinancialView,
  type FinancialFilter,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

const reconciliationLabels: Record<string, string> = {
  reconciled: "Conciliado",
  missing_financial_transaction: "Sin transacción financiera",
  financial_transaction_not_posted: "Transacción no contabilizada",
  missing_driver_wallet_transaction: "Sin movimiento de wallet",
  not_applicable: "No aplica",
};

export default function FinanceReconciliationPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [status, setStatus] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo<FinancialFilter[]>(() => {
    if (status === "all") {
      return [];
    }

    return [
      {
        column: "reconciliation_status",
        operator: "eq",
        value: status,
      },
    ];
  }, [status]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getPaginatedFinancialView(
        "finance_payment_reconciliation_v2",
        {
          page,
          pageSize,
          orderBy: "paid_at",
          ascending: false,
          filters,
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
          : "No fue posible cargar la conciliación.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const reconciledCount = rows.filter(
    (row) => row.reconciliation_status === "reconciled",
  ).length;

  const notApplicableCount = rows.filter(
    (row) => row.reconciliation_status === "not_applicable",
  ).length;

  const pendingCount = rows.filter(
    (row) =>
      row.reconciliation_status !== "reconciled" &&
      row.reconciliation_status !== "not_applicable",
  ).length;

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        eyebrow="Control financiero"
        title="Conciliación de pagos"
        description="Compara pagos, transacciones financieras y movimientos de wallet."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EnterpriseMetricCard
          label="Operaciones encontradas"
          value={String(totalRows)}
          detail="Total según el filtro actual"
          tone="info"
        />

        <EnterpriseMetricCard
          label="Conciliadas en página"
          value={String(reconciledCount)}
          detail={`${rows.length} operaciones visibles`}
          tone="success"
        />

        <EnterpriseMetricCard
          label="Con diferencias en página"
          value={String(pendingCount)}
          detail={`${rows.length} operaciones visibles`}
          tone={pendingCount > 0 ? "danger" : "success"}
        />

        <EnterpriseMetricCard
          label="No aplican en página"
          value={String(notApplicableCount)}
          detail={`${rows.length} operaciones visibles`}
          tone="default"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <select
          value={status}
          onChange={(event) => handleStatusChange(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
          aria-label="Estado de conciliación"
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
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>

        <p className="text-sm text-slate-500 sm:ml-auto">
          {totalRows} operaciones encontradas
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Cargando conciliación…
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
            emptyMessage="No hay operaciones que coincidan con el filtro seleccionado."
            columns={[
              {
                key: "paid_at",
                label: "Fecha",
                render: formatDateTime,
              },
              {
                key: "payment_transaction_id",
                label: "Pago",
              },
              {
                key: "method",
                label: "Método",
              },
              {
                key: "total_amount",
                label: "Total",
                align: "right",
                render: formatCurrency,
              },
              {
                key: "financial_status",
                label: "Estado contable",
              },
              {
                key: "reconciliation_status",
                label: "Conciliación",
                render: (value) =>
                  reconciliationLabels[String(value)] ?? String(value ?? "—"),
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
