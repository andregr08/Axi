"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "admin" | "driver" | "passenger";

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
  passenger_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  origin_address: string;
  destination_address: string;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const statusLabels: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "Viaje en curso",
  completed: "Viaje completado",
  cancelled: "Viaje cancelado",
};

const nextDriverAction: Partial<
  Record<
    TripStatus,
    {
      status: TripStatus;
      label: string;
    }
  >
> = {
  accepted: {
    status: "driver_arriving",
    label: "Voy en camino",
  },
  driver_arriving: {
    status: "driver_arrived",
    label: "Ya llegué",
  },
  driver_arrived: {
    status: "in_progress",
    label: "Iniciar viaje",
  },
  in_progress: {
    status: "completed",
    label: "Finalizar viaje",
  },
};

export default function ActiveTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        setMessage("No fue posible cargar tu perfil.");
        setLoading(false);
        return;
      }

      setRole(profile.role as UserRole);

      await loadTrip();

      const channelName = `trip-${id}-${crypto.randomUUID()}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trips",
            filter: `id=eq.${id}`,
          },
          () => {
            loadTrip();
          }
        )
        .subscribe();
    }

    start();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [id, router]);

  async function loadTrip() {
    const { data, error } = await supabase
      .from("trips")
      .select(`
        id,
        passenger_id,
        driver_id,
        vehicle_id,
        origin_address,
        destination_address,
        status,
        estimated_price,
        final_price,
        requested_at,
        accepted_at,
        started_at,
        completed_at
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      setMessage(
        `No fue posible cargar el viaje: ${
          error?.message ?? "Viaje no encontrado"
        }`
      );
      setLoading(false);
      return;
    }

    const loadedTrip = data as Trip;
    setTrip(loadedTrip);

    const userIds = [
      loadedTrip.passenger_id,
      loadedTrip.driver_id,
    ].filter(Boolean) as string[];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const passenger = profiles?.find(
        (profile) => profile.id === loadedTrip.passenger_id
      );

      const driver = profiles?.find(
        (profile) => profile.id === loadedTrip.driver_id
      );

      setPassengerName(
        passenger?.full_name || "Pasajero sin nombre"
      );

      setDriverName(
        loadedTrip.driver_id
          ? driver?.full_name || "Conductor sin nombre"
          : "Sin asignar"
      );
    }

    setLoading(false);
  }

  async function advanceStatus(nextStatus: TripStatus) {
    if (!trip) return;

    const confirmed = window.confirm(
      `¿Confirmas la acción "${statusLabels[nextStatus]}"?`
    );

    if (!confirmed) return;

    setProcessing(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "advance_trip_status",
      {
        trip_id: trip.id,
        next_status: nextStatus,
      }
    );

    if (error) {
      setMessage(`Error actualizando viaje: ${error.message}`);
    } else {
      setMessage("Estado del viaje actualizado.");
      await loadTrip();
    }

    setProcessing(false);
  }

  if (loading) {
    return <p>Cargando viaje...</p>;
  }

  if (!trip) {
    return (
      <section>
        <p className="rounded-xl bg-red-50 p-4 text-red-700">
          {message || "El viaje no existe."}
        </p>
      </section>
    );
  }

  const driverAction = nextDriverAction[trip.status];

  const progress = [
    "accepted",
    "driver_arriving",
    "driver_arrived",
    "in_progress",
    "completed",
  ];

  const currentProgressIndex = progress.indexOf(trip.status);

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1 text-sm font-medium text-gray-500">
            Viaje activo
          </p>

          <h1 className="text-3xl font-bold text-gray-900">
            {statusLabels[trip.status]}
          </h1>

          <p className="mt-2 text-gray-600">
            La información se actualizará automáticamente.
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard/trips")}
          className="rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
        >
          Volver a mis viajes
        </button>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="mb-8 rounded-2xl bg-white p-7 shadow-sm">
        <h2 className="mb-6 text-xl font-bold">
          Progreso del viaje
        </h2>

        <div className="grid gap-3 md:grid-cols-5">
          {progress.map((status, index) => {
            const completed =
              currentProgressIndex >= index ||
              trip.status === "completed";

            return (
              <div
                key={status}
                className={`rounded-xl border p-4 text-center ${
                  completed
                    ? "border-black bg-black text-white"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                <p className="text-sm font-semibold">
                  {statusLabels[status as TripStatus]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Recorrido
          </h2>

          <div className="space-y-5">
            <div>
              <p className="text-sm text-gray-500">
                Punto de partida
              </p>
              <p className="mt-1 font-semibold">
                {trip.origin_address}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Destino
              </p>
              <p className="mt-1 font-semibold">
                {trip.destination_address}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Precio
              </p>
              <p className="mt-1 text-2xl font-bold">
                $
                {(
                  trip.final_price ??
                  trip.estimated_price ??
                  0
                ).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Participantes
          </h2>

          <div className="space-y-5">
            <div>
              <p className="text-sm text-gray-500">
                Pasajero
              </p>
              <p className="mt-1 font-semibold">
                {passengerName}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Conductor
              </p>
              <p className="mt-1 font-semibold">
                {driverName}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Estado
              </p>
              <p className="mt-1 font-semibold">
                {statusLabels[trip.status]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {role === "driver" &&
        driverAction &&
        trip.status !== "completed" &&
        trip.status !== "cancelled" && (
          <div className="mt-8 rounded-2xl bg-white p-7 shadow-sm">
            <p className="mb-4 text-sm text-gray-500">
              Acción del conductor
            </p>

            <button
              onClick={() =>
                advanceStatus(driverAction.status)
              }
              disabled={processing}
              className="w-full rounded-xl bg-black py-4 text-lg font-semibold text-white disabled:opacity-50"
            >
              {processing
                ? "Actualizando..."
                : driverAction.label}
            </button>
          </div>
        )}

      {trip.status === "completed" && (
        <div className="mt-8 rounded-2xl bg-green-50 p-7 text-center">
          <h2 className="text-2xl font-bold text-green-700">
            Viaje completado
          </h2>

          <p className="mt-2 text-green-700">
            El viaje terminó correctamente.
          </p>
        </div>
      )}

      {trip.status === "cancelled" && (
        <div className="mt-8 rounded-2xl bg-red-50 p-7 text-center">
          <h2 className="text-2xl font-bold text-red-700">
            Viaje cancelado
          </h2>
        </div>
      )}
    </section>
  );
}
