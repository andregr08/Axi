"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export interface EnterpriseColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
}

interface EnterpriseReportTableProps {
  columns: EnterpriseColumn[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
  sortBy?: string;
  ascending?: boolean;
  onSortChange?: (column: string) => void;
}

export default function EnterpriseReportTable({
  columns,
  rows,
  emptyMessage = "No hay información disponible.",
  sortBy,
  ascending = true,
  onSortChange,
}: EnterpriseReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => {
                const isActiveSort = sortBy === column.key;
                const isSortable = Boolean(column.sortable && onSortChange);

                const alignmentClass =
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left";

                return (
                  <th
                    key={column.key}
                    aria-sort={
                      isActiveSort
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={[
                      "whitespace-nowrap px-4 py-3 font-semibold text-slate-600",
                      alignmentClass,
                    ].join(" ")}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange?.(column.key)}
                        className={[
                          "inline-flex w-full items-center gap-1.5 rounded-md outline-none transition hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500",
                          column.align === "right"
                            ? "justify-end"
                            : column.align === "center"
                              ? "justify-center"
                              : "justify-start",
                        ].join(" ")}
                      >
                        <span>{column.label}</span>

                        {isActiveSort ? (
                          ascending ? (
                            <ArrowUp
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <ArrowDown
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )
                        ) : (
                          <ArrowUpDown
                            className="h-3.5 w-3.5 text-slate-400"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr
                key={String(
                  row.id ??
                    row.transaction_id ??
                    row.account_id ??
                    row.period_start ??
                    rowIndex,
                )}
                className="hover:bg-slate-50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      "whitespace-nowrap px-4 py-3 text-slate-700",
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left",
                    ].join(" ")}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
