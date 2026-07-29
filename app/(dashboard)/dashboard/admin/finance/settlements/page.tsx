"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Filter,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { isFinance } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type DailySettlement = {
  id: string;
  driver_id: string;
  settlement_date: string;
  timezone: string;
  period_start: string;
  period_end: string;
  status: string;
  trip_count: number;
  cash_trip_count: number;
  digital_trip_count: number;
  pending_digital_trip_count: number;
  fare_subtotal_amount: number;
  booking_fee_amount: number;
  tip_amount: number;
  gross_total_amount: number;
  cash_total_amount: number;
  digital_total_amount: number;
  passenger_wallet_amount: number;
  platform_commission_amount: number;
  platform_commission_iva_amount: number;
  iva_withholding_amount: number;
  isr_withholding_amount: number;
  gross_driver_earnings: number;
  net_driver_earnings: number;
  cash_debt_created_amount: number;
  bonus_amount: number;
  incentive_amount: number;
  manual_adjustment_amount: number;
  cancellation_fee_amount: number;
  cash_debt_payment_amount: number;
  withdrawal_paid_amount: number;
  other_wallet_movement_amount: number;
  settlement_net_amount: number;
  driver_rfc_snapshot: string | null;
  driver_fiscal_name_snapshot: string | null;
  driver_fiscal_postal_code_snapshot: string | null;
  driver_tax_regime_code_snapshot: string | null;
  source_payment_count: number;
  source_wallet_movement_count: number;
  source_snapshot_hash: string | null;
  validation_errors: unknown;
  calculated_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MonthlySettlement = {
  id: string;
  driver_id: string;
  period_month: string;
  period_start: string;
  period_end: string;
  timezone: string;
  status: string;
  daily_settlement_count: number;
  trip_count: number;
  cash_trip_count: number;
  digital_trip_count: number;
  fare_subtotal_amount: number;
  booking_fee_amount: number;
  tip_amount: number;
  gross_total_amount: number;
  cash_total_amount: number;
  digital_total_amount: number;
  passenger_wallet_amount: number;
  platform_commission_amount: number;
  platform_commission_iva_amount: number;
  iva_withholding_amount: number;
  isr_withholding_amount: number;
  gross_driver_earnings: number;
  net_driver_earnings: number;
  cash_debt_created_amount: number;
  bonus_amount: number;
  incentive_amount: number;
  manual_adjustment_amount: number;
  cancellation_fee_amount: number;
  cash_debt_payment_amount: number;
  withdrawal_paid_amount: number;
  other_wallet_movement_amount: number;
  settlement_net_amount: number;
  driver_rfc_snapshot: string | null;
  driver_fiscal_name_snapshot: string | null;
  driver_fiscal_postal_code_snapshot: string | null;
  driver_tax_regime_code_snapshot: string | null;
  tax_model_version: string | null;
  cfdi_internal_type: string | null;
  pac_payload: unknown;
  source_snapshot_hash: string | null;
  validation_errors: unknown;
  calculated_at: string | null;
  locked_at: string | null;
  ready_for_pac_at: string | null;
  created_at: string;
  updated_at: string;
};

type CfdiDocument = {
  id: string;
  monthly_settlement_id: string;
  version: number;
  document_status: string;
  idempotency_key: string;
  pac_provider: string | null;
  pac_environment: string | null;
  request_payload: unknown;
  response_payload: unknown;
  attempt_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  uuid: string | null;
  fiscal_folio: string | null;
  series: string | null;
  folio: string | null;
  stamped_at: string | null;
  xml_storage_path: string | null;
  pdf_storage_path: string | null;
  xml_sha256: string | null;
  sat_status: string | null;
  sat_verified_at: string | null;
  cancellation_reason_code: string | null;
  cancellation_replacement_uuid: string | null;
  cancellation_requested_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentDetail = {
  id: string;
  settlement_id: string;
  payment_transaction_id: string;
  trip_id: string;
  payment_method: string;
  payment_status: string;
  trip_completed_at: string | null;
  fare_subtotal_amount: number;
  booking_fee_amount: number;
  tip_amount: number;
  total_amount: number;
  passenger_wallet_applied: number;
  external_amount: number;
  platform_commission_amount: number;
  platform_commission_iva_amount: number;
  iva_withholding_amount: number;
  isr_withholding_amount: number;
  gross_driver_earnings: number;
  net_driver_earnings: number;
  tax_model_version: string | null;
};

type WalletItem = {
  id: string;
  settlement_id: string;
  wallet_transaction_id: string;
  transaction_type: string;
  balance_type: string;
  amount: number;
  description: string | null;
  movement_created_at: string;
};

type DailyDetailState = {
  loading: boolean;
  error: string;
  payments: PaymentDetail[];
  walletItems: WalletItem[];
};

type ViewMode = "daily" | "monthly";

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null | undefined) {
  return moneyFormatter.format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeErrors(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    ready: "Lista",
    closed: "Cerrada",
    needs_review: "Requiere revisión",
    ready_for_pac: "Lista para PAC",
    prepared: "Preparado",
    queued: "En cola",
    sending: "Enviando",
    sent: "Enviado",
    stamped: "Timbrado",
    sat_pending: "Pendiente SAT",
    sat_confirmed: "Confirmado por SAT",
    rejected: "Rechazado",
    retry_pending: "Reintento pendiente",
    cancel_pending: "Cancelación pendiente",
    cancelled: "Cancelado",
    replaced: "Sustituido",
  };

  return labels[status] ?? status;
}

