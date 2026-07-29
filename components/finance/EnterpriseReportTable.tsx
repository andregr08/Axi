"use client";

import type { ReactNode } from "react";

export interface EnterpriseColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  align?: "left" | "center" | "right";
}

interface EnterpriseReportTableProps {
  columns: EnterpriseColumn[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
}

export default function EnterpriseReportTable({
  columns,
  rows,
  emptyMessage = "No hay información disponible.",
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
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={[
                    "whitespace-nowrap px-4 py-3 font-semibold text-slate-600",
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left",
                  ].join(" ")}
                >
                  {column.label}
                </th>
              ))}
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
