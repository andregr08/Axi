"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  approveRefund,
  cancelOriginalPaymentRefund,
  completeOriginalPaymentRefund,
  failOriginalPaymentRefund,
  reconcileOriginalPaymentRefund,
  rejectRefund,
  reverseOriginalPaymentRefund,
  startOriginalPaymentRefund,
} from "@/lib/finance/adminActions";
import { getPendingRefunds } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RefundRow = {
  id: string;
  trip_id: string | null;
  passenger_id: string | null;
  passenger_name: string | null;

  amount: number | string;
  reason: string;
  notes: string | null;
  status: string;

  refund_destination: string | null;

  payment_transaction_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_total_amount: number | string | null;
  passenger_wallet_applied: number | string | null;
  external_amount: number | string | null;
  provider_payment_id: string | null;

  provider: string | null;
  provider_status: string | null;
  provider_reference: string | null;
  provider_refund_id: string | null;

  external_refund_amount: number | string | null;
  completed_refund_amount: number | string | null;

  processing_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;

  failure_reason: string | null;
  cancellation_reason: string | null;

  wallet_transaction_id: string | null;
  credited_at: string | null;

  financial_transaction_id: string | null;
  financial_transaction_status: string | null;

  reversal_financial_transaction_id: string | null;
  reversal_financial_transaction_status: string | null;

  reconciliation_status: string | null;
  reconciled_at: string | null;
  reconciliation_notes: string | null;

  requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string | null;
};

type StartForm = {
  id: string;
  provider: string;
};

type CompleteForm = {
  id: string;
  providerReference: string;
  providerRefundId: string;
  completedAmount: string;
};

type ReconciliationForm = {
  id: string;
  status: "matched" | "mismatch";
  notes: string;
};

const emptyStartForm: StartForm = {
  id: "",
  provider: "",
};

const emptyCompleteForm: CompleteForm = {
  id: "",
  providerReference: "",
  providerRefundId: "",
  completedAmount: "",
};

const emptyReconciliationForm: ReconciliationForm = {
  id: "",
  status: "matched",
  notes: "",
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

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  processing: "En proceso",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
  rejected: "Rechazado",
};

const destinationLabels: Record<string, string> = {
  passenger_wallet: "Wallet AXI",
  original_payment: "Método original",
};

