import { supabase } from "@/lib/supabaseClient";

export type FinancialRow = Record<string, unknown>;

export interface FinancialFilter {
  column: string;
  operator?: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in" | "is";
  value: unknown;
}

export interface FinancialViewOptions {
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
  filters?: FinancialFilter[];
}

export interface CsvColumn {
  key: string;
  label: string;
  format?: (value: unknown, row: FinancialRow) => string;
}

export async function getFinancialView(
  viewName: string,
  options?: FinancialViewOptions,
): Promise<FinancialRow[]> {
  const limit = options?.limit ?? 500;

  let query = supabase.from(viewName).select("*").limit(limit);

  for (const filter of options?.filters ?? []) {
    const operator = filter.operator ?? "eq";

    if (operator === "eq") {
      query = query.eq(filter.column, filter.value);
    } else if (operator === "neq") {
      query = query.neq(filter.column, filter.value);
    } else if (operator === "gte") {
      query = query.gte(filter.column, filter.value);
    } else if (operator === "lte") {
      query = query.lte(filter.column, filter.value);
    } else if (operator === "gt") {
      query = query.gt(filter.column, filter.value);
    } else if (operator === "lt") {
      query = query.lt(filter.column, filter.value);
    } else if (operator === "in") {
      query = query.in(
        filter.column,
        Array.isArray(filter.value) ? filter.value : [filter.value],
      );
    } else if (operator === "is") {
      query = query.is(filter.column, filter.value);
    }
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? false,
    });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FinancialRow[];
}

export function formatCurrency(value: unknown): string {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function formatNumber(value: unknown): string {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("es-US", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function formatDate(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export function formatDateTime(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export function getMexicoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getMexicoMonthStart(): string {
  const currentDate = getMexicoToday();

  return `${currentDate.slice(0, 8)}01`;
}

export function getMexicoYearStart(): string {
  return `${getMexicoToday().slice(0, 4)}-01-01`;
}

export function normalizeSearchValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function sumFinancialColumn(
  rows: FinancialRow[],
  column: string,
): number {
  return rows.reduce((total, row) => {
    const value = Number(row[column] ?? 0);

    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function exportFinancialCsv({
  rows,
  columns,
  filename,
}: {
  rows: FinancialRow[];
  columns: CsvColumn[];
  filename: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  if (rows.length === 0) {
    throw new Error("No hay información para exportar.");
  }

  const header = columns
    .map((column) => escapeCsvValue(column.label))
    .join(",");

  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.format
          ? column.format(row[column.key], row)
          : row[column.key];

        return escapeCsvValue(value);
      })
      .join(","),
  );

  const csv = `\uFEFF${[header, ...body].join("\n")}`;

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export function createFinancialFilename(
  reportName: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const normalizedName = reportName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const period =
    dateFrom && dateTo ? `${dateFrom}_a_${dateTo}` : getMexicoToday();

  return `axi-${normalizedName}-${period}.csv`;
}
