"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  processTripPaymentChargeback,
} from "@/lib/finance/adminActions";
import {
  getChargebackPayments,
} from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ChargebackPayment = {
  id: string;
  trip_id: string | null;
  passenger_id: string | null;
  driver_id: string | null;

  method: string;
  status: string;

  total_amount: number | string;
  external_amount: number | string | null;
  passenger_wallet_applied: number | string | null;
  driver_net_earnings: number | string | null;

  provider: string | null;
  provider_payment_id: string | null;

  paid_at: string | null;
  chargeback_at: string | null;

  chargeback_reason: string | null;
  chargeback_provider_reference: string | null;
  chargeback_provider_payload:
    | Record<string, unknown>
    | null;

  chargeback_available_recovered:
    | number
    | string
    | null;

  chargeback_driver_debt_created:
    | number
    | string
    | null;

  chargeback_passenger_wallet_restored:
    | number
    | string
    | null;

  wallet_released_at: string | null;
  wallet_reversed_at: string | null;

  created_at: string | null;
  updated_at: string | null;
};

type ChargebackForm = {
  paymentId: string;
  reason: string;
  providerReference: string;
};

const emptyForm: ChargebackForm = {
  paymentId: "",
  reason: "",
  providerReference: "",
};

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function money(
  value: number | string | null | undefined,
) {
  return moneyFormatter.format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  return dateFormatter.format(new Date(value));
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    card: "Tarjeta",
    mercado_pago: "Mercado Pago",
  };

  return labels[method] ?? method;
}

