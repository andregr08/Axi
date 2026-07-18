"use client";

import { useEffect, useState } from "react";
import { getPendingWithdrawals } from "@/lib/finance/withdrawals";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    getPendingWithdrawals().then(setWithdrawals);
  }, []);

  return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold">
        Retiros pendientes
      </h1>

      {withdrawals.map((withdrawal) => (
        <Card
          key={withdrawal.id}
          className="p-6 flex items-center justify-between"
        >
          <div>
            <p className="font-semibold">
              {withdrawal.driver?.full_name ?? "Conductor"}
            </p>

            <p className="text-gray-500">
              ${Number(withdrawal.amount).toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button>
              Aprobar
            </Button>

            <Button variant="outline">
              Rechazar
            </Button>
          </div>

        </Card>
      ))}

      {!withdrawals.length && (
        <Card className="p-8 text-center">
          No hay retiros pendientes.
        </Card>
      )}

    </div>
  );
}