const providerStatusLabels: Record<string, string> = {
  not_required: "No requerido",
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

const reconciliationLabels: Record<string, string> = {
  pending: "Pendiente",
  matched: "Conciliado",
  mismatch: "Con diferencia",
  not_required: "No requerida",
};

function money(value: number | string | null | undefined) {
  return moneyFormatter.format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  return dateFormatter.format(new Date(value));
}

function paymentMethodLabel(method: string | null) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    mercado_pago: "Mercado Pago",
  };

  return method ? labels[method] ?? method : "Sin método";
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [startForm, setStartForm] =
    useState<StartForm>(emptyStartForm);

  const [completeForm, setCompleteForm] =
    useState<CompleteForm>(emptyCompleteForm);

  const [reconciliationForm, setReconciliationForm] =
    useState<ReconciliationForm>(
      emptyReconciliationForm,
    );

  const loadRefunds = useCallback(
    async (refresh = false) => {
      try {
        setMessage("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await getPendingRefunds();
        setRefunds((data ?? []) as RefundRow[]);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los reembolsos.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  const totals = useMemo(() => {
    return refunds.reduce(
      (current, refund) => {
        const amount = Number(refund.amount ?? 0);

        if (refund.status === "pending") {
          current.pendingCount += 1;
          current.pendingAmount += amount;
        }

        if (refund.status === "processing") {
          current.processingCount += 1;
          current.processingAmount += Number(
            refund.external_refund_amount ?? amount,
          );
        }

        if (
          refund.status === "completed" &&
          refund.reconciliation_status === "pending"
        ) {
          current.pendingReconciliationCount += 1;
          current.pendingReconciliationAmount += Number(
            refund.completed_refund_amount ?? amount,
          );
        }

        if (
          refund.reconciliation_status === "mismatch"
        ) {
          current.mismatchCount += 1;
          current.mismatchAmount += Number(
            refund.completed_refund_amount ?? amount,
          );
        }

        return current;
      },
      {
        pendingCount: 0,
        pendingAmount: 0,
        processingCount: 0,
        processingAmount: 0,
        pendingReconciliationCount: 0,
        pendingReconciliationAmount: 0,
        mismatchCount: 0,
        mismatchAmount: 0,
      },
    );
  }, [refunds]);

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
    successMessage: string,
    errorMessage: string,
  ) {
    try {
      setProcessingId(id);
      setMessage("");

      await action();
      setMessage(successMessage);
      await loadRefunds(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : errorMessage,
      );
    } finally {
      setProcessingId(null);
    }
  }

  function handleApproveWallet(refund: RefundRow) {
    const confirmed = window.confirm(
      `¿Abonar ${money(refund.amount)} en la Wallet AXI del pasajero?`,
    );

    if (!confirmed) return;

    void runAction(
      refund.id,
      () => approveRefund(refund.id),
      "El reembolso fue abonado a la Wallet AXI.",
      "No se pudo abonar el reembolso a la Wallet AXI.",
    );
  }

  function handleReject(refund: RefundRow) {
    const reason = window
      .prompt("Motivo del rechazo")
      ?.trim();

    if (!reason) return;

    void runAction(
      refund.id,
      () => rejectRefund(refund.id, reason),
      "La solicitud de reembolso fue rechazada.",
      "No se pudo rechazar el reembolso.",
    );
  }

  function openStartForm(refund: RefundRow) {
    setStartForm({
      id: refund.id,
      provider: refund.provider || "",
    });
  }

  async function submitStartForm() {
    const provider = startForm.provider.trim();

    if (!provider) {
      setMessage("El proveedor de pagos es obligatorio.");
      return;
    }

    await runAction(
      startForm.id,
      () =>
        startOriginalPaymentRefund({
          id: startForm.id,
          provider,
        }),
      "El reembolso fue enviado al proveedor.",
      "No se pudo iniciar el reembolso externo.",
    );

    setStartForm(emptyStartForm);
  }

  function openCompleteForm(refund: RefundRow) {
    setCompleteForm({
      id: refund.id,
      providerReference:
        refund.provider_reference || "",
      providerRefundId:
        refund.provider_refund_id || "",
      completedAmount: String(
        Number(
          refund.external_refund_amount ??
            refund.amount ??
            0,
        ).toFixed(2),
      ),
    });
  }

  async function submitCompleteForm() {
    const providerReference =
      completeForm.providerReference.trim();

    const providerRefundId =
      completeForm.providerRefundId.trim();

    const completedAmount =
      Number(completeForm.completedAmount);

    if (!providerReference) {
      setMessage(
        "La referencia del proveedor es obligatoria.",
      );
      return;
    }

    if (!providerRefundId) {
      setMessage(
        "El ID del reembolso del proveedor es obligatorio.",
      );
      return;
    }

    if (
      !Number.isFinite(completedAmount) ||
      completedAmount <= 0
    ) {
      setMessage(
        "El monto completado debe ser mayor que cero.",
      );
      return;
    }

    await runAction(
      completeForm.id,
      () =>
        completeOriginalPaymentRefund({
          id: completeForm.id,
          providerReference,
          providerRefundId,
          completedAmount,
        }),
      "El reembolso del proveedor fue confirmado.",
      "No se pudo completar el reembolso externo.",
    );

    setCompleteForm(emptyCompleteForm);
  }

  function handleFail(refund: RefundRow) {
    const reason = window
      .prompt("Motivo del fallo del proveedor")
      ?.trim();

    if (!reason) return;

    const reference = window
      .prompt(
        "Referencia del proveedor, si existe",
        refund.provider_reference || "",
      )
      ?.trim();

    void runAction(
      refund.id,
      () =>
        failOriginalPaymentRefund({
          id: refund.id,
          failureReason: reason,
          providerReference: reference,
        }),
      "El reembolso fue marcado como fallido.",
      "No se pudo marcar el reembolso como fallido.",
    );
  }

  function handleCancel(refund: RefundRow) {
    const reason = window
      .prompt("Motivo de la cancelación")
      ?.trim();

    if (!reason) return;

    void runAction(
      refund.id,
      () =>
        cancelOriginalPaymentRefund({
          id: refund.id,
          cancellationReason: reason,
        }),
      "El reembolso fue cancelado.",
      "No se pudo cancelar el reembolso.",
    );
  }

  function handleReverse(refund: RefundRow) {
    const reason = window
      .prompt(
        "Motivo de la reversa contable y operativa",
      )
      ?.trim();

    if (!reason) return;

    const confirmed = window.confirm(
      "Esta acción generará una póliza inversa. ¿Continuar?",
    );

    if (!confirmed) return;

    void runAction(
      refund.id,
      () =>
        reverseOriginalPaymentRefund({
          id: refund.id,
          reversalReason: reason,
        }),
      "El reembolso fue reversado.",
      "No se pudo reversar el reembolso.",
    );
  }

  function openReconciliationForm(refund: RefundRow) {
    setReconciliationForm({
      id: refund.id,
      status:
        refund.reconciliation_status === "mismatch"
          ? "mismatch"
          : "matched",
      notes: refund.reconciliation_notes || "",
    });
  }

  async function submitReconciliationForm() {
    await runAction(
      reconciliationForm.id,
      () =>
        reconcileOriginalPaymentRefund({
          id: reconciliationForm.id,
          status: reconciliationForm.status,
          notes: reconciliationForm.notes,
        }),
      "El reembolso fue conciliado.",
      "No se pudo conciliar el reembolso.",
    );

    setReconciliationForm(
      emptyReconciliationForm,
    );
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
              Reembolsos
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Gestión de devoluciones a Wallet AXI o al
              método de pago original, con proveedor,
              conciliación y trazabilidad contable.
            </p>
          </div>

          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void loadRefunds(true)}
          >
            {refreshing ? "Actualizando..." : "Actualizar"}
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
            Solicitudes pendientes
          </p>
          <p className="mt-2 text-3xl font-black">
            {totals.pendingCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {money(totals.pendingAmount)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Procesando con proveedor
          </p>
          <p className="mt-2 text-3xl font-black">
            {totals.processingCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {money(totals.processingAmount)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Conciliación pendiente
          </p>
          <p className="mt-2 text-3xl font-black">
            {totals.pendingReconciliationCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {money(
              totals.pendingReconciliationAmount,
            )}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Diferencias detectadas
          </p>
          <p className="mt-2 text-3xl font-black">
            {totals.mismatchCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {money(totals.mismatchAmount)}
          </p>
        </Card>
      </section>

      {loading && (
        <Card className="p-10 text-center">
          Cargando reembolsos...
        </Card>
      )}

      {!loading &&
        refunds.map((refund) => {
          const processing =
            processingId === refund.id;

          const canChooseDestination =
            refund.status === "pending";

          const canComplete =
            refund.status === "processing" &&
            refund.refund_destination ===
              "original_payment";

          const canFailOrCancel =
            refund.status === "processing" &&
            refund.refund_destination ===
              "original_payment";

          const canReconcile =
            refund.status === "completed" &&
            refund.refund_destination ===
              "original_payment";

          const canReverse =
            refund.status === "completed" &&
            refund.refund_destination ===
              "original_payment" &&
            !refund.reversal_financial_transaction_id;

          return (
            <Card
              key={refund.id}
              className="space-y-5 p-6"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-lg font-black text-slate-950">
                    {refund.passenger_name ||
                      "Pasajero"}
                  </p>

                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {money(refund.amount)}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {refund.reason}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Solicitado:{" "}
                    {formatDate(
                      refund.requested_at ||
                        refund.created_at,
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {statusLabels[refund.status] ??
                      refund.status}
                  </span>

                  {refund.refund_destination && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {destinationLabels[
                        refund.refund_destination
                      ] ??
                        refund.refund_destination}
                    </span>
                  )}

                  {refund.reconciliation_status && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {reconciliationLabels[
                        refund.reconciliation_status
                      ] ??
                        refund.reconciliation_status}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-slate-500">
                    Método de pago
                  </p>
                  <p className="font-semibold">
                    {paymentMethodLabel(
                      refund.payment_method,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    Total del pago
                  </p>
                  <p className="font-semibold">
                    {money(
                      refund.payment_total_amount,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    Pagado externamente
                  </p>
                  <p className="font-semibold">
                    {money(refund.external_amount)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    Wallet aplicada
                  </p>
                  <p className="font-semibold">
                    {money(
                      refund.passenger_wallet_applied,
                    )}
                  </p>
                </div>
              </div>

              {refund.refund_destination ===
                "original_payment" && (
                <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-slate-500">
                      Proveedor
                    </p>
                    <p className="font-semibold">
                      {refund.provider || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Estado proveedor
                    </p>
                    <p className="font-semibold">
                      {refund.provider_status
                        ? providerStatusLabels[
                            refund.provider_status
                          ] ??
                          refund.provider_status
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Referencia
                    </p>
                    <p className="break-all font-semibold">
                      {refund.provider_reference || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      ID del reembolso
                    </p>
                    <p className="break-all font-semibold">
                      {refund.provider_refund_id || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Monto externo solicitado
                    </p>
                    <p className="font-semibold">
                      {money(
                        refund.external_refund_amount,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Monto completado
                    </p>
                    <p className="font-semibold">
                      {money(
                        refund.completed_refund_amount,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Póliza original
                    </p>
                    <p className="break-all font-semibold">
                      {refund.financial_transaction_id ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Póliza de reversa
                    </p>
                    <p className="break-all font-semibold">
                      {refund
                        .reversal_financial_transaction_id ||
                        "—"}
                    </p>
                  </div>
                </div>
              )}

              {refund.failure_reason && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <strong>Fallo:</strong>{" "}
                  {refund.failure_reason}
                </div>
              )}

              {refund.cancellation_reason && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong>Cancelación:</strong>{" "}
                  {refund.cancellation_reason}
                </div>
              )}

              {refund.reconciliation_notes && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <strong>Conciliación:</strong>{" "}
                  {refund.reconciliation_notes}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canChooseDestination && (
                  <>
                    <Button
                      disabled={processing}
                      onClick={() =>
                        handleApproveWallet(refund)
                      }
                    >
                      Abonar Wallet AXI
                    </Button>

                    <Button
                      variant="outline"
                      disabled={
                        processing ||
                        !refund.payment_transaction_id ||
                        Number(refund.external_amount) <= 0
                      }
                      onClick={() =>
                        openStartForm(refund)
                      }
                    >
                      Reembolsar método original
                    </Button>

                    <Button
                      variant="outline"
                      disabled={processing}
                      onClick={() =>
                        handleReject(refund)
                      }
                    >
                      Rechazar
                    </Button>
                  </>
                )}

                {canComplete && (
                  <Button
                    disabled={processing}
                    onClick={() =>
                      openCompleteForm(refund)
                    }
                  >
                    Confirmar reembolso
                  </Button>
                )}

                {canFailOrCancel && (
                  <>
                    <Button
                      variant="outline"
                      disabled={processing}
                      onClick={() =>
                        handleFail(refund)
                      }
                    >
                      Marcar fallido
                    </Button>

                    <Button
                      variant="outline"
                      disabled={processing}
                      onClick={() =>
                        handleCancel(refund)
                      }
                    >
                      Cancelar
                    </Button>
                  </>
                )}

                {canReconcile && (
                  <Button
                    variant="outline"
                    disabled={processing}
                    onClick={() =>
                      openReconciliationForm(refund)
                    }
                  >
                    Conciliar
                  </Button>
                )}

                {canReverse && (
                  <Button
                    variant="outline"
                    disabled={processing}
                    onClick={() =>
                      handleReverse(refund)
                    }
                  >
                    Reversar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}

      {!loading && refunds.length === 0 && (
        <Card className="p-10 text-center">
          No existen reembolsos para mostrar.
        </Card>
      )}

      {startForm.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black">
              Iniciar reembolso externo
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Registra el proveedor que procesará la
              devolución al método original.
            </p>

            <input
              value={startForm.provider}
              onChange={(event) =>
                setStartForm((current) => ({
                  ...current,
                  provider: event.target.value,
                }))
              }
              placeholder="Proveedor de pagos"
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3"
            />

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setStartForm(emptyStartForm)
                }
              >
                Cancelar
              </Button>

              <Button
                disabled={
                  processingId === startForm.id
                }
                onClick={() =>
                  void submitStartForm()
                }
              >
                Iniciar devolución
              </Button>
            </div>
          </div>
        </div>
      )}

      {completeForm.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black">
              Confirmar reembolso del proveedor
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                value={
                  completeForm.providerReference
                }
                onChange={(event) =>
                  setCompleteForm((current) => ({
                    ...current,
                    providerReference:
                      event.target.value,
                  }))
                }
                placeholder="Referencia del proveedor"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={completeForm.providerRefundId}
                onChange={(event) =>
                  setCompleteForm((current) => ({
                    ...current,
                    providerRefundId:
                      event.target.value,
                  }))
                }
                placeholder="ID del reembolso"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={completeForm.completedAmount}
                onChange={(event) =>
                  setCompleteForm((current) => ({
                    ...current,
                    completedAmount:
                      event.target.value,
                  }))
                }
                placeholder="Monto completado"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setCompleteForm(
                    emptyCompleteForm,
                  )
                }
              >
                Cancelar
              </Button>

              <Button
                disabled={
                  processingId === completeForm.id
                }
                onClick={() =>
                  void submitCompleteForm()
                }
              >
                Confirmar devolución
              </Button>
            </div>
          </div>
        </div>
      )}

      {reconciliationForm.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black">
              Conciliar reembolso
            </h2>

            <div className="mt-5 grid gap-4">
              <select
                value={reconciliationForm.status}
                onChange={(event) =>
                  setReconciliationForm(
                    (current) => ({
                      ...current,
                      status: event.target
                        .value as ReconciliationForm["status"],
                    }),
                  )
                }
                className="rounded-xl border border-slate-200 px-4 py-3"
              >
                <option value="matched">
                  Conciliado
                </option>
                <option value="mismatch">
                  Con diferencia
                </option>
              </select>

              <textarea
                value={reconciliationForm.notes}
                onChange={(event) =>
                  setReconciliationForm(
                    (current) => ({
                      ...current,
                      notes: event.target.value,
                    }),
                  )
                }
                rows={4}
                placeholder="Notas de conciliación"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setReconciliationForm(
                    emptyReconciliationForm,
                  )
                }
              >
                Cancelar
              </Button>

              <Button
                disabled={
                  processingId ===
                  reconciliationForm.id
                }
                onClick={() =>
                  void submitReconciliationForm()
                }
              >
                Guardar conciliación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
