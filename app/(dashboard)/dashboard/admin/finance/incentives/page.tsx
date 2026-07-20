"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveIncentive,
  rejectIncentive,
} from "@/lib/finance/adminActions";
import { getPendingIncentives } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function IncentivesPage() {
  const [incentives, setIncentives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getPendingIncentives();
      setIncentives(data ?? []);
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

      await approveIncentive(id);

      await load();
    } catch (error) {
      console.error(error);
      alert("No se pudo aprobar el incentivo.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    const reason =
      window.prompt("Motivo del rechazo")?.trim() ||
      "Rechazado por administrador";

    try {
      setProcessingId(id);

      await rejectIncentive(id, reason);

      await load();
    } catch (error) {
      console.error(error);
      alert("No se pudo rechazar el incentivo.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold">
        Incentivos pendientes
      </h1>

      {loading && (
        <Card className="p-8 text-center">
          Cargando...
        </Card>
      )}

      {!loading &&
        incentives.map((incentive) => (
          <Card
            key={incentive.id}
            className="flex items-center justify-between p-6"
          >
            <div>
              <p className="font-semibold">
                {incentive.profiles?.full_name ??
                  "Conductor"}
              </p>

              <p className="text-sm text-gray-500">
                {incentive.profiles?.email}
              </p>

              <p className="mt-2 text-lg font-bold">
                $
                {Number(incentive.amount).toLocaleString(
                  "es-MX",
                  {
                    minimumFractionDigits: 2,
                  }
                )}
              </p>
            </div>

            <div className="flex gap-2">

              <Button
                disabled={processingId === incentive.id}
                onClick={() => handleApprove(incentive.id)}
              >
                Aprobar
              </Button>

              <Button
                variant="outline"
                disabled={processingId === incentive.id}
                onClick={() => handleReject(incentive.id)}
              >
                Rechazar
              </Button>

            </div>

          </Card>
        ))}

      {!loading && incentives.length === 0 && (
        <Card className="p-8 text-center">
          No hay incentivos pendientes.
        </Card>
      )}

    </div>
  );
}
