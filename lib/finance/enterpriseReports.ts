import { supabase } from "@/lib/supabaseClient";

export type FinancialRow = Record<string, unknown>;

export async function getFinancialView(
  viewName: string,
  options?: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
  },
): Promise<FinancialRow[]> {
  const limit = options?.limit ?? 500;

  let query = supabase.from(viewName).select("*").limit(limit);

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
  const numericValue =
    typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function formatNumber(value: unknown): string {
  const numericValue =
    typeof value === "number" ? value : Number(value ?? 0);

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
