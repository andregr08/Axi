"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpenText, Download, RefreshCw, Search } from "lucide-react";

import {
  EnterpriseEmptyState,
  EnterpriseMetricCard,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
} from "@/components/enterprise";
import EnterprisePagination from "@/components/enterprise/EnterprisePagination";

import {
  createFinancialFilename,
  exportFinancialCsv,
} from "@/lib/finance/enterpriseReports";

import {
  getJournalTransactions,
  getPaginatedJournalTransactions,
  type JournalTransaction,
} from "@/lib/finance/journal";

const EXPORT_LIMIT = 50000;

const statusLabels: Record<string, string> = {
  posted: "Publicada",
  reversed: "Revertida",
  pending: "Pendiente",
};

function getStatusTone(
  status: string,
): "success" | "danger" | "warning" | "neutral" {
  if (status === "posted") return "success";
  if (status === "reversed") return "danger";
  if (status === "pending") return "warning";

  return "neutral";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function firstDayOfMonth() {
  const date = today();

  return `${date.slice(0, 8)}01`;
}

export default function FinanceJournalPage() {
  const [rows, setRows] = useState<JournalTransaction[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getPaginatedJournalTransactions({
        search: debouncedSearch,
        status,
        dateFrom,
        dateTo,
        page,
        pageSize,
      });

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
          : "No se pudo cargar el libro diario.",
      );
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, debouncedSearch, page, pageSize, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const postedCount = rows.filter((row) => row.status === "posted").length;
  const reversedCount = rows.filter((row) => row.status === "reversed").length;

  async function handleExport() {
    try {
      setExporting(true);
      setError("");

      if (totalRows > EXPORT_LIMIT) {
        throw new Error(
          `La exportación supera el límite de ${EXPORT_LIMIT.toLocaleString(
            "es-MX",
          )} pólizas. Reduce el periodo o aplica filtros.`,
        );
      }

      const exportRows = await getJournalTransactions({
        search: debouncedSearch,
        status,
        dateFrom,
        dateTo,
        limit: EXPORT_LIMIT,
      });

      exportFinancialCsv({
        filename: createFinancialFilename("libro-diario", dateFrom, dateTo),
        rows: exportRows.map((row) => ({
          id: row.id,
          ledger_folio: row.ledger_folio,
          effective_at: row.effective_at,
          transaction_type: row.transaction_type,
          description: row.description,
          status: row.status,
          trip_id: row.trip_id,
          payment_id: row.payment_id,
          refund_id: row.refund_id,
          withdrawal_id: row.withdrawal_id,
          provider: row.provider,
          provider_reference: row.provider_reference,
          created_at: row.created_at,
          posted_at: row.posted_at,
        })),
        columns: [
          {
            key: "ledger_folio",
            label: "Folio",
          },
          {
            key: "effective_at",
            label: "Fecha efectiva",
          },
          {
            key: "transaction_type",
            label: "Tipo de transacción",
          },
          {
            key: "description",
            label: "Descripción",
          },
          {
            key: "status",
            label: "Estado",
          },
          {
            key: "trip_id",
            label: "Viaje",
          },
          {
            key: "payment_id",
            label: "Pago",
          },
          {
            key: "refund_id",
            label: "Reembolso",
          },
          {
            key: "withdrawal_id",
            label: "Retiro",
          },
          {
            key: "provider",
            label: "Proveedor",
          },
          {
            key: "provider_reference",
            label: "Referencia proveedor",
          },
          {
            key: "created_at",
            label: "Fecha de creación",
          },
          {
            key: "posted_at",
            label: "Fecha de contabilización",
          },
        ],
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar el libro diario.",
      );
    } finally {
      setExporting(false);
    }
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
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
        title="Libro diario"
        description="Pólizas contables generadas por las operaciones de AXI."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || exporting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={loading || exporting || totalRows === 0}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportando…" : "Exportar CSV"}
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <EnterpriseMetricCard
          label="Pólizas encontradas"
          value={String(totalRows)}
          detail="Total según los filtros actuales"
          tone="info"
        />

        <EnterpriseMetricCard
          label="Publicadas en página"
          value={String(postedCount)}
          detail={`${rows.length} pólizas visibles`}
          tone="success"
        />

        <EnterpriseMetricCard
          label="Revertidas en página"
          value={String(reversedCount)}
          detail={`${rows.length} pólizas visibles`}
          tone={reversedCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar folio, tipo, referencia o UUID"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="posted">Publicadas</option>
            <option value="reversed">Revertidas</option>
            <option value="pending">Pendientes</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => handleDateFromChange(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            aria-label="Fecha inicial"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => handleDateToChange(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            aria-label="Fecha final"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <EnterpriseEmptyState
          title="No hay pólizas en este periodo"
          description="Cambia las fechas o los filtros de búsqueda."
          icon={<BookOpenText className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Folio
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Fecha
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Tipo
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Descripción
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Estado
                    </th>

                    <th className="px-4 py-3 text-right font-semibold text-slate-600">
                      Acción
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                        {row.ledger_folio ?? "Sin folio"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {dateTime(row.effective_at)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {row.transaction_type}
                      </td>

                      <td className="max-w-md px-4 py-3 text-slate-600">
                        <p className="line-clamp-2">
                          {row.description ?? "Sin descripción"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <EnterpriseStatusBadge tone={getStatusTone(row.status)}>
                          {statusLabels[row.status] ?? row.status}
                        </EnterpriseStatusBadge>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/admin/finance/transactions/${row.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Ver póliza
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
