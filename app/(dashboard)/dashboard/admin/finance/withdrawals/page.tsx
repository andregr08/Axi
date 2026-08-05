"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  approveWithdrawal,
  completeWithdrawalWithSpei,
  failWithdrawal,
  reconcileWithdrawal,
  rejectWithdrawal,
} from "@/lib/finance/adminActions";
import { getPendingWithdrawals } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type WithdrawalRow = {
  id: string;
  driver_id: string;
  driver_name: string | null;
  amount: number | string;
  status: string;

  bank_name: string | null;
  account_holder: string | null;
  clabe: string | null;

  transfer_provider: string | null;
  provider_reference: string | null;
  provider_transfer_id: string | null;
  spei_tracking_key: string | null;
  receipt_url: string | null;

  reconciliation_status: string | null;
  reconciliation_notes: string | null;

  failure_reason: string | null;
  notes: string | null;

  requested_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
};

type SpeiForm = {
  id: string;
  transferProvider: string;
  providerReference: string;
  providerTransferId: string;
  speiTrackingKey: string;
  receiptUrl: string;
};

type ReconciliationForm = {
  id: string;
  status: "matched" | "mismatch" | "not_required";
  notes: string;
};

const emptySpeiForm: SpeiForm = {
  id: "",
  transferProvider: "SPEI",
  providerReference: "",
  providerTransferId: "",
  speiTrackingKey: "",
  receiptUrl: "",
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
  processing: "En transferencia",
  paid: "Pagado",
  failed: "Fallido",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

const reconciliationLabels: Record<string, string> = {
  pending: "Pendiente",
  matched: "Conciliado",
  mismatch: "Con diferencia",
  not_required: "No requerida",
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return dateFormatter.format(new Date(value));
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");

  const [speiForm, setSpeiForm] =
    useState<SpeiForm>(emptySpeiForm);

  const [reconciliationForm, setReconciliationForm] =
    useState<ReconciliationForm>(emptyReconciliationForm);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const data = await getPendingWithdrawals();
      setWithdrawals((data ?? []) as WithdrawalRow[]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los retiros.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    return withdrawals.reduce(
      (current, withdrawal) => {
        const amount = Number(withdrawal.amount ?? 0);

        if (
          withdrawal.status === "pending" ||
          withdrawal.status === "approved" ||
          withdrawal.status === "processing"
        ) {
          current.openCount += 1;
          current.openAmount += amount;
        }

        if (
          withdrawal.status === "paid" &&
          withdrawal.reconciliation_status === "pending"
        ) {
          current.pendingReconciliationCount += 1;
          current.pendingReconciliationAmount += amount;
        }

        if (
          withdrawal.reconciliation_status === "mismatch"
        ) {
          current.mismatchCount += 1;
          current.mismatchAmount += amount;
        }

        return current;
      },
      {
        openCount: 0,
        openAmount: 0,
        pendingReconciliationCount: 0,
        pendingReconciliationAmount: 0,
        mismatchCount: 0,
        mismatchAmount: 0,
      },
    );
  }, [withdrawals]);

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
      await load();
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

  function handleSendToProvider(id: string) {
    void runAction(
      id,
      () => approveWithdrawal(id),
      "El retiro fue enviado a procesamiento.",
      "No se pudo enviar el retiro a procesamiento.",
    );
  }

  function handleReject(id: string) {
    const reason = window
      .prompt("Motivo del rechazo")
      ?.trim();

    if (!reason) return;

    void runAction(
      id,
      () => rejectWithdrawal(id, reason),
      "El retiro fue rechazado y la reserva fue liberada.",
      "No se pudo rechazar el retiro.",
    );
  }

  function handleFail(id: string) {
    const reason = window
      .prompt("Motivo del fallo de la transferencia")
      ?.trim();

    if (!reason) return;

    void runAction(
      id,
      () => failWithdrawal(id, reason),
      "La transferencia fue marcada como fallida.",
      "No se pudo marcar la transferencia como fallida.",
    );
  }

  function openSpeiForm(withdrawal: WithdrawalRow) {
    setSpeiForm({
      id: withdrawal.id,
      transferProvider:
        withdrawal.transfer_provider || "SPEI",
      providerReference:
        withdrawal.provider_reference || "",
      providerTransferId:
        withdrawal.provider_transfer_id || "",
      speiTrackingKey:
        withdrawal.spei_tracking_key || "",
      receiptUrl:
        withdrawal.receipt_url || "",
    });
  }

  async function submitSpeiForm() {
    const provider = speiForm.transferProvider.trim();
    const reference = speiForm.providerReference.trim();

    if (!provider) {
      setMessage("El proveedor de transferencia es obligatorio.");
      return;
    }

    if (!reference) {
      setMessage("La referencia del proveedor es obligatoria.");
      return;
    }

    await runAction(
      speiForm.id,
      () =>
        completeWithdrawalWithSpei({
          id: speiForm.id,
          transferProvider: provider,
          providerReference: reference,
          providerTransferId:
            speiForm.providerTransferId,
          speiTrackingKey:
            speiForm.speiTrackingKey,
          receiptUrl:
            speiForm.receiptUrl,
        }),
      "El retiro fue pagado y registrado con datos SPEI.",
      "No se pudo confirmar la transferencia SPEI.",
    );

    setSpeiForm(emptySpeiForm);
  }

  function openReconciliationForm(withdrawal: WithdrawalRow) {
    setReconciliationForm({
      id: withdrawal.id,
      status:
        withdrawal.reconciliation_status === "mismatch"
          ? "mismatch"
          : withdrawal.reconciliation_status ===
              "not_required"
            ? "not_required"
            : "matched",
      notes:
        withdrawal.reconciliation_notes || "",
    });
  }

  async function submitReconciliation() {
    await runAction(
      reconciliationForm.id,
      () =>
        reconcileWithdrawal({
          id: reconciliationForm.id,
          status: reconciliationForm.status,
          notes: reconciliationForm.notes,
        }),
      "El retiro fue conciliado.",
      "No se pudo conciliar el retiro.",
    );

    setReconciliationForm(emptyReconciliationForm);
  }

  return (
    <div className="space-y-7 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
          AXI Finanzas
        </p>

        <h1 className="mt-3 text-3xl font-black sm:text-4xl">
          Retiros y transferencias SPEI
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Control de solicitudes, reservas, transferencias,
          comprobantes, claves de rastreo y conciliación bancaria.
        </p>
      </section>

      {message && (
        <Card className="border-blue-200 bg-blue-50 p-4 text-blue-800">
          {message}
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Retiros abiertos
          </p>
          <p className="mt-2 text-3xl font-black">
            {totals.openCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {moneyFormatter.format(totals.openAmount)}
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
            {moneyFormatter.format(
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
            {moneyFormatter.format(totals.mismatchAmount)}
          </p>
        </Card>
      </section>

      {loading && (
        <Card className="p-8 text-center">
          Cargando retiros...
        </Card>
      )}

      {!loading &&
        withdrawals.map((withdrawal) => {
          const isProcessing =
            processingId === withdrawal.id;

          const canReject =
            withdrawal.status === "pending";

          const canSend =
            withdrawal.status === "pending";

          const canResolve =
            withdrawal.status === "approved" ||
            withdrawal.status === "processing";

          const canReconcile =
            withdrawal.status === "paid";

          return (
            <Card
              key={withdrawal.id}
              className="space-y-5 p-6"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">
                    {withdrawal.driver_name || "Conductor"}
                  </p>

                  <p className="mt-3 text-3xl font-black text-slate-950">
                    {moneyFormatter.format(
                      Number(withdrawal.amount),
                    )}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Solicitado:{" "}
                    {formatDate(withdrawal.requested_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {statusLabels[withdrawal.status] ??
                      withdrawal.status}
                  </span>

                  {withdrawal.reconciliation_status && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {reconciliationLabels[
                        withdrawal.reconciliation_status
                      ] ??
                        withdrawal.reconciliation_status}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-slate-500">Banco</p>
                  <p className="font-semibold">
                    {withdrawal.bank_name || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Titular</p>
                  <p className="font-semibold">
                    {withdrawal.account_holder ||
                      "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">CLABE</p>
                  <p className="font-mono font-semibold">
                    {withdrawal.clabe || "No registrada"}
                  </p>
                </div>
              </div>

              {(withdrawal.transfer_provider ||
                withdrawal.provider_reference ||
                withdrawal.spei_tracking_key) && (
                <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-slate-500">
                      Proveedor
                    </p>
                    <p className="font-semibold">
                      {withdrawal.transfer_provider || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Referencia
                    </p>
                    <p className="break-all font-semibold">
                      {withdrawal.provider_reference || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      ID transferencia
                    </p>
                    <p className="break-all font-semibold">
                      {withdrawal.provider_transfer_id || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Clave SPEI
                    </p>
                    <p className="break-all font-semibold">
                      {withdrawal.spei_tracking_key || "—"}
                    </p>
                  </div>
                </div>
              )}

              {withdrawal.receipt_url && (
                <a
                  href={withdrawal.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm font-black text-blue-700 hover:underline"
                >
                  Ver comprobante de transferencia
                </a>
              )}

              {withdrawal.failure_reason && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {withdrawal.failure_reason}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canSend && (
                  <Button
                    disabled={isProcessing}
                    onClick={() =>
                      handleSendToProvider(withdrawal.id)
                    }
                  >
                    Enviar a transferencia
                  </Button>
                )}

                {canReject && (
                  <Button
                    variant="outline"
                    disabled={isProcessing}
                    onClick={() =>
                      handleReject(withdrawal.id)
                    }
                  >
                    Rechazar
                  </Button>
                )}

                {canResolve && (
                  <>
                    <Button
                      disabled={isProcessing}
                      onClick={() =>
                        openSpeiForm(withdrawal)
                      }
                    >
                      Registrar pago SPEI
                    </Button>

                    <Button
                      variant="outline"
                      disabled={isProcessing}
                      onClick={() =>
                        handleFail(withdrawal.id)
                      }
                    >
                      Marcar fallido
                    </Button>
                  </>
                )}

                {canReconcile && (
                  <Button
                    variant="outline"
                    disabled={isProcessing}
                    onClick={() =>
                      openReconciliationForm(withdrawal)
                    }
                  >
                    Conciliar retiro
                  </Button>
                )}
              </div>
            </Card>
          );
        })}

      {!loading && withdrawals.length === 0 && (
        <Card className="p-8 text-center">
          No existen retiros para mostrar.
        </Card>
      )}

      {speiForm.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-950">
              Registrar transferencia SPEI
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                value={speiForm.transferProvider}
                onChange={(event) =>
                  setSpeiForm((current) => ({
                    ...current,
                    transferProvider: event.target.value,
                  }))
                }
                placeholder="Proveedor de transferencia"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={speiForm.providerReference}
                onChange={(event) =>
                  setSpeiForm((current) => ({
                    ...current,
                    providerReference: event.target.value,
                  }))
                }
                placeholder="Referencia del proveedor"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={speiForm.providerTransferId}
                onChange={(event) =>
                  setSpeiForm((current) => ({
                    ...current,
                    providerTransferId: event.target.value,
                  }))
                }
                placeholder="ID de transferencia"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={speiForm.speiTrackingKey}
                onChange={(event) =>
                  setSpeiForm((current) => ({
                    ...current,
                    speiTrackingKey: event.target.value,
                  }))
                }
                placeholder="Clave de rastreo SPEI"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={speiForm.receiptUrl}
                onChange={(event) =>
                  setSpeiForm((current) => ({
                    ...current,
                    receiptUrl: event.target.value,
                  }))
                }
                placeholder="URL del comprobante"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setSpeiForm(emptySpeiForm)
                }
              >
                Cancelar
              </Button>

              <Button
                disabled={processingId === speiForm.id}
                onClick={() => void submitSpeiForm()}
              >
                Confirmar pago
              </Button>
            </div>
          </div>
        </div>
      )}

      {reconciliationForm.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-950">
              Conciliar retiro
            </h2>

            <div className="mt-5 grid gap-4">
              <select
                value={reconciliationForm.status}
                onChange={(event) =>
                  setReconciliationForm((current) => ({
                    ...current,
                    status: event.target.value as
                      ReconciliationForm["status"],
                  }))
                }
                className="rounded-xl border border-slate-200 px-4 py-3"
              >
                <option value="matched">Conciliado</option>
                <option value="mismatch">
                  Con diferencia
                </option>
                <option value="not_required">
                  No requerida
                </option>
              </select>

              <textarea
                value={reconciliationForm.notes}
                onChange={(event) =>
                  setReconciliationForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Notas de conciliación"
                rows={4}
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
                  processingId === reconciliationForm.id
                }
                onClick={() =>
                  void submitReconciliation()
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
