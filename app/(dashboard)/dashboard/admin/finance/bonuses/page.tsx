"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveBonus,
  rejectBonus,
} from "@/lib/finance/adminActions";
import { getPendingBonuses } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function BonusesPage() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getPendingBonuses();
      setBonuses(data ?? []);
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

      await approveBonus(id);

      await load();
    } catch (error) {
      console.error(error);
      alert("No se pudo aprobar el bono.");
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

      await rejectBonus(id, reason);

      await load();
    } catch (error) {
      console.error(error);
      alert("No se pudo rechazar el bono.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold">
        Bonos pendientes
      </h1>

      {loading && (
        <Card className="p-8 text-center">
          Cargando...
        </Card>
      )}

      {!loading &&
        bonuses.map((bonus) => (
          <Card
            key={bonus.id}
            className="flex items-center justify-between p-6"
          >
            <div>
              <p className="font-semibold">
                {bonus.profiles?.full_name ??
                  "Conductor"}
              </p>

              <p className="text-sm text-gray-500">
                {bonus.profiles?.email}
              </p>

              <p className="mt-2 text-lg font-bold">
                $
                {Number(bonus.amount).toLocaleString(
                  "es-MX",
                  {
                    minimumFractionDigits: 2,
                  }
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={processingId === bonus.id}
                onClick={() =>
                  handleApprove(bonus.id)
                }
              >
                Aprobar
              </Button>

              <Button
                variant="outline"
                disabled={processingId === bonus.id}
                onClick={() =>
                  handleReject(bonus.id)
                }
              >
                Rechazar
              </Button>
            </div>
          </Card>
        ))}

      {!loading && bonuses.length === 0 && (
        <Card className="p-8 text-center">
          No hay bonos pendientes.
        </Card>
      )}

    </div>
  );
}