function statusClasses(status: string) {
  if (
    [
      "ready",
      "closed",
      "ready_for_pac",
      "stamped",
      "sat_confirmed",
    ].includes(status)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    [
      "needs_review",
      "rejected",
      "cancelled",
    ].includes(status)
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

export default function FinanceSettlementsPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [dailySettlements, setDailySettlements] = useState<
    DailySettlement[]
  >([]);
  const [monthlySettlements, setMonthlySettlements] = useState<
    MonthlySettlement[]
  >([]);
  const [documents, setDocuments] = useState<CfdiDocument[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(currentMonth());

  const [expandedDailyId, setExpandedDailyId] =
    useState<string | null>(null);
  const [expandedMonthlyId, setExpandedMonthlyId] =
    useState<string | null>(null);

  const [dailyDetails, setDailyDetails] = useState<
    Record<string, DailyDetailState>
  >({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile]),
      ),
    [profiles],
  );

  const documentByMonthlyId = useMemo(() => {
    const map = new Map<string, CfdiDocument>();

    documents.forEach((document) => {
      if (!map.has(document.monthly_settlement_id)) {
        map.set(document.monthly_settlement_id, document);
      }
    });

    return map;
  }, [documents]);

  const loadData = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      const { data: currentProfile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role, account_active")
          .eq("id", session.user.id)
          .single();

      if (
        profileError ||
        currentProfile?.account_active === false ||
        !isFinance(currentProfile?.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      const [dailyResult, monthlyResult, documentResult] =
        await Promise.all([
          supabase
            .from("driver_daily_settlements")
            .select("*")
            .order("settlement_date", {
              ascending: false,
            }),

          supabase
            .from("driver_monthly_settlements")
            .select("*")
            .order("period_month", {
              ascending: false,
            }),

          supabase
            .from("driver_cfdi_documents")
            .select("*")
            .order("version", {
              ascending: false,
            }),
        ]);

      const firstError =
        dailyResult.error ||
        monthlyResult.error ||
        documentResult.error;

      if (firstError) {
        setMessage(firstError.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const dailyData =
        (dailyResult.data ?? []) as DailySettlement[];

      const monthlyData =
        (monthlyResult.data ?? []) as MonthlySettlement[];

      const documentData =
        (documentResult.data ?? []) as CfdiDocument[];

      const driverIds = Array.from(
        new Set([
          ...dailyData.map((item) => item.driver_id),
          ...monthlyData.map((item) => item.driver_id),
        ]),
      );

      let profileData: Profile[] = [];

      if (driverIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", driverIds);

        if (error) {
          setMessage(error.message);
        } else {
          profileData = (data ?? []) as Profile[];
        }
      }

      setDailySettlements(dailyData);
      setMonthlySettlements(monthlyData);
      setDocuments(documentData);
      setProfiles(profileData);

      setLoading(false);
      setRefreshing(false);
    },
    [router],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function loadDailyDetails(settlementId: string) {
    if (dailyDetails[settlementId]) {
      return;
    }

    setDailyDetails((current) => ({
      ...current,
      [settlementId]: {
        loading: true,
        error: "",
        payments: [],
        walletItems: [],
      },
    }));

    const [paymentResult, walletResult] = await Promise.all([
      supabase
        .from("driver_daily_settlement_payments")
        .select("*")
        .eq("settlement_id", settlementId)
        .order("trip_completed_at", {
          ascending: true,
        }),

      supabase
        .from("driver_daily_settlement_wallet_items")
        .select("*")
        .eq("settlement_id", settlementId)
        .order("movement_created_at", {
          ascending: true,
        }),
    ]);

    const error =
      paymentResult.error?.message ||
      walletResult.error?.message ||
      "";

    setDailyDetails((current) => ({
      ...current,
      [settlementId]: {
        loading: false,
        error,
        payments:
          (paymentResult.data ?? []) as PaymentDetail[],
        walletItems:
          (walletResult.data ?? []) as WalletItem[],
      },
    }));
  }

  function toggleDaily(settlementId: string) {
    const next =
      expandedDailyId === settlementId
        ? null
        : settlementId;

    setExpandedDailyId(next);

    if (next) {
      void loadDailyDetails(next);
    }
  }

  const filteredDaily = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return dailySettlements.filter((settlement) => {
      const profile = profileById.get(settlement.driver_id);

      const searchable = [
        profile?.full_name,
        profile?.phone,
        settlement.driver_id,
        settlement.driver_rfc_snapshot,
        settlement.driver_fiscal_name_snapshot,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchable.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        settlement.status === statusFilter;

      const matchesDay =
        !dayFilter ||
        settlement.settlement_date === dayFilter;

      const matchesMonth =
        !monthFilter ||
        settlement.settlement_date.startsWith(monthFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDay &&
        matchesMonth
      );
    });
  }, [
    dailySettlements,
    profileById,
    searchTerm,
    statusFilter,
    dayFilter,
    monthFilter,
  ]);

  const filteredMonthly = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return monthlySettlements.filter((settlement) => {
      const profile = profileById.get(settlement.driver_id);
      const document = documentByMonthlyId.get(settlement.id);

      const searchable = [
        profile?.full_name,
        profile?.phone,
        settlement.driver_id,
        settlement.driver_rfc_snapshot,
        settlement.driver_fiscal_name_snapshot,
        document?.uuid,
        document?.fiscal_folio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchable.includes(normalizedSearch);

      const effectiveStatus =
        document?.document_status ?? settlement.status;

      const matchesStatus =
        statusFilter === "all" ||
        settlement.status === statusFilter ||
        effectiveStatus === statusFilter;

      const matchesMonth =
        !monthFilter ||
        settlement.period_month.startsWith(monthFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMonth
      );
    });
  }, [
    monthlySettlements,
    profileById,
    documentByMonthlyId,
    searchTerm,
    statusFilter,
    monthFilter,
  ]);

  const summary = useMemo(() => {
    const driverIds =
      viewMode === "daily"
        ? filteredDaily.map((item) => item.driver_id)
        : filteredMonthly.map((item) => item.driver_id);

    const records =
      viewMode === "daily"
        ? filteredDaily
        : filteredMonthly;

    const gross = records.reduce(
      (total, item) =>
        total + Number(item.gross_total_amount ?? 0),
      0,
    );

    const net = records.reduce(
      (total, item) =>
        total + Number(item.settlement_net_amount ?? 0),
      0,
    );

    const attention =
      viewMode === "daily"
        ? filteredDaily.filter(
            (item) => item.status === "needs_review",
          ).length
        : filteredMonthly.filter((item) => {
            const document = documentByMonthlyId.get(item.id);

            return [
              "needs_review",
              "rejected",
              "retry_pending",
              "cancel_pending",
            ].includes(
              document?.document_status ?? item.status,
            );
          }).length;

    return {
      drivers: new Set(driverIds).size,
      records: records.length,
      gross,
      net,
      attention,
    };
  }, [
    viewMode,
    filteredDaily,
    filteredMonthly,
    documentByMonthlyId,
  ]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();

    dailySettlements.forEach((item) =>
      statuses.add(item.status),
    );

    monthlySettlements.forEach((item) =>
      statuses.add(item.status),
    );

    documents.forEach((item) =>
      statuses.add(item.document_status),
    );

    return Array.from(statuses).sort();
  }, [dailySettlements, monthlySettlements, documents]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setDayFilter("");
    setMonthFilter(currentMonth());
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-9 w-9 animate-spin" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Cargando liquidaciones y CFDI...
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-7 overflow-x-hidden">
      <div className="overflow-hidden rounded-[2rem] bg-[#020617] px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              AXI Finanzas
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Liquidaciones y CFDI
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Consulta liquidaciones diarias, cierres mensuales,
              retenciones y documentos fiscales de cada conductor.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 text-sm font-black text-slate-950 transition hover:bg-yellow-300 disabled:opacity-60"
          >
            <RefreshCw
              size={18}
              className={refreshing ? "animate-spin" : ""}
            />
            Actualizar
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <SummaryCard
          label="Conductores"
          value={String(summary.drivers)}
          icon={Users}
        />

        <SummaryCard
          label="Registros"
          value={String(summary.records)}
          icon={ReceiptText}
        />

        <SummaryCard
          label="Importe bruto"
          value={formatMoney(summary.gross)}
          icon={CircleDollarSign}
        />

        <SummaryCard
          label="Resultado neto"
          value={formatMoney(summary.net)}
          icon={WalletCards}
          dark
        />

        <SummaryCard
          label="Requieren atención"
          value={String(summary.attention)}
          icon={AlertTriangle}
          warning={summary.attention > 0}
        />
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid w-full grid-cols-1 gap-1 rounded-2xl bg-slate-100 p-1 sm:w-auto sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setViewMode("daily");
                  setStatusFilter("all");
                }}
                className={cn(
                  "w-full rounded-xl px-5 py-2.5 text-sm font-black leading-5 transition",
                  viewMode === "daily"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500",
                )}
              >
                Liquidaciones diarias
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("monthly");
                  setStatusFilter("all");
                }}
                className={cn(
                  "w-full rounded-xl px-5 py-2.5 text-sm font-black leading-5 transition",
                  viewMode === "monthly"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500",
                )}
              >
                Cierres mensuales y CFDI
              </button>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 transition hover:border-slate-400"
            >
              <X size={15} />
              Limpiar filtros
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="relative lg:col-span-2">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                Conductor, RFC o UUID
              </span>

              <Search className="absolute bottom-3.5 left-4 h-4 w-4 text-slate-400" />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Buscar por nombre, teléfono, RFC o UUID..."
                className="h-12 w-full rounded-xl border border-slate-200 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-yellow-400"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                Estado
              </span>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-yellow-400"
              >
                <option value="all">Todos los estados</option>

                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                Mes
              </span>

              <input
                type="month"
                value={monthFilter}
                onChange={(event) =>
                  setMonthFilter(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-yellow-400"
              />
            </label>
          </div>

          {viewMode === "daily" && (
            <label className="max-w-xs">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                Día específico
              </span>

              <input
                type="date"
                value={dayFilter}
                onChange={(event) =>
                  setDayFilter(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-yellow-400"
              />
            </label>
          )}
        </div>
      </div>

      {viewMode === "daily" ? (
        filteredDaily.length === 0 ? (
          <EmptyState
            title="No hay liquidaciones con estos filtros"
            description="Modifica la fecha, el estado o la búsqueda del conductor."
          />
        ) : (
          <div className="space-y-4">
            {filteredDaily.map((settlement) => {
              const profile = profileById.get(
                settlement.driver_id,
              );

              const errors = normalizeErrors(
                settlement.validation_errors,
              );

              const expanded =
                expandedDailyId === settlement.id;

              const details = dailyDetails[settlement.id];

              return (
                <article
                  key={settlement.id}
                  className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-black text-slate-950">
                          {profile?.full_name ||
                            settlement.driver_fiscal_name_snapshot ||
                            "Conductor sin nombre"}
                        </h2>

                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-black",
                            statusClasses(settlement.status),
                          )}
                        >
                          {statusLabel(settlement.status)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {formatDate(settlement.settlement_date)}
                        {" · "}
                        RFC:{" "}
                        {settlement.driver_rfc_snapshot ||
                          "No registrado"}
                      </p>

                      <p className="mt-1 break-all text-xs text-slate-400">
                        ID conductor: {settlement.driver_id}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggleDaily(settlement.id)
                      }
                      className="inline-flex h-auto min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-black leading-5 text-white transition hover:bg-slate-800 xl:w-auto"
                    >
                      {expanded ? (
                        <ChevronUp size={17} />
                      ) : (
                        <ChevronDown size={17} />
                      )}

                      {expanded
                        ? "Ocultar detalle"
                        : "Ver liquidación completa"}
                    </button>
                  </div>

                  <div className="grid gap-px bg-slate-100 [grid-template-columns:repeat(auto-fit,minmax(155px,1fr))]">
                    <Metric
                      label="Viajes"
                      value={String(settlement.trip_count)}
                    />
                    <Metric
                      label="Efectivo"
                      value={formatMoney(
                        settlement.cash_total_amount,
                      )}
                    />
                    <Metric
                      label="Digital"
                      value={formatMoney(
                        settlement.digital_total_amount,
                      )}
                    />
                    <Metric
                      label="Comisión AXI"
                      value={formatMoney(
                        settlement.platform_commission_amount,
                      )}
                    />
                    <Metric
                      label="Retenciones"
                      value={formatMoney(
                        Number(
                          settlement.iva_withholding_amount,
                        ) +
                          Number(
                            settlement.isr_withholding_amount,
                          ),
                      )}
                    />
                    <Metric
                      label="Resultado neto"
                      value={formatMoney(
                        settlement.settlement_net_amount,
                      )}
                      emphasized
                    />
                  </div>

                  {errors.length > 0 && (
                    <div className="border-t border-amber-100 bg-amber-50 px-6 py-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                        <div>
                          <p className="text-sm font-black text-amber-900">
                            Requiere atención
                          </p>

                          <p className="mt-1 text-sm text-amber-800">
                            {errors.join(" · ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {expanded && (
                    <div className="space-y-7 border-t border-slate-100 px-6 py-6">
                      <section>
                        <SectionTitle title="Información fiscal" />

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <Detail
                            label="RFC"
                            value={
                              settlement.driver_rfc_snapshot ||
                              "No registrado"
                            }
                          />
                          <Detail
                            label="Nombre fiscal"
                            value={
                              settlement.driver_fiscal_name_snapshot ||
                              "No registrado"
                            }
                          />
                          <Detail
                            label="Código postal"
                            value={
                              settlement.driver_fiscal_postal_code_snapshot ||
                              "No registrado"
                            }
                          />
                          <Detail
                            label="Régimen fiscal"
                            value={
                              settlement.driver_tax_regime_code_snapshot ||
                              "No registrado"
                            }
                          />
                        </div>
                      </section>

                      <section>
                        <SectionTitle title="Resumen financiero completo" />

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                          <Detail
                            label="Subtotal de tarifas"
                            value={formatMoney(
                              settlement.fare_subtotal_amount,
                            )}
                          />
                          <Detail
                            label="Tarifas de reserva"
                            value={formatMoney(
                              settlement.booking_fee_amount,
                            )}
                          />
                          <Detail
                            label="Propinas"
                            value={formatMoney(
                              settlement.tip_amount,
                            )}
                          />
                          <Detail
                            label="Total bruto"
                            value={formatMoney(
                              settlement.gross_total_amount,
                            )}
                          />
                          <Detail
                            label="Wallet pasajero"
                            value={formatMoney(
                              settlement.passenger_wallet_amount,
                            )}
                          />
                          <Detail
                            label="IVA comisión AXI"
                            value={formatMoney(
                              settlement.platform_commission_iva_amount,
                            )}
                          />
                          <Detail
                            label="IVA retenido"
                            value={formatMoney(
                              settlement.iva_withholding_amount,
                            )}
                          />
                          <Detail
                            label="ISR retenido"
                            value={formatMoney(
                              settlement.isr_withholding_amount,
                            )}
                          />
                          <Detail
                            label="Ganancia bruta conductor"
                            value={formatMoney(
                              settlement.gross_driver_earnings,
                            )}
                          />
                          <Detail
                            label="Ganancia neta conductor"
                            value={formatMoney(
                              settlement.net_driver_earnings,
                            )}
                          />
                          <Detail
                            label="Bonos"
                            value={formatMoney(
                              settlement.bonus_amount,
                            )}
                          />
                          <Detail
                            label="Incentivos"
                            value={formatMoney(
                              settlement.incentive_amount,
                            )}
                          />
                          <Detail
                            label="Ajustes manuales"
                            value={formatMoney(
                              settlement.manual_adjustment_amount,
                            )}
                          />
                          <Detail
                            label="Penalizaciones"
                            value={formatMoney(
                              settlement.cancellation_fee_amount,
                            )}
                          />
                          <Detail
                            label="Deuda creada"
                            value={formatMoney(
                              settlement.cash_debt_created_amount,
                            )}
                          />
                          <Detail
                            label="Deuda pagada"
                            value={formatMoney(
                              settlement.cash_debt_payment_amount,
                            )}
                          />
                          <Detail
                            label="Retiros pagados"
                            value={formatMoney(
                              settlement.withdrawal_paid_amount,
                            )}
                          />
                          <Detail
                            label="Otros movimientos"
                            value={formatMoney(
                              settlement.other_wallet_movement_amount,
                            )}
                          />
                          <Detail
                            label="Viajes efectivo"
                            value={String(
                              settlement.cash_trip_count,
                            )}
                          />
                          <Detail
                            label="Viajes digitales"
                            value={String(
                              settlement.digital_trip_count,
                            )}
                          />
                          <Detail
                            label="Digitales pendientes"
                            value={String(
                              settlement.pending_digital_trip_count,
                            )}
                          />
                          <Detail
                            label="Resultado final"
                            value={formatMoney(
                              settlement.settlement_net_amount,
                            )}
                            strong
                          />
                        </div>
                      </section>

                      <section>
                        <SectionTitle title="Viajes y pagos incluidos" />

                        {details?.loading ? (
                          <LoadingLine />
                        ) : details?.error ? (
                          <ErrorLine message={details.error} />
                        ) : details?.payments.length ? (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-[1100px] w-full text-left text-sm">
                              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="px-4 py-3">Viaje</th>
                                  <th className="px-4 py-3">Método</th>
                                  <th className="px-4 py-3">Estado</th>
                                  <th className="px-4 py-3">Total</th>
                                  <th className="px-4 py-3">Comisión</th>
                                  <th className="px-4 py-3">IVA comisión</th>
                                  <th className="px-4 py-3">IVA retenido</th>
                                  <th className="px-4 py-3">ISR retenido</th>
                                  <th className="px-4 py-3">Neto conductor</th>
                                  <th className="px-4 py-3">Finalizado</th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-slate-100">
                                {details.payments.map((payment) => (
                                  <tr key={payment.id}>
                                    <td className="px-4 py-3 font-mono text-xs">
                                      {payment.trip_id}
                                    </td>
                                    <td className="px-4 py-3 font-semibold">
                                      {payment.payment_method}
                                    </td>
                                    <td className="px-4 py-3">
                                      {payment.payment_status}
                                    </td>
                                    <td className="px-4 py-3 font-bold">
                                      {formatMoney(
                                        payment.total_amount,
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatMoney(
                                        payment.platform_commission_amount,
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatMoney(
                                        payment.platform_commission_iva_amount,
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatMoney(
                                        payment.iva_withholding_amount,
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatMoney(
                                        payment.isr_withholding_amount,
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-black">
                                      {formatMoney(
                                        payment.net_driver_earnings,
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatDateTime(
                                        payment.trip_completed_at,
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyLine text="No hay pagos incluidos." />
                        )}
                      </section>

                      <section>
                        <SectionTitle title="Movimientos de wallet incluidos" />

                        {details?.loading ? (
                          <LoadingLine />
                        ) : details?.walletItems.length ? (
                          <div className="grid gap-3">
                            {details.walletItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="font-black text-slate-900">
                                    {item.transaction_type}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.description ||
                                      "Sin descripción"}
                                    {" · "}
                                    {formatDateTime(
                                      item.movement_created_at,
                                    )}
                                  </p>
                                </div>

                                <div className="text-left sm:text-right">
                                  <p className="text-lg font-black">
                                    {formatMoney(item.amount)}
                                  </p>

                                  <p className="text-xs font-semibold text-slate-500">
                                    {item.balance_type}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyLine text="No hay movimientos de wallet incluidos." />
                        )}
                      </section>

                      <section>
                        <SectionTitle title="Auditoría de la liquidación" />

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <Detail
                            label="Pagos fuente"
                            value={String(
                              settlement.source_payment_count,
                            )}
                          />
                          <Detail
                            label="Movimientos fuente"
                            value={String(
                              settlement.source_wallet_movement_count,
                            )}
                          />
                          <Detail
                            label="Calculada"
                            value={formatDateTime(
                              settlement.calculated_at,
                            )}
                          />
                          <Detail
                            label="Cerrada"
                            value={formatDateTime(
                              settlement.closed_at,
                            )}
                          />
                        </div>

                        <p className="mt-4 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-500">
                          Hash:{" "}
                          {settlement.source_snapshot_hash ||
                            "Sin hash"}
                        </p>
                      </section>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )
      ) : filteredMonthly.length === 0 ? (
        <EmptyState
          title="No hay cierres mensuales con estos filtros"
          description="Modifica el mes, el estado o la búsqueda del conductor."
        />
      ) : (
        <div className="space-y-4">
          {filteredMonthly.map((settlement) => {
            const profile = profileById.get(
              settlement.driver_id,
            );

            const document = documentByMonthlyId.get(
              settlement.id,
            );

            const errors = normalizeErrors(
              settlement.validation_errors,
            );

            const effectiveStatus =
              document?.document_status ?? settlement.status;

            const expanded =
              expandedMonthlyId === settlement.id;

            return (
              <article
                key={settlement.id}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-black text-slate-950">
                        {profile?.full_name ||
                          settlement.driver_fiscal_name_snapshot ||
                          "Conductor sin nombre"}
                      </h2>

                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-black",
                          statusClasses(effectiveStatus),
                        )}
                      >
                        {statusLabel(effectiveStatus)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold capitalize text-slate-500">
                      {formatMonth(settlement.period_month)}
                      {" · "}
                      RFC:{" "}
                      {settlement.driver_rfc_snapshot ||
                        "No registrado"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMonthlyId(
                        expanded ? null : settlement.id,
                      )
                    }
                    className="inline-flex h-auto min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-black leading-5 text-white transition hover:bg-slate-800 xl:w-auto"
                  >
                    {expanded ? (
                      <ChevronUp size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}

                    {expanded
                      ? "Ocultar detalle"
                      : "Ver cierre y CFDI"}
                  </button>
                </div>

                <div className="grid gap-px bg-slate-100 [grid-template-columns:repeat(auto-fit,minmax(155px,1fr))]">
                  <Metric
                    label="Días liquidados"
                    value={String(
                      settlement.daily_settlement_count,
                    )}
                  />
                  <Metric
                    label="Viajes"
                    value={String(settlement.trip_count)}
                  />
                  <Metric
                    label="Total bruto"
                    value={formatMoney(
                      settlement.gross_total_amount,
                    )}
                  />
                  <Metric
                    label="Comisión AXI"
                    value={formatMoney(
                      settlement.platform_commission_amount,
                    )}
                  />
                  <Metric
                    label="Retenciones"
                    value={formatMoney(
                      Number(
                        settlement.iva_withholding_amount,
                      ) +
                        Number(
                          settlement.isr_withholding_amount,
                        ),
                    )}
                  />
                  <Metric
                    label="Resultado mensual"
                    value={formatMoney(
                      settlement.settlement_net_amount,
                    )}
                    emphasized
                  />
                </div>

                {expanded && (
                  <div className="space-y-7 border-t border-slate-100 px-6 py-6">
                    <section>
                      <SectionTitle title="Datos fiscales del conductor" />

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Detail
                          label="RFC"
                          value={
                            settlement.driver_rfc_snapshot ||
                            "No registrado"
                          }
                        />
                        <Detail
                          label="Nombre fiscal"
                          value={
                            settlement.driver_fiscal_name_snapshot ||
                            "No registrado"
                          }
                        />
                        <Detail
                          label="Código postal"
                          value={
                            settlement.driver_fiscal_postal_code_snapshot ||
                            "No registrado"
                          }
                        />
                        <Detail
                          label="Régimen fiscal"
                          value={
                            settlement.driver_tax_regime_code_snapshot ||
                            "No registrado"
                          }
                        />
                      </div>
                    </section>

                    <section>
                      <SectionTitle title="Totales del cierre mensual" />

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <Detail
                          label="Viajes efectivo"
                          value={String(
                            settlement.cash_trip_count,
                          )}
                        />
                        <Detail
                          label="Viajes digitales"
                          value={String(
                            settlement.digital_trip_count,
                          )}
                        />
                        <Detail
                          label="Subtotal tarifas"
                          value={formatMoney(
                            settlement.fare_subtotal_amount,
                          )}
                        />
                        <Detail
                          label="Tarifas de reserva"
                          value={formatMoney(
                            settlement.booking_fee_amount,
                          )}
                        />
                        <Detail
                          label="Propinas"
                          value={formatMoney(
                            settlement.tip_amount,
                          )}
                        />
                        <Detail
                          label="Efectivo"
                          value={formatMoney(
                            settlement.cash_total_amount,
                          )}
                        />
                        <Detail
                          label="Digital"
                          value={formatMoney(
                            settlement.digital_total_amount,
                          )}
                        />
                        <Detail
                          label="Wallet pasajero"
                          value={formatMoney(
                            settlement.passenger_wallet_amount,
                          )}
                        />
                        <Detail
                          label="IVA comisión AXI"
                          value={formatMoney(
                            settlement.platform_commission_iva_amount,
                          )}
                        />
                        <Detail
                          label="IVA retenido"
                          value={formatMoney(
                            settlement.iva_withholding_amount,
                          )}
                        />
                        <Detail
                          label="ISR retenido"
                          value={formatMoney(
                            settlement.isr_withholding_amount,
                          )}
                        />
                        <Detail
                          label="Ganancia bruta conductor"
                          value={formatMoney(
                            settlement.gross_driver_earnings,
                          )}
                        />
                        <Detail
                          label="Ganancia neta conductor"
                          value={formatMoney(
                            settlement.net_driver_earnings,
                          )}
                        />
                        <Detail
                          label="Bonos"
                          value={formatMoney(
                            settlement.bonus_amount,
                          )}
                        />
                        <Detail
                          label="Incentivos"
                          value={formatMoney(
                            settlement.incentive_amount,
                          )}
                        />
                        <Detail
                          label="Ajustes manuales"
                          value={formatMoney(
                            settlement.manual_adjustment_amount,
                          )}
                        />
                        <Detail
                          label="Penalizaciones"
                          value={formatMoney(
                            settlement.cancellation_fee_amount,
                          )}
                        />
                        <Detail
                          label="Deuda creada"
                          value={formatMoney(
                            settlement.cash_debt_created_amount,
                          )}
                        />
                        <Detail
                          label="Deuda pagada"
                          value={formatMoney(
                            settlement.cash_debt_payment_amount,
                          )}
                        />
                        <Detail
                          label="Retiros pagados"
                          value={formatMoney(
                            settlement.withdrawal_paid_amount,
                          )}
                        />
                        <Detail
                          label="Resultado mensual"
                          value={formatMoney(
                            settlement.settlement_net_amount,
                          )}
                          strong
                        />
                      </div>
                    </section>

                    <section>
                      <SectionTitle title="Documento CFDI mensual" />

                      {document ? (
                        <div className="space-y-5 rounded-2xl border border-slate-200 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                Estado del documento
                              </p>

                              <p className="mt-2 break-words text-xl font-black leading-tight sm:text-2xl">
                                {statusLabel(
                                  document.document_status,
                                )}
                              </p>
                            </div>

                            <span
                              className={cn(
                                "w-fit rounded-full border px-4 py-2 text-xs font-black",
                                statusClasses(
                                  document.document_status,
                                ),
                              )}
                            >
                              Versión {document.version}
                            </span>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Detail
                              label="UUID"
                              value={
                                document.uuid ||
                                "Pendiente de timbrado"
                              }
                            />
                            <Detail
                              label="Folio fiscal"
                              value={
                                document.fiscal_folio ||
                                "Pendiente"
                              }
                            />
                            <Detail
                              label="Serie / folio"
                              value={
                                [
                                  document.series,
                                  document.folio,
                                ]
                                  .filter(Boolean)
                                  .join(" ") || "Pendiente"
                              }
                            />
                            <Detail
                              label="Estado SAT"
                              value={
                                document.sat_status ||
                                "Sin verificar"
                              }
                            />
                            <Detail
                              label="Proveedor PAC"
                              value={
                                document.pac_provider ||
                                "No conectado"
                              }
                            />
                            <Detail
                              label="Ambiente"
                              value={
                                document.pac_environment ||
                                "No configurado"
                              }
                            />
                            <Detail
                              label="Intentos"
                              value={String(
                                document.attempt_count,
                              )}
                            />
                            <Detail
                              label="Timbrado"
                              value={formatDateTime(
                                document.stamped_at,
                              )}
                            />
                            <Detail
                              label="XML"
                              value={
                                document.xml_storage_path ||
                                "No disponible"
                              }
                            />
                            <Detail
                              label="PDF"
                              value={
                                document.pdf_storage_path ||
                                "No disponible"
                              }
                            />
                            <Detail
                              label="Verificación SAT"
                              value={formatDateTime(
                                document.sat_verified_at,
                              )}
                            />
                            <Detail
                              label="Último intento"
                              value={formatDateTime(
                                document.last_attempt_at,
                              )}
                            />
                          </div>

                          {(document.last_error_code ||
                            document.last_error_message) && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                              <p className="font-black">
                                Error del documento
                              </p>

                              <p className="mt-1">
                                {document.last_error_code
                                  ? `${document.last_error_code}: `
                                  : ""}
                                {document.last_error_message}
                              </p>
                            </div>
                          )}

                          <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-500">
                            Idempotencia:{" "}
                            {document.idempotency_key}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                            <div>
                              <p className="font-black text-amber-900">
                                Todavía no existe documento CFDI
                              </p>

                              <p className="mt-1 text-sm text-amber-800">
                                El cierre debe estar validado y listo
                                para PAC antes de preparar el documento.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {errors.length > 0 && (
                      <section>
                        <SectionTitle title="Validaciones pendientes" />

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                          <ul className="space-y-2 text-sm font-semibold text-amber-900">
                            {errors.map((error) => (
                              <li key={error}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      </section>
                    )}

                    <section>
                      <SectionTitle title="Auditoría del cierre" />

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Detail
                          label="Modelo fiscal"
                          value={
                            settlement.tax_model_version ||
                            "Sin modelo"
                          }
                        />
                        <Detail
                          label="Tipo interno CFDI"
                          value={
                            settlement.cfdi_internal_type ||
                            "Sin definir"
                          }
                        />
                        <Detail
                          label="Calculado"
                          value={formatDateTime(
                            settlement.calculated_at,
                          )}
                        />
                        <Detail
                          label="Listo para PAC"
                          value={formatDateTime(
                            settlement.ready_for_pac_at,
                          )}
                        />
                      </div>

                      <p className="mt-4 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-500">
                        Hash mensual:{" "}
                        {settlement.source_snapshot_hash ||
                          "Sin hash"}
                      </p>
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  dark = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  dark?: boolean;
  warning?: boolean;
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[1.6rem] border p-5 shadow-sm",
        dark
          ? "border-slate-950 bg-slate-950 text-white"
          : warning
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-slate-200 bg-white text-slate-950",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          dark
            ? "bg-yellow-400 text-black"
            : warning
              ? "bg-amber-200 text-amber-800"
              : "bg-blue-50 text-blue-600",
        )}
      >
        <Icon size={20} />
      </span>

      <p className="mt-5 break-words text-xs font-black uppercase leading-5 tracking-[0.12em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-xl font-black leading-tight sm:text-2xl">{value}</p>
    </article>
  );
}

function Metric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-5",
        emphasized
          ? "bg-slate-950 text-white"
          : "bg-white text-slate-950",
      )}
    >
      <p
        className={cn(
          "break-words text-xs font-black uppercase leading-5 tracking-[0.1em]",
          emphasized ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </p>

      <p className="mt-2 break-words text-base font-black leading-tight sm:text-lg">{value}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
        <FileCheck2 size={18} />
      </span>

      <h3 className="text-lg font-black text-slate-950">
        {title}
      </h3>
    </div>
  );
}

function Detail({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        strong
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-slate-50",
      )}
    >
      <p
        className={cn(
          "text-xs font-black uppercase tracking-wider",
          strong ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </p>

      <p className="mt-2 break-words font-black">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-600">
        <FileText size={28} />
      </span>

      <h2 className="mt-5 text-xl font-black text-slate-950">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function LoadingLine() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      Cargando detalle...
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
      {message}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}
