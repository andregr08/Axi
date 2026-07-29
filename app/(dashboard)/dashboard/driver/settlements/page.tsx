"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from "lucide-react";

import { isDriver } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type DailySettlement = {
  id: string;
  driver_id: string;
  settlement_date: string;
  status: string;
  trip_count: number;
  cash_trip_count: number;
  digital_trip_count: number;
  fare_subtotal_amount: number;
  booking_fee_amount: number;
  tip_amount: number;
  gross_total_amount: number;
  cash_total_amount: number;
  digital_total_amount: number;
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
  settlement_net_amount: number;
  driver_rfc_snapshot: string | null;
  validation_errors: string[];
  calculated_at: string | null;
  closed_at: string | null;
};

type MonthlySettlement = {
  id: string;
  driver_id: string;
  period_month: string;
  status: string;
  daily_settlement_count: number;
  trip_count: number;
  gross_total_amount: number;
  platform_commission_amount: number;
  platform_commission_iva_amount: number;
  iva_withholding_amount: number;
  isr_withholding_amount: number;
  gross_driver_earnings: number;
  net_driver_earnings: number;
  bonus_amount: number;
  incentive_amount: number;
  cancellation_fee_amount: number;
  settlement_net_amount: number;
  driver_rfc_snapshot: string | null;
  validation_errors: string[];
  ready_for_pac_at: string | null;
};

