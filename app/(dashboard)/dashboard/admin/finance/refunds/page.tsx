"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  approveRefund,
  rejectRefund,
} from "@/lib/finance/adminActions";
import { getPendingRefunds } from "@/lib/finance/adminQueries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RefundRow = {
  id: string;
  passenger_id: string | null;
  trip_id: string | null;
  amount: number | string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string | null;
  requested_at: string | null;
  profiles?: {
    id?: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  trips?: {
    id?: string;
    origin_address?: string | null;
    destination_address?: string | null;
  } | null;
};

function money(value: number | string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadRefunds = useCallback(async (refresh = false) => {
    try {
      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getPendingRefunds();
      setRefunds((data ?? []) as RefundRow[]);
    } catch (loadError) {
      console.error(loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los reembolsos."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  async function handleApprove(refund: RefundRow) {
    const confirmed = window.confirm(
      `¿Aprobar el reembolso de ${money(refund.amount)}?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(refund.id);
      await approveRefund(refund.id);
      await loadRefunds(true);
    } catch (actionError) {
      console.error(actionError);

      alert(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo aprobar el reembolso."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(refund: RefundRow) {
    const reason = window.prompt(
      "Escribe el motivo del rechazo:"
    )?.trim();

    if (!reason) return;

    try {
      setProcessingId(refund.id);
      await rejectRefund(refund.id, reason);
      await loadRefunds(true);
    } catch (actionError) {
      console.error(actionError);

      alert(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo rechazar el reembolso."
      );
    } finally {
      setProcessingId(null);
    }
  }

  const totalPending = refunds.reduce(
    (total, refund) => total + Number(refund.amount ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Finanzas
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
            Reembolsos
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Revisa y procesa las solicitudes pendientes.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={refreshing}
          onClick={() => void loadRefunds(true)}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Solicitudes pendientes
              </p>

              <p className="mt-2 text-3xl font-bold text-neutral-950">
                {refunds.length}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-100 p-3">
              <RotateCcw className="h-5 w-5 text-neutral-700" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Monto pendiente
              </p>

              <p className="mt-2 text-3xl font-bold text-neutral-950">
                {money(totalPending)}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-100 p-3">
              <CircleDollarSign className="h-5 w-5 text-neutral-700" />
            </div>
          </div>
        </Card>
      </div>

      {loading ? (
        <Card className="flex min-h-64 items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="font-semibold text-red-800">
            No se pudieron cargar los reembolsos
          </p>

          <p className="mt-1 text-sm text-red-700">
            {error}
          </p>
        </Card>
      ) : refunds.length === 0 ? (
        <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-neutral-300" />

          <p className="font-semibold text-neutral-900">
            No hay reembolsos pendientes
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            Todas las solicitudes han sido procesadas.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => {
            const processing = processingId === refund.id;

            return (
              <Card key={refund.id} className="p-6">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-bold text-neutral-950">
                          {refund.profiles?.full_name ||
                            "Pasajero sin nombre"}
                        </p>

                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          Pendiente
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-neutral-500">
                        {refund.profiles?.email ||
                          refund.passenger_id ||
                          "Sin información del pasajero"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-neutral-600">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-neutral-800">
                          Viaje:
                        </span>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span>
                            {refund.trips?.origin_address ||
                              "Origen no disponible"}
                          </span>

                          <ArrowRight className="h-4 w-4 shrink-0" />

                          <span>
                            {refund.trips?.destination_address ||
                              "Destino no disponible"}
                          </span>
                        </div>
                      </div>

                      <p>
                        <span className="font-semibold text-neutral-800">
                          Motivo:
                        </span>{" "}
                        {refund.reason}
                      </p>

                      <p>
                        <span className="font-semibold text-neutral-800">
                          Solicitado:
                        </span>{" "}
                        {formatDate(
                          refund.requested_at || refund.created_at
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-4 xl:items-end">
                    <div>
                      <p className="text-sm font-medium text-neutral-500 xl:text-right">
                        Monto solicitado
                      </p>

                      <p className="text-2xl font-bold text-neutral-950">
                        {money(refund.amount)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        disabled={processing}
                        onClick={() => void handleReject(refund)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Rechazar
                      </Button>

                      <Button
                        disabled={processing}
                        onClick={() => void handleApprove(refund)}
                      >
                        {processing ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}

                        Aprobar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
