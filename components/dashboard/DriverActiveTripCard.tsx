"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";

type ActiveTrip = {
  id: string;
  status:
    | "accepted"
    | "driver_arriving"
    | "driver_arrived"
    | "in_progress";
  origin_address: string | null;
  destination_address: string | null;
  estimated_price: number | string | null;
};

const ACTIVE_STATUSES: ActiveTrip["status"][] = [
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

const CANCELLABLE_STATUSES: ActiveTrip["status"][] = [
  "accepted",
  "driver_arriving",
  "driver_arrived",
];

export function DriverActiveTripCard() {
  const [trip, setTrip] =
    useState<ActiveTrip | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [cancelling, setCancelling] =
    useState(false);

  const loadTrip = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setTrip(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("trips")
      .select(
        "id, status, origin_address, destination_address, estimated_price"
      )
      .eq("driver_id", session.user.id)
      .in("status", ACTIVE_STATUSES)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Error cargando viaje activo:",
        error.message
      );
      setTrip(null);
    } else {
      setTrip(data as ActiveTrip | null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  function getStatusLabel(
    status: ActiveTrip["status"]
  ) {
    switch (status) {
      case "accepted":
        return "Viaje aceptado";
      case "driver_arriving":
        return "En camino por el pasajero";
      case "driver_arrived":
        return "Esperando al pasajero";
      case "in_progress":
        return "Viaje en curso";
      default:
        return "Viaje activo";
    }
  }

  function formatMoney(
    value: ActiveTrip["estimated_price"]
  ) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value ?? 0));
  }

  async function cancelTrip() {
    if (
      !trip ||
      cancelling ||
      !CANCELLABLE_STATUSES.includes(
        trip.status
      )
    ) {
      return;
    }

    const fee =
      trip.status === "driver_arrived"
        ? 40
        : 20;

    const confirmed = window.confirm(
      "¿Seguro que quieres cancelar este viaje? " +
        "Se aplicará una penalización de $" +
        fee +
        " MXN y AXI buscará otro conductor."
    );

    if (!confirmed) return;

    setCancelling(true);

    const { error } = await supabase.rpc(
      "driver_cancel_trip",
      {
        requested_trip_id: trip.id,
        cancellation_reason_value:
          "Cancelado por el conductor",
      }
    );

    if (error) {
      window.alert(
        "No fue posible cancelar el viaje: " +
          error.message
      );
      setCancelling(false);
      return;
    }

    window.alert(
      "Viaje cancelado. Penalización aplicada: $" +
        fee +
        " MXN."
    );

    setTrip(null);
    setCancelling(false);
  }

  if (loading || !trip) {
    return null;
  }

  return (
    <Card className="border-blue-100 bg-white">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
        Tu viaje activo
      </p>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black text-slate-950">
            {getStatusLabel(trip.status)}
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Origen
              </p>
              <p className="mt-2 text-sm font-bold text-slate-800">
                {trip.origin_address ||
                  "Origen del viaje"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Destino
              </p>
              <p className="mt-2 text-sm font-bold text-slate-800">
                {trip.destination_address ||
                  "Destino del viaje"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:w-80">
          <p className="text-center text-2xl font-black text-slate-950">
            {formatMoney(trip.estimated_price)}
          </p>

          <Link
            href={"/dashboard/trips/" + trip.id}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-slate-950 px-5 font-black text-white"
          >
            Ver detalles
          </Link>

          {CANCELLABLE_STATUSES.includes(
            trip.status
          ) && (
            <button
              type="button"
              onClick={() => void cancelTrip()}
              disabled={cancelling}
              className="flex min-h-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 font-black text-red-700 disabled:opacity-50"
            >
              {cancelling
                ? "Cancelando..."
                : trip.status === "driver_arrived"
                  ? "Cancelar viaje - Penalización $40 MXN"
                  : "Cancelar viaje - Penalización $20 MXN"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
