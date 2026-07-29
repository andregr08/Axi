"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, RefreshCw, Search } from "lucide-react";

import {
  getJournalTransactions,
  type JournalTransaction,
} from "@/lib/finance/journal";

const statusLabels: Record<string, string> = {
  posted: "Publicada",
  reversed: "Revertida",
  pending: "Pendiente",
};

const statusClasses: Record<string, string> = {
  posted: "bg-emerald-50 text-emerald-700",
  reversed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
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
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getJournalTransactions({
        status,
        dateFrom,
        dateTo,
        limit: 1000,
      });

      setRows(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el libro diario.",
      );
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.ledger_folio,
        row.transaction_type,
        row.description,
        row.provider,
        row.provider_reference,
        row.trip_id,
        row.payment_id,
        row.refund_id,
        row.withdrawal_id,
      ]
        .map((item) => String(item ?? "").toLowerCase())
        .some((item) => item.includes(value)),
    );
  }, [rows, search]);

  const postedCount = rows.filter((row) => row.status === "posted").length;

  const reversedCount = rows.filter((row) => row.status === "reversed").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Contabilidad</p>

          <h1 className="text-2xl font-bold text-slate-900">Libro diario</h1>

          <p className="mt-1 text-sm text-slate-500">
            Pólizas contables generadas por las operaciones de AXI.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Actualizar
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Pólizas del periodo</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {rows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">Publicadas</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">
            {postedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">Revertidas</p>
          <p className="mt-2 text-3xl font-bold text-red-900">
            {reversedCount}
          </p>
        </div>
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
            onChange={(event) => setStatus(event.target.value)}
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
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            aria-label="Fecha inicial"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
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
      ) : filteredRows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <BookOpenText className="mb-3 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-900">
            No hay pólizas en este periodo
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cambia las fechas o los filtros de búsqueda.
          </p>
        </div>
      ) : (
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
                {filteredRows.map((row) => (
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
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          statusClasses[row.status] ??
                            "bg-slate-100 text-slate-700",
                        ].join(" ")}
                      >
                        {statusLabels[row.status] ?? row.status}
                      </span>
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
      )}
    </div>
  );
}