export default function ChargebacksPage() {
  const [payments, setPayments] = useState<
    ChargebackPayment[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [form, setForm] =
    useState<ChargebackForm>(emptyForm);

  const loadPayments = useCallback(
    async (refresh = false) => {
      try {
        setMessage("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await getChargebackPayments();

        setPayments(
          (data ?? []) as ChargebackPayment[],
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los pagos.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const cleanSearch = search
      .trim()
      .toLowerCase();

    return payments.filter((payment) => {
      const matchesStatus =
        statusFilter === "all" ||
        payment.status === statusFilter;

      const matchesSearch =
        !cleanSearch ||
        payment.id.toLowerCase().includes(
          cleanSearch,
        ) ||
        payment.trip_id
          ?.toLowerCase()
          .includes(cleanSearch) ||
        payment.provider_payment_id
          ?.toLowerCase()
          .includes(cleanSearch) ||
        payment.chargeback_provider_reference
          ?.toLowerCase()
          .includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [payments, search, statusFilter]);

  const totals = useMemo(() => {
    return payments.reduce(
      (current, payment) => {
        if (payment.status === "paid") {
          current.eligibleCount += 1;
          current.eligibleAmount += Number(
            payment.total_amount ?? 0,
          );
        }

        if (payment.status === "charged_back") {
          current.chargebackCount += 1;
          current.chargebackAmount += Number(
            payment.total_amount ?? 0,
          );

          current.recoveredAmount += Number(
            payment
              .chargeback_available_recovered ?? 0,
          );

          current.debtCreated += Number(
            payment
              .chargeback_driver_debt_created ?? 0,
          );

          current.walletRestored += Number(
            payment
              .chargeback_passenger_wallet_restored ??
              0,
          );
        }

        return current;
      },
      {
        eligibleCount: 0,
        eligibleAmount: 0,
        chargebackCount: 0,
        chargebackAmount: 0,
        recoveredAmount: 0,
        debtCreated: 0,
        walletRestored: 0,
      },
    );
  }, [payments]);

  function openChargebackForm(
    payment: ChargebackPayment,
  ) {
    setForm({
      paymentId: payment.id,
      reason: "",
      providerReference:
        payment.chargeback_provider_reference ||
        "",
    });
  }

  async function submitChargeback() {
    const reason = form.reason.trim();

    const providerReference =
      form.providerReference.trim();

    if (!reason) {
      setMessage(
        "El motivo del contracargo es obligatorio.",
      );
      return;
    }

    if (!providerReference) {
      setMessage(
        "La referencia del proveedor es obligatoria.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Esta acción recuperará saldo del conductor, podrá crear deuda, restaurará Wallet AXI y reversará las pólizas del pago. ¿Continuar?",
    );

    if (!confirmed) return;

    try {
      setProcessingId(form.paymentId);
      setMessage("");

      await processTripPaymentChargeback({
        paymentId: form.paymentId,
        reason,
        providerReference,
      });

      setMessage(
        "El contracargo fue procesado correctamente.",
      );

      setForm(emptyForm);
      await loadPayments(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo procesar el contracargo.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-7 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              AXI Finanzas
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Contracargos
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Procesa contracargos de pagos digitales,
              recupera fondos del conductor, crea deuda
              cuando sea necesario y restaura el saldo
              interno utilizado por el pasajero.
            </p>
          </div>

          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() =>
              void loadPayments(true)
            }
          >
            {refreshing
              ? "Actualizando..."
              : "Actualizar"}
          </Button>
        </div>
      </section>

      {message && (
        <Card className="border-blue-200 bg-blue-50 p-4 text-blue-800">
          {message}
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Pagos elegibles
          </p>

          <p className="mt-2 text-3xl font-black">
            {totals.eligibleCount}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {money(totals.eligibleAmount)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Contracargos procesados
          </p>

          <p className="mt-2 text-3xl font-black">
            {totals.chargebackCount}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {money(totals.chargebackAmount)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Recuperado del conductor
          </p>

          <p className="mt-2 text-3xl font-black">
            {money(totals.recoveredAmount)}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Saldo disponible recuperado
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Deuda creada
          </p>

          <p className="mt-2 text-3xl font-black">
            {money(totals.debtCreated)}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Wallet restaurado:{" "}
            {money(totals.walletRestored)}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_220px]">
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Buscar pago, viaje, referencia o ID del proveedor"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <option value="all">
            Todos los estados
          </option>

          <option value="paid">
            Elegibles
          </option>

          <option value="charged_back">
            Procesados
          </option>
        </select>
      </section>

      {loading && (
        <Card className="p-10 text-center">
          Cargando pagos digitales...
        </Card>
      )}

      {!loading &&
        filteredPayments.map((payment) => {
          const isChargedBack =
            payment.status === "charged_back";

          const processing =
            processingId === payment.id;

          return (
            <Card
              key={payment.id}
              className="space-y-5 p-6"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Pago digital
                  </p>

                  <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-700">
                    {payment.id}
                  </p>

                  <p className="mt-3 text-3xl font-black text-slate-950">
                    {money(payment.total_amount)}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {paymentMethodLabel(
                      payment.method,
                    )}{" "}
                    · Pagado:{" "}
                    {formatDate(payment.paid_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold",
                      isChargedBack
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700",
                    ].join(" ")}
                  >
                    {isChargedBack
                      ? "Contracargado"
                      : "Elegible"}
                  </span>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {paymentMethodLabel(
                      payment.method,
                    )}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-slate-500">
                    Viaje
                  </p>

                  <p className="break-all font-semibold">
                    {payment.trip_id || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    Pago externo
                  </p>

                  <p className="font-semibold">
                    {money(payment.external_amount)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    Wallet pasajero aplicada
                  </p>

                  <p className="font-semibold">
                    {money(
                      payment.passenger_wallet_applied,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    Ganancia neta conductor
                  </p>

                  <p className="font-semibold">
                    {money(
                      payment.driver_net_earnings,
                    )}
                  </p>
                </div>
              </div>

              {isChargedBack && (
                <>
                  <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-slate-500">
                        Referencia proveedor
                      </p>

                      <p className="break-all font-semibold">
                        {payment
                          .chargeback_provider_reference ||
                          "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Recuperado
                      </p>

                      <p className="font-semibold">
                        {money(
                          payment
                            .chargeback_available_recovered,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Deuda creada
                      </p>

                      <p className="font-semibold">
                        {money(
                          payment
                            .chargeback_driver_debt_created,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Wallet restaurado
                      </p>

                      <p className="font-semibold">
                        {money(
                          payment
                            .chargeback_passenger_wallet_restored,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <strong>Motivo:</strong>{" "}
                    {payment.chargeback_reason ||
                      "Sin motivo registrado"}
                    <br />
                    <strong>Procesado:</strong>{" "}
                    {formatDate(
                      payment.chargeback_at,
                    )}
                  </div>
                </>
              )}

              {!isChargedBack && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      processing ||
                      !payment.wallet_released_at
                    }
                    onClick={() =>
                      openChargebackForm(payment)
                    }
                  >
                    Procesar contracargo
                  </Button>

                  {!payment.wallet_released_at && (
                    <p className="self-center text-xs text-amber-700">
                      La ganancia del conductor todavía
                      no ha sido liberada.
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}

      {!loading &&
        filteredPayments.length === 0 && (
          <Card className="p-10 text-center">
            No existen pagos con estos filtros.
          </Card>
        )}

      {form.paymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-950">
              Procesar contracargo
            </h2>

            <p className="mt-2 break-all text-xs text-slate-500">
              Pago: {form.paymentId}
            </p>

            <div className="mt-5 grid gap-4">
              <textarea
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Motivo confirmado por el proveedor"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={form.providerReference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    providerReference:
                      event.target.value,
                  }))
                }
                placeholder="Referencia del contracargo"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setForm(emptyForm)
                }
              >
                Cancelar
              </Button>

              <Button
                disabled={
                  processingId === form.paymentId
                }
                onClick={() =>
                  void submitChargeback()
                }
              >
                Confirmar contracargo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
