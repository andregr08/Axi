import { supabase } from "@/lib/supabaseClient";

export type JournalTransaction = {
  id: string;
  ledger_folio: string | null;
  transaction_type: string;
  status: string;
  currency: string;
  description: string | null;
  trip_id: string | null;
  payment_id: string | null;
  refund_id: string | null;
  withdrawal_id: string | null;
  wallet_transaction_id: string | null;
  passenger_wallet_transaction_id: string | null;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string | null;
  reversal_of_transaction_id: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  effective_at: string;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  transaction_id: string;
  account_id: string;
  entry_number: number;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  description: string | null;
  user_id: string | null;
  driver_id: string | null;
  passenger_id: string | null;
  trip_id: string | null;
  payment_id: string | null;
  refund_id: string | null;
  withdrawal_id: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  financial_accounts:
    | {
        id: string;
        code: string;
        name: string;
        account_type: string;
        normal_balance: string;
      }
    | Array<{
        id: string;
        code: string;
        name: string;
        account_type: string;
        normal_balance: string;
      }>
    | null;
};

export type JournalTransactionDetail = {
  transaction: JournalTransaction;
  entries: JournalEntry[];
  reversal: JournalTransaction | null;
  original: JournalTransaction | null;
};

export type JournalFilters = {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type PaginatedJournalFilters = Omit<JournalFilters, "limit"> & {
  page?: number;
  pageSize?: number;
};

export type PaginatedJournalResult = {
  rows: JournalTransaction[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getJournalTransactions(
  filters: JournalFilters = {},
): Promise<JournalTransaction[]> {
  let query = supabase
    .from("financial_transactions")
    .select(
      `
        id,
        ledger_folio,
        transaction_type,
        status,
        currency,
        description,
        trip_id,
        payment_id,
        refund_id,
        withdrawal_id,
        wallet_transaction_id,
        passenger_wallet_transaction_id,
        provider,
        provider_reference,
        idempotency_key,
        reversal_of_transaction_id,
        created_by,
        metadata,
        effective_at,
        posted_at,
        created_at,
        updated_at
      `,
    )
    .order("effective_at", { ascending: false })
    .limit(filters.limit ?? 500);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.dateFrom) {
    query = query.gte("effective_at", `${filters.dateFrom}T00:00:00-06:00`);
  }

  if (filters.dateTo) {
    query = query.lte("effective_at", `${filters.dateTo}T23:59:59.999-06:00`);
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim().replaceAll(",", " ");

    query = query.or(
      [
        `ledger_folio.ilike.%${search}%`,
        `transaction_type.ilike.%${search}%`,
        `description.ilike.%${search}%`,
        `provider_reference.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as JournalTransaction[];
}

function normalizeJournalSearch(value: string): string {
  return value.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}

function applyJournalFilters<T>(query: T, filters: JournalFilters): T {
  let nextQuery = query as any;

  if (filters.status && filters.status !== "all") {
    nextQuery = nextQuery.eq("status", filters.status);
  }

  if (filters.dateFrom) {
    nextQuery = nextQuery.gte(
      "effective_at",
      `${filters.dateFrom}T00:00:00-06:00`,
    );
  }

  if (filters.dateTo) {
    nextQuery = nextQuery.lte(
      "effective_at",
      `${filters.dateTo}T23:59:59.999-06:00`,
    );
  }

  const search = normalizeJournalSearch(filters.search ?? "");

  if (search) {
    nextQuery = nextQuery.or(
      [
        `ledger_folio.ilike.%${search}%`,
        `transaction_type.ilike.%${search}%`,
        `description.ilike.%${search}%`,
        `provider.ilike.%${search}%`,
        `provider_reference.ilike.%${search}%`,
        `trip_id.eq.${search}`,
        `payment_id.eq.${search}`,
        `refund_id.eq.${search}`,
        `withdrawal_id.eq.${search}`,
      ].join(","),
    );
  }

  return nextQuery as T;
}

export async function getPaginatedJournalTransactions(
  filters: PaginatedJournalFilters = {},
): Promise<PaginatedJournalResult> {
  const pageSize = Math.max(1, filters.pageSize ?? 25);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("financial_transactions")
    .select(
      `
        id,
        ledger_folio,
        transaction_type,
        status,
        currency,
        description,
        trip_id,
        payment_id,
        refund_id,
        withdrawal_id,
        wallet_transaction_id,
        passenger_wallet_transaction_id,
        provider,
        provider_reference,
        idempotency_key,
        reversal_of_transaction_id,
        created_by,
        metadata,
        effective_at,
        posted_at,
        created_at,
        updated_at
      `,
      { count: "exact" },
    )
    .order("effective_at", { ascending: false })
    .range(from, to);

  query = applyJournalFilters(query, filters);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const totalRows = count ?? 0;

  return {
    rows: (data ?? []) as JournalTransaction[],
    totalRows,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
  };
}

export async function getJournalTransactionDetail(
  transactionId: string,
): Promise<JournalTransactionDetail> {
  const { data: transaction, error: transactionError } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const { data: entries, error: entriesError } = await supabase
    .from("financial_ledger_entries")
    .select(
      `
        *,
        financial_accounts (
          id,
          code,
          name,
          account_type,
          normal_balance
        )
      `,
    )
    .eq("transaction_id", transactionId)
    .order("entry_number", { ascending: true });

  if (entriesError) {
    throw new Error(entriesError.message);
  }

  const { data: reversal, error: reversalError } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("reversal_of_transaction_id", transactionId)
    .maybeSingle();

  if (reversalError) {
    throw new Error(reversalError.message);
  }

  let original: JournalTransaction | null = null;

  if (transaction.reversal_of_transaction_id) {
    const { data: originalData, error: originalError } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("id", transaction.reversal_of_transaction_id)
      .maybeSingle();

    if (originalError) {
      throw new Error(originalError.message);
    }

    original = (originalData ?? null) as JournalTransaction | null;
  }

  return {
    transaction: transaction as JournalTransaction,
    entries: (entries ?? []) as JournalEntry[],
    reversal: (reversal ?? null) as JournalTransaction | null,
    original,
  };
}

export async function reverseJournalTransaction(
  transactionId: string,
  reason: string,
): Promise<string> {
  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    throw new Error("El motivo de la reversión es obligatorio.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("La sesión no está activa.");
  }

  const idempotencyKey = ["finance-ui-reversal", transactionId].join(":");

  const { data, error } = await supabase.rpc("reverse_financial_transaction", {
    p_transaction_id: transactionId,
    p_reason: normalizedReason,
    p_idempotency_key: idempotencyKey,
    p_created_by: session.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("La reversión no devolvió una póliza válida.");
  }

  return String(data);
}

export function getJournalAccount(entry: JournalEntry): {
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
} {
  const account = Array.isArray(entry.financial_accounts)
    ? entry.financial_accounts[0]
    : entry.financial_accounts;

  return {
    code: account?.code ?? "—",
    name: account?.name ?? "Cuenta no identificada",
    account_type: account?.account_type ?? "—",
    normal_balance: account?.normal_balance ?? "—",
  };
}
