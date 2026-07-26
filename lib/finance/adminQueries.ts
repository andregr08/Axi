import { supabase } from "@/lib/supabaseClient";

type FinanceDirectoryEntry = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type FinanceRow = Record<string, unknown>;

function getUniqueIds(
  values: Array<string | null | undefined>
) {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
    ),
  ];
}

async function getFinanceUserDirectory({
  userIds,
  role,
}: {
  userIds?: string[];
  role?: string;
} = {}) {
  const { data, error } = await supabase.rpc(
    "finance_get_user_directory",
    {
      requested_user_ids:
        userIds && userIds.length > 0 ? userIds : null,
      requested_role: role ?? null,
    }
  );

  if (error) throw error;

  return (data ?? []) as FinanceDirectoryEntry[];
}

function createDirectoryMap(
  directory: FinanceDirectoryEntry[]
) {
  return new Map(
    directory.map((profile) => [profile.id, profile])
  );
}

async function attachProfiles<
  T extends FinanceRow
>(
  rows: T[],
  userIdKey: string
) {
  const userIds = getUniqueIds(
    rows.map((row) => {
      const value = row[userIdKey];

      return typeof value === "string" ? value : null;
    })
  );

  if (userIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      profiles: null,
    }));
  }

  const directory =
    await getFinanceUserDirectory({ userIds });

  const directoryById =
    createDirectoryMap(directory);

  return rows.map((row) => {
    const value = row[userIdKey];

    const userId =
      typeof value === "string" ? value : "";

    return {
      ...row,
      profiles:
        directoryById.get(userId) ?? null,
    };
  });
}

export async function getFinanceDashboard() {
  const { data, error } = await supabase
    .from("finance_dashboard_summary")
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function getWallets() {
  const { data, error } = await supabase
    .from("driver_wallets")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return attachProfiles(
    (data ?? []) as FinanceRow[],
    "driver_id"
  );
}

export async function getFinanceTransactions(
  limit = 100
) {
  const { data, error } = await supabase
    .from("finance_transactions_view")
    .select("*")
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

export async function getPendingWithdrawals() {
  const { data, error } = await supabase
    .from("withdraw_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at");

  if (error) throw error;

  return attachProfiles(
    (data ?? []) as FinanceRow[],
    "driver_id"
  );
}

export async function getPendingRefunds() {
  const { data, error } = await supabase
    .from("refund_requests")
    .select(`
      *,
      trips(
        id,
        origin_address,
        destination_address
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return attachProfiles(
    (data ?? []) as FinanceRow[],
    "passenger_id"
  );
}

export async function getDrivers() {
  return getFinanceUserDirectory({
    role: "driver",
  });
}

export async function getFinanceAuditLogs() {
  const { data, error } = await supabase
    .from("finance_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return data ?? [];
}

export async function getCashDebts() {
  const { data, error } = await supabase
    .from("cash_debts_view")
    .select("*")
    .order("cash_debt", { ascending: false });

  if (error) throw error;

  return data ?? [];
}
