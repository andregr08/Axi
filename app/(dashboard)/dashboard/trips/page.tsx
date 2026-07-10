"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TripStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type Trip = {
  id: string;
  origin_address: string;
  destination_address: string;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
};

const statusName: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadTrips() {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("trips")
      .select(
        "id, origin_address, destination_address, status, estimated_price, final_price, requested_at"
      )
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error cargando viajes:", error.message);
    } else {
      setTrips(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTrips();
  }, []);

  async function cancelTrip(tripId: string) {
    const confirmed = window.confirm(
      "¿Seguro que quieres cancelar este viaje?"
    );

    if (!confirmed) return;

    setCancellingId(tripId);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setCancellingId(null);
      return;
    }

    const { error } = await supabase
      .from("trips")
      .update({
        status: "cancelled",
        cancelled_by: session.user.id,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelado por el pasajero",
      })
      .eq("id", tripId)
      .in("status", ["requested", "searching", "accepted"]);

    if (error) {
      alert(`Error al cancelar: ${error.message}`);
    } else {
      await loadTrips();
    }

    setCancellingId(null);
  }

  const activeTrips = trips.filter(
    (trip) => !["completed", "cancelled"].includes(trip.status)
  );

  const completedTrips = trips.filter(
    (trip) => trip.status === "completed"
  );

  const cancelledTrips = trips.filter(
    (trip) => trip.status === "cancelled"
  );

  if (loading) {
    return <p>Cargando viajes...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Gestión de viajes
        </p>

        <h1 className="text-3xl font-bold text-gray-900">Viajes</h1>

        <p className="mt-2 text-gray-600">
          Consulta tus viajes activos, completados y cancelados.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes activos</p>
          <p className="mt-3 text-3xl font-bold">{activeTrips.length}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes completados</p>
          <p className="mt-3 text-3xl font-bold">{completedTrips.length}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes cancelados</p>
          <p className="mt-3 text-3xl font-bold">{cancelledTrips.length}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Historial de viajes</h2>
            <p className="mt-1 text-sm text-gray-500">
              Los viajes guardados en Supabase aparecen aquí.
            </p>
          </div>

          <Link
            href="/dashboard/trips/new"
            className="rounded-lg bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800"
          >
            Solicitar viaje
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                No hay viajes registrados
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Solicita tu primer viaje para comenzar.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => {
              const canCancel = [
                "requested",
                "searching",
                "accepted",
              ].includes(trip.status);

              return (
                <div key={trip.id} className="rounded-xl border p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <p className="font-semibold">
                        {trip.origin_address}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        hacia {trip.destination_address}
                      </p>

                      <p className="mt-2 text-xs text-gray-400">
                        {new Date(trip.requested_at).toLocaleString("es-MX")}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      <div className="text-left md:text-right">
                        <p className="font-semibold">
                          {statusName[trip.status]}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          $
                          {(
                            trip.final_price ??
                            trip.estimated_price ??
                            0
                          ).toFixed(2)}
                        </p>
                      </div>

                      {canCancel && (
                        <button
                          onClick={() => cancelTrip(trip.id)}
                          disabled={cancellingId === trip.id}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancellingId === trip.id
                            ? "Cancelando..."
                            : "Cancelar viaje"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