type CfdiDocument = {
  id: string;
  monthly_settlement_id: string;
  document_status: string;
  uuid: string | null;
  fiscal_folio: string | null;
  stamped_at: string | null;
  xml_storage_path: string | null;
  pdf_storage_path: string | null;
  sat_status: string | null;
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

function formatDay(value: string) {
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

function getCurrentMexicoMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
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
    status === "closed" ||
    status === "ready" ||
    status === "ready_for_pac" ||
    status === "stamped" ||
    status === "sat_confirmed"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "needs_review" ||
    status === "rejected" ||
    status === "cancelled"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function DriverSettlementsPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMexicoMonth(),
  );

  const [driverName, setDriverName] = useState("Conductor AXI");
  const [dailySettlements, setDailySettlements] = useState<
    DailySettlement[]
  >([]);
  const [monthlySettlements, setMonthlySettlements] = useState<
    MonthlySettlement[]
  >([]);
  const [documents, setDocuments] = useState<CfdiDocument[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const documentsByMonthlyId = useMemo(() => {
    return new Map(
      documents.map((document) => [
        document.monthly_settlement_id,
        document,
      ]),
    );
  }, [documents]);

  const filteredDaily = useMemo(() => {
    return dailySettlements.filter((settlement) =>
      settlement.settlement_date.startsWith(selectedMonth),
    );
  }, [dailySettlements, selectedMonth]);

  const filteredMonthly = useMemo(() => {
    return monthlySettlements.filter((settlement) =>
      settlement.period_month.startsWith(selectedMonth),
    );
  }, [monthlySettlements, selectedMonth]);

  const monthSummary = useMemo(() => {
    return filteredDaily.reduce(
      (total, settlement) => ({
        trips: total.trips + Number(settlement.trip_count ?? 0),
        gross:
          total.gross +
          Number(settlement.gross_driver_earnings ?? 0),
        net:
          total.net +
          Number(settlement.settlement_net_amount ?? 0),
        retentions:
          total.retentions +
          Number(settlement.iva_withholding_amount ?? 0) +
          Number(settlement.isr_withholding_amount ?? 0),
      }),
      {
        trips: 0,
        gross: 0,
        net: 0,
        retentions: 0,
      },
    );
  }, [filteredDaily]);

  const loadSettlements = useCallback(
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", session.user.id)
        .single();

      if (profileError || !isDriver(profile?.role)) {
        router.replace("/dashboard");
        return;
      }

      setDriverName(profile.full_name?.trim() || "Conductor AXI");

      const [dailyResult, monthlyResult] = await Promise.all([
        supabase
          .from("driver_daily_settlements")
          .select(`
            id,
            driver_id,
            settlement_date,
            status,
            trip_count,
            cash_trip_count,
            digital_trip_count,
            fare_subtotal_amount,
            booking_fee_amount,
            tip_amount,
            gross_total_amount,
            cash_total_amount,
            digital_total_amount,
            platform_commission_amount,
            platform_commission_iva_amount,
            iva_withholding_amount,
            isr_withholding_amount,
            gross_driver_earnings,
            net_driver_earnings,
            cash_debt_created_amount,
            bonus_amount,
            incentive_amount,
            manual_adjustment_amount,
            cancellation_fee_amount,
            settlement_net_amount,
            driver_rfc_snapshot,
            validation_errors,
            calculated_at,
            closed_at
          `)
          .order("settlement_date", {
            ascending: false,
          }),

        supabase
          .from("driver_monthly_settlements")
          .select(`
            id,
            driver_id,
            period_month,
            status,
            daily_settlement_count,
            trip_count,
            gross_total_amount,
            platform_commission_amount,
            platform_commission_iva_amount,
            iva_withholding_amount,
            isr_withholding_amount,
            gross_driver_earnings,
            net_driver_earnings,
            bonus_amount,
            incentive_amount,
            cancellation_fee_amount,
            settlement_net_amount,
            driver_rfc_snapshot,
            validation_errors,
            ready_for_pac_at
          `)
          .order("period_month", {
            ascending: false,
          }),
      ]);

      if (dailyResult.error || monthlyResult.error) {
        setMessage(
          dailyResult.error?.message ||
            monthlyResult.error?.message ||
            "No fue posible cargar tus liquidaciones.",
        );

        setLoading(false);
        setRefreshing(false);
        return;
      }

      const dailyData =
        (dailyResult.data ?? []) as DailySettlement[];

      const monthlyData =
        (monthlyResult.data ?? []) as MonthlySettlement[];

      setDailySettlements(dailyData);
      setMonthlySettlements(monthlyData);

      const monthlyIds = monthlyData.map(
        (settlement) => settlement.id,
      );

      if (monthlyIds.length === 0) {
        setDocuments([]);
      } else {
        const { data: documentData, error: documentError } =
          await supabase
            .from("driver_cfdi_documents")
            .select(`
              id,
              monthly_settlement_id,
              document_status,
              uuid,
              fiscal_folio,
              stamped_at,
              xml_storage_path,
              pdf_storage_path,
              sat_status
            `)
            .in("monthly_settlement_id", monthlyIds)
            .order("version", {
              ascending: false,
            });

        if (documentError) {
          setMessage(documentError.message);
        } else {
          setDocuments(
            (documentData ?? []) as CfdiDocument[],
          );
        }
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router],
  );

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  function downloadDailySettlement(
    settlement: DailySettlement,
  ) {
    const validationErrors =
      settlement.validation_errors?.length > 0
        ? settlement.validation_errors
            .map((error) => `<li>${escapeHtml(error)}</li>`)
            .join("")
        : "<li>Sin observaciones</li>";

    const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Liquidación diaria AXI ${escapeHtml(
    settlement.settlement_date,
  )}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #0f172a;
    }
    h1 { margin-bottom: 4px; }
    h2 { margin-top: 32px; }
    .muted { color: #64748b; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
    }
    .label {
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
    }
    .value {
      margin-top: 6px;
      font-size: 20px;
      font-weight: bold;
    }
    .total {
      background: #0f172a;
      color: white;
    }
    @media print {
      body { margin: 20px; }
    }
  </style>
</head>
<body>
  <p class="muted">AXI Mobility</p>
  <h1>Liquidación diaria del conductor</h1>
  <p>
    ${escapeHtml(driverName)} ·
    ${escapeHtml(formatDay(settlement.settlement_date))}
  </p>

  <div class="grid">
    <div class="card">
      <div class="label">Estado</div>
      <div class="value">${escapeHtml(
        statusLabel(settlement.status),
      )}</div>
    </div>

    <div class="card">
      <div class="label">RFC</div>
      <div class="value">${escapeHtml(
        settlement.driver_rfc_snapshot || "No registrado",
      )}</div>
    </div>

    <div class="card">
      <div class="label">Viajes</div>
      <div class="value">${settlement.trip_count}</div>
    </div>

    <div class="card">
      <div class="label">Ingreso bruto de viajes</div>
      <div class="value">${escapeHtml(
        formatMoney(settlement.gross_total_amount),
      )}</div>
    </div>

    <div class="card">
      <div class="label">Comisión AXI</div>
      <div class="value">${escapeHtml(
        formatMoney(settlement.platform_commission_amount),
      )}</div>
    </div>

    <div class="card">
      <div class="label">IVA de comisión</div>
      <div class="value">${escapeHtml(
        formatMoney(
          settlement.platform_commission_iva_amount,
        ),
      )}</div>
    </div>

    <div class="card">
      <div class="label">IVA retenido</div>
      <div class="value">${escapeHtml(
        formatMoney(settlement.iva_withholding_amount),
      )}</div>
    </div>

    <div class="card">
      <div class="label">ISR retenido</div>
      <div class="value">${escapeHtml(
        formatMoney(settlement.isr_withholding_amount),
      )}</div>
    </div>

    <div class="card">
      <div class="label">Bonos e incentivos</div>
      <div class="value">${escapeHtml(
        formatMoney(
          Number(settlement.bonus_amount) +
            Number(settlement.incentive_amount),
        ),
      )}</div>
    </div>

    <div class="card">
      <div class="label">Penalizaciones</div>
      <div class="value">${escapeHtml(
        formatMoney(settlement.cancellation_fee_amount),
      )}</div>
    </div>

    <div class="card total">
      <div class="label">Resultado neto del día</div>
      <div class="value">${escapeHtml(
        formatMoney(settlement.settlement_net_amount),
      )}</div>
    </div>
  </div>

  <h2>Observaciones</h2>
  <ul>${validationErrors}</ul>

  <p class="muted">
    Documento interno de liquidación. No constituye un CFDI.
  </p>
</body>
</html>`;

    const blob = new Blob([html], {
      type: "text/html;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `axi-liquidacion-${settlement.settlement_date}.html`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-9 w-9 animate-spin" />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Cargando liquidaciones...
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-7">
      <div className="overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              Finanzas del conductor
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Liquidaciones y CFDI
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Consulta tus resultados diarios, retenciones,
              cierres mensuales y documentos fiscales.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSettlements(true)}
            disabled={refreshing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 text-sm font-black text-slate-950 transition hover:bg-yellow-300 disabled:opacity-60"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                refreshing && "animate-spin",
              )}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Viajes del mes"
          value={String(monthSummary.trips)}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Ganancia bruta"
          value={formatMoney(monthSummary.gross)}
          icon={WalletCards}
        />

        <SummaryCard
          label="Retenciones"
          value={formatMoney(monthSummary.retentions)}
          icon={ReceiptText}
        />

        <SummaryCard
          label="Resultado neto"
          value={formatMoney(monthSummary.net)}
          icon={FileCheck2}
          dark
        />
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode("daily")}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-black transition",
              viewMode === "daily"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500",
            )}
          >
            Liquidaciones diarias
          </button>

          <button
            type="button"
            onClick={() => setViewMode("monthly")}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-black transition",
              viewMode === "monthly"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500",
            )}
          >
            Cierres mensuales y CFDI
          </button>
        </div>

        <label className="flex items-center gap-3 text-sm font-bold text-slate-600">
          Mes
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) =>
              setSelectedMonth(event.target.value)
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-950 outline-none focus:border-yellow-400"
          />
        </label>
      </div>

      {viewMode === "daily" ? (
        filteredDaily.length === 0 ? (
          <EmptyState
            title="No hay liquidaciones en este mes"
            description="Las liquidaciones aparecen automáticamente después de procesar tus viajes y movimientos."
          />
        ) : (
          <div className="space-y-4">
            {filteredDaily.map((settlement) => (
              <article
                key={settlement.id}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Liquidación diaria
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      {formatDay(settlement.settlement_date)}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-black",
                        statusClasses(settlement.status),
                      )}
                    >
                      {statusLabel(settlement.status)}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        downloadDailySettlement(settlement)
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800"
                    >
                      <Download size={16} />
                      Descargar
                    </button>
                  </div>
                </div>

                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
                  <SettlementMetric
                    label="Viajes"
                    value={String(settlement.trip_count)}
                  />
                  <SettlementMetric
                    label="Ingreso bruto"
                    value={formatMoney(
                      settlement.gross_total_amount,
                    )}
                  />
                  <SettlementMetric
                    label="Comisión e IVA AXI"
                    value={formatMoney(
                      Number(
                        settlement.platform_commission_amount,
                      ) +
                        Number(
                          settlement.platform_commission_iva_amount,
                        ),
                    )}
                  />
                  <SettlementMetric
                    label="Neto del día"
                    value={formatMoney(
                      settlement.settlement_net_amount,
                    )}
                    emphasized
                  />
                </div>

                <div className="grid gap-4 px-6 py-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <DetailValue
                    label="Efectivo"
                    value={formatMoney(
                      settlement.cash_total_amount,
                    )}
                  />
                  <DetailValue
                    label="Digital"
                    value={formatMoney(
                      settlement.digital_total_amount,
                    )}
                  />
                  <DetailValue
                    label="IVA retenido"
                    value={formatMoney(
                      settlement.iva_withholding_amount,
                    )}
                  />
                  <DetailValue
                    label="ISR retenido"
                    value={formatMoney(
                      settlement.isr_withholding_amount,
                    )}
                  />
                  <DetailValue
                    label="Bonos"
                    value={formatMoney(
                      settlement.bonus_amount,
                    )}
                  />
                  <DetailValue
                    label="Incentivos"
                    value={formatMoney(
                      settlement.incentive_amount,
                    )}
                  />
                  <DetailValue
                    label="Penalizaciones"
                    value={formatMoney(
                      settlement.cancellation_fee_amount,
                    )}
                  />
                  <DetailValue
                    label="Deuda en efectivo"
                    value={formatMoney(
                      settlement.cash_debt_created_amount,
                    )}
                  />
                </div>

                {settlement.validation_errors?.length > 0 && (
                  <div className="border-t border-amber-100 bg-amber-50 px-6 py-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                      <div>
                        <p className="text-sm font-black text-amber-900">
                          Información pendiente
                        </p>

                        <ul className="mt-2 space-y-1 text-sm text-amber-800">
                          {settlement.validation_errors.map(
                            (error) => (
                              <li key={error}>• {error}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )
      ) : filteredMonthly.length === 0 ? (
        <EmptyState
          title="No hay cierre mensual"
          description="El cierre se genera automáticamente después de terminar el periodo y validar todas las liquidaciones diarias."
        />
      ) : (
        <div className="space-y-4">
          {filteredMonthly.map((settlement) => {
            const document = documentsByMonthlyId.get(
              settlement.id,
            );

            return (
              <article
                key={settlement.id}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Cierre mensual
                    </p>

                    <h2 className="mt-1 text-xl font-black capitalize text-slate-950">
                      {formatMonth(settlement.period_month)}
                    </h2>
                  </div>

                  <span
                    className={cn(
                      "w-fit rounded-full border px-3 py-1.5 text-xs font-black",
                      statusClasses(
                        document?.document_status ??
                          settlement.status,
                      ),
                    )}
                  >
                    {statusLabel(
                      document?.document_status ??
                        settlement.status,
                    )}
                  </span>
                </div>

                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
                  <SettlementMetric
                    label="Días liquidados"
                    value={String(
                      settlement.daily_settlement_count,
                    )}
                  />
                  <SettlementMetric
                    label="Viajes"
                    value={String(settlement.trip_count)}
                  />
                  <SettlementMetric
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
                  <SettlementMetric
                    label="Resultado mensual"
                    value={formatMoney(
                      settlement.settlement_net_amount,
                    )}
                    emphasized
                  />
                </div>

                <div className="px-6 py-5">
                  {document?.uuid ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                        <div className="min-w-0">
                          <p className="font-black text-emerald-900">
                            Documento fiscal timbrado
                          </p>

                          <p className="mt-2 break-all text-sm text-emerald-800">
                            UUID: {document.uuid}
                          </p>

                          <p className="mt-1 text-sm text-emerald-800">
                            Estado SAT:{" "}
                            {document.sat_status ||
                              "Pendiente de verificación"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : settlement.validation_errors?.length >
                    0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                        <div>
                          <p className="font-black text-amber-900">
                            El documento fiscal todavía no puede
                            prepararse
                          </p>

                          <ul className="mt-2 space-y-1 text-sm text-amber-800">
                            {settlement.validation_errors.map(
                              (error) => (
                                <li key={error}>• {error}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                        <div>
                          <p className="font-black text-blue-900">
                            Documento preparado
                          </p>

                          <p className="mt-2 text-sm text-blue-800">
                            AXI lo enviará automáticamente cuando
                            el PAC quede conectado.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs leading-6 text-slate-500">
        Las liquidaciones son documentos internos de AXI. El CFDI
        mensual aparecerá con UUID, XML y PDF después del timbrado
        mediante el PAC.
      </p>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  dark = false,
}: {
  label: string;
  value: string;
  icon: typeof WalletCards;
  dark?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-[1.6rem] border p-5 shadow-sm",
        dark
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          dark
            ? "bg-yellow-400 text-black"
            : "bg-yellow-100 text-yellow-700",
        )}
      >
        <Icon size={20} />
      </span>

      <p
        className={cn(
          "mt-5 text-xs font-black uppercase tracking-[0.14em]",
          dark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}

function SettlementMetric({
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
          "text-xs font-black uppercase tracking-[0.13em]",
          emphasized ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </p>

      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-black text-slate-800">{value}</p>
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
