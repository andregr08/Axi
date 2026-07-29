"use client";

import { CalendarDays, Download, RefreshCw, Search } from "lucide-react";

interface FinanceReportToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;

  onRefresh: () => void;
  onExport: () => void;

  loading?: boolean;
  exportDisabled?: boolean;
  children?: React.ReactNode;
}

export default function FinanceReportToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar en el reporte",
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onRefresh,
  onExport,
  loading = false,
  exportDisabled = false,
  children,
}: FinanceReportToolbarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_repeat(2,minmax(150px,auto))_auto_auto]">
        {onSearchChange ? (
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              value={search ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        ) : (
          <div />
        )}

        {onDateFromChange && (
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              type="date"
              value={dateFrom ?? ""}
              onChange={(event) => onDateFromChange(event.target.value)}
              aria-label="Fecha inicial"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        )}

        {onDateToChange && (
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              type="date"
              value={dateTo ?? ""}
              onChange={(event) => onDateToChange(event.target.value)}
              aria-label="Fecha final"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        )}

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Actualizar
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled || loading}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {children && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
