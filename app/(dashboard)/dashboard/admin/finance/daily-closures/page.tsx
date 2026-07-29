"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Download,
  FileCheck2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import {
  closeFinanceDay,
  FinanceDailyClosure,
  getFinanceDailyClosures,
  reopenFinanceDay,
  verifyFinanceClosure,
} from "@/lib/finance/dailyClosures";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
  }).format(
    new Date(`${value}T12:00:00`),
  );
}

function dateTimeLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function todayInMexico() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escapeCsv(value: string | number) {
  const text = String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function exportClosureCsv(
  closure: FinanceDailyClosure,
) {
  const rows: Array<[string, string | number]> = [
    ["Folio", closure.closure_folio],
    ["Fecha financiera", closure.finance_date],
    ["Estado", closure.status],
    ["Pagos completados", closure.paid_payments],
    ["Ingreso bruto", closure.gross_revenue],
    ["Comisión AXI", closure.platform_commission],
    [
      "Ganancia bruta conductores",
      closure.gross_driver_earnings,
    ],
    [
      "Ganancia neta conductores",
      closure.net_driver_earnings,
    ],
    ["Efectivo", closure.cash_amount],
    ["Digital", closure.digital_amount],
    [
      "IVA comisión AXI",
      closure.platform_commission_iva,
    ],
    ["Retención IVA", closure.iva_withholding],
    ["Retención ISR", closure.isr_withholding],
    ["Reembolsos pendientes", closure.pending_refunds],
    [
      "Monto reembolsos pendientes",
      closure.pending_refund_amount,
    ],
    ["Retiros abiertos", closure.open_withdrawals],
    [
      "Monto retiros abiertos",
      closure.open_withdrawal_amount,
    ],
    ["Deuda de efectivo", closure.cash_debt_total],
    [
      "Wallet disponible",
      closure.available_wallet_balance,
    ],
    [
      "Wallet pendiente",
      closure.pending_wallet_balance,
    ],
    [
      "Wallet reservado",
      closure.reserved_wallet_balance,
    ],
    [
      "Transacciones publicadas",
      closure.posted_financial_transactions,
    ],
    [
      "Transacciones pendientes",
      closure.pending_financial_transactions,
    ],
    [
      "Transacciones revertidas",
      closure.reversed_financial_transactions,
    ],
    [
      "Pagos sin conciliar",
      closure.unreconciled_payments,
    ],
    [
      "Monto sin conciliar",
      closure.unreconciled_amount,
    ],
    ["Hash de integridad", closure.integrity_hash],
    [
      "Integridad válida",
      closure.integrity_valid ? "Sí" : "No",
    ],
    ["Cerrado el", closure.closed_at],
    [
      "Reabierto el",
      closure.reopened_at ?? "",
    ],
    [
      "Razón de reapertura",
      closure.reopening_reason ?? "",
    ],
  ];

  const csv = [
    ["Concepto", "Valor"].map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(","),
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `${closure.closure_folio}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export default function FinanceDailyClosuresPage() {
  const [closures, setClosures] = useState<
    FinanceDailyClosure[]
  >([]);

  const [selectedDate, setSelectedDate] =
    useState(todayInMexico());

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const [reopeningId, setReopeningId] =
    useState<string | null>(null);

  const [reopeningReason, setReopeningReason] =
    useState("");

  const loadClosures = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const result =
        await getFinanceDailyClosures();

      setClosures(result);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los cierres.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClosures();
  }, [loadClosures]);

  const activeDates = useMemo(
    () =>
      new Set(
        closures
          .filter(
            (closure) =>
              closure.status === "closed",
          )
          .map(
            (closure) => closure.finance_date,
          ),
      ),
    [closures],
  );

  async function handleCloseDay() {
    try {
      setWorking(true);
      setMessage("");
      setErrorMessage("");

      const closure = await closeFinanceDay(
        selectedDate,
      );

      setMessage(
        `Cierre ${closure.closure_folio} creado correctamente.`,
      );

      await loadClosures();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cerrar el día.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleVerify(
    closure: FinanceDailyClosure,
  ) {
    try {
      setWorking(true);
      setMessage("");
      setErrorMessage("");

      const result =
        await verifyFinanceClosure(
          closure.id,
        );

      if (result.is_valid) {
        setMessage(
          `La integridad de ${result.closure_folio} es válida.`,
        );
      } else {
        setErrorMessage(
          `El cierre ${result.closure_folio} presenta una alteración.`,
        );
      }

      await loadClosures();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo verificar el cierre.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleReopen() {
    if (!reopeningId) {
      return;
    }

    try {
      setWorking(true);
      setMessage("");
      setErrorMessage("");

      const closure = await reopenFinanceDay(
        reopeningId,
        reopeningReason,
      );

      setMessage(
        `El cierre ${closure.closure_folio} fue reabierto.`,
      );

      setReopeningId(null);
      setReopeningReason("");

      await loadClosures();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo reabrir el cierre.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">
              Centro financiero
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Cierres diarios
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Congela los resultados financieros de cada
              fecha, genera un folio y protege el cierre
              mediante un hash de integridad.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadClosures()}
            disabled={loading || working}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 text-sm font-black transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Actualizar
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {errorMessage}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-yellow-100 p-3 text-yellow-700">
                <LockKeyhole className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Crear cierre financiero
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Solo se permite un cierre activo por
                  fecha.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                Fecha
              </span>

              <input
                type="date"
                value={selectedDate}
                max={todayInMexico()}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value,
                  )
                }
                className="h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-yellow-500"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleCloseDay()}
              disabled={
                working ||
                activeDates.has(selectedDate)
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 text-sm font-black text-slate-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}

              {activeDates.has(selectedDate)
                ? "Fecha ya cerrada"
                : "Cerrar día"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-slate-950">
            Historial de cierres
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Consulta, verifica y exporta cada cierre.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <RefreshCw className="h-7 w-7 animate-spin text-slate-400" />
          </div>
        ) : closures.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
            <FileCheck2 className="h-10 w-10 text-slate-300" />

            <p className="mt-3 font-black text-slate-900">
              Todavía no hay cierres
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Selecciona una fecha para crear el primero.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {closures.map((closure) => (
              <article
                key={closure.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-5 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-2xl p-3 ${
                        closure.integrity_valid
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {closure.integrity_valid ? (
                        <ShieldCheck className="h-6 w-6" />
                      ) : (
                        <ShieldAlert className="h-6 w-6" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-950">
                          {closure.closure_folio}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            closure.status === "closed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {closure.status === "closed"
                            ? "Cerrado"
                            : "Reabierto"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {dateLabel(
                          closure.finance_date,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Cerrado:{" "}
                        {dateTimeLabel(
                          closure.closed_at,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleVerify(closure)
                      }
                      disabled={working}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Verificar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        exportClosureCsv(closure)
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </button>

                    {closure.status === "closed" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReopeningId(
                            closure.id,
                          );
                          setReopeningReason("");
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-black text-amber-800 transition hover:bg-amber-100"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reabrir
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [
                      "Ingreso bruto",
                      money(
                        closure.gross_revenue,
                      ),
                    ],
                    [
                      "Comisión AXI",
                      money(
                        closure.platform_commission,
                      ),
                    ],
                    [
                      "Conductores neto",
                      money(
                        closure.net_driver_earnings,
                      ),
                    ],
                    [
                      "Pagos",
                      String(
                        closure.paid_payments,
                      ),
                    ],
                    [
                      "Efectivo",
                      money(
                        closure.cash_amount,
                      ),
                    ],
                    [
                      "Digital",
                      money(
                        closure.digital_amount,
                      ),
                    ],
                    [
                      "Deuda efectivo",
                      money(
                        closure.cash_debt_total,
                      ),
                    ],
                    [
                      "Sin conciliar",
                      String(
                        closure.unreconciled_payments,
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="bg-white p-4"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {label}
                      </p>

                      <p className="mt-1 text-lg font-black text-slate-950">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-slate-100 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Hash SHA-256
                  </p>

                  <code className="block overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-emerald-300">
                    {closure.integrity_hash}
                  </code>

                  {closure.reopening_reason && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>
                        Razón de reapertura:
                      </strong>{" "}
                      {closure.reopening_reason}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {reopeningId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-950">
              Reabrir cierre
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Esta acción solo funciona para usuarios con
              rol super_admin y quedará registrada en la
              auditoría.
            </p>

            <textarea
              value={reopeningReason}
              onChange={(event) =>
                setReopeningReason(
                  event.target.value,
                )
              }
              placeholder="Explica la razón de la reapertura..."
              rows={5}
              className="mt-5 w-full rounded-2xl border border-slate-300 p-4 text-sm outline-none focus:border-yellow-500"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setReopeningId(null);
                  setReopeningReason("");
                }}
                disabled={working}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleReopen()
                }
                disabled={
                  working ||
                  reopeningReason.trim().length < 10
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-white disabled:opacity-50"
              >
                {working && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                Confirmar reapertura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
