"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveWithdrawal,
  completeWithdrawal,
  failWithdrawal,
  rejectWithdrawal,
} from "@/lib/finance/adminActions";
import { getPendingWithdrawals } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  processing: "En transferencia",
};

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const data = await getPendingWithdrawals();
      setWithdrawals(data ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los retiros."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
    errorMessage: string
  ) {
    try {
      setProcessingId(id);
      setMessage("");

      await action();
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : errorMessage
      );
    } finally {
      setProcessingId(null);
    }
  }

  function handleSendToProvider(id: string) {
    void runAction(
      id,
      () => approveWithdrawal(id),
      "No se pudo enviar el retiro a procesamiento."
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
      "No se pudo rechazar el retiro."
    );
  }

  function handleComplete(id: string) {
    const reference = window
      .prompt("Referencia de la transferencia SPEI")
      ?.trim();

    if (!reference) return;

    void runAction(
      id,
      () => completeWithdrawal(id, reference),
      "No se pudo confirmar la transferencia."
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
      "No se pudo marcar la transferencia como fallida."
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Retiros de conductores
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Control de solicitudes, transferencias en proceso y
          confirmaciones del proveedor.
        </p>
      </div>

      {message && (
        <Card className="border-red-200 bg-red-50 p-4 text-red-700">
          {message}
        </Card>
      )}

      {loading && (
        <Card className="p-8 text-center">
          Cargando...
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

          return (
            <Card
              key={withdrawal.id}
              className="space-y-5 p-6"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">
                    {withdrawal.profiles?.full_name ??
                      "Conductor"}
                  </p>

                  <p className="text-sm text-gray-500">
                    {withdrawal.profiles?.email ||
                      "Sin correo registrado"}
                  </p>

                  <p className="mt-3 text-2xl font-black">
                    {moneyFormatter.format(
                      Number(withdrawal.amount)
                    )}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {statusLabels[withdrawal.status] ??
                    withdrawal.status}
                </span>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-gray-500">Banco</p>
                  <p className="font-semibold">
                    {withdrawal.bank_name || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">
                    Titular
                  </p>
                  <p className="font-semibold">
                    {withdrawal.account_holder ||
                      "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">CLABE</p>
                  <p className="font-mono font-semibold">
                    {withdrawal.clabe || "No registrada"}
                  </p>
                </div>
              </div>

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
                        handleComplete(withdrawal.id)
                      }
                    >
                      Confirmar pago
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
              </div>
            </Card>
          );
        })}

      {!loading && withdrawals.length === 0 && (
        <Card className="p-8 text-center">
          No hay retiros pendientes ni transferencias en proceso.
        </Card>
      )}
    </div>
  );
}
