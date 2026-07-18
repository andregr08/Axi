"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveWithdrawal,
  rejectWithdrawal,
} from "@/lib/finance/adminActions";
import { getPendingWithdrawals } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getPendingWithdrawals();
      setWithdrawals(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(id: string) {
    try {
      setProcessingId(id);

      await approveWithdrawal(id);

      await load();
    } catch (error) {
      console.error(error);
      alert("No se pudo aprobar el retiro.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    const reason =
      window.prompt("Motivo del rechazo")?.trim() || "Rechazado por administrador";

    try {
      setProcessingId(id);

      await rejectWithdrawal(id, reason);

      await load();
    } catch (error) {
      console.error(error);
      alert("No se pudo rechazar el retiro.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold">
        Retiros pendientes
      </h1>

      {loading && (
        <Card className="p-8 text-center">
          Cargando...
        </Card>
      )}

      {!loading &&
        withdrawals.map((withdrawal) => (
          <Card
            key={withdrawal.id}
            className="flex items-center justify-between p-6"
          >
            <div>
              <p className="font-semibold">
                {withdrawal.profiles?.full_name ??
                  "Conductor"}
              </p>

              <p className="text-sm text-gray-500">
                {withdrawal.profiles?.email}
              </p>

              <p className="mt-2 text-lg font-bold">
                $
                {Number(withdrawal.amount).toLocaleString(
                  "es-MX",
                  {
                    minimumFractionDigits: 2,
                  }
                )}
              </p>
            </div>

            <div className="flex gap-2">

              <Button
                disabled={processingId === withdrawal.id}
                onClick={() =>
                  handleApprove(withdrawal.id)
                }
              >
                Aprobar
              </Button>

              <Button
                variant="outline"
                disabled={processingId === withdrawal.id}
                onClick={() =>
                  handleReject(withdrawal.id)
                }
              >
                Rechazar
              </Button>

            </div>

          </Card>
        ))}

      {!loading && withdrawals.length === 0 && (
        <Card className="p-8 text-center">
          No hay retiros pendientes.
        </Card>
      )}

    </div>
  );
}
