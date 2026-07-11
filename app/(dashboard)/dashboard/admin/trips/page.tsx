"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  passenger_id: string;
  driver_id: string | null;
  origin_address: string;
  destination_address: string;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
};

type ProfileName = {
  id: string;
  full_name: string | null;
};

const statusLabels: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function AdminTripsPage() {
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    void loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTrips() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (currentProfile?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const { data: tripsData, error: tripsError } = await supabase
      .from("trips")
      .select(`
        id,
        passenger_id,
        driver_id,
        origin_address,
        destination_address,
        status,
        estimated_price,
        final_price,
        requested_at
      `)
      .order("requested_at", { ascending: false });

    if (tripsError) {
      setMessage(`Error cargando viajes: ${tripsError.message}`);
      setLoading(false);
      return;
    }

    const loadedTrips = (tripsData ?? []) as Trip[];
    setTrips(loadedTrips);

    const userIds = Array.from(
      new Set(
        loadedTrips.flatMap((trip) =>
          trip.driver_id
            ? [trip.passenger_id, trip.driver_id]
            : [trip.passenger_id]
        )
      )
    );

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const nameMap = ((profilesData ?? []) as ProfileName[]).reduce(
        (result, profile) => {
          result[profile.id] = profile.full_name || "Usuario sin nombre";
          return result;
        },
        {} as Record<string, string>
      );

      setNames(nameMap);
    }

    setLoading(false);
  }

  const activeCount = trips.filter(
    (trip) => !["completed", "cancelled"].includes(trip.status)
  ).length;

  const completedCount = trips.filter(
    (trip) => trip.status === "completed"
  ).length;

  const cancelledCount = trips.filter(
    (trip) => trip.status === "cancelled"
  ).length;

  if (loading) {
    return <p>Cargando viajes...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Viajes
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta todos los viajes registrados en AXI.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes activos</p>
          <p className="mt-3 text-3xl font-bold">{activeCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Completados</p>
          <p className="mt-3 text-3xl font-bold">{completedCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Cancelados</p>
          <p className="mt-3 text-3xl font-bold">{cancelledCount}</p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {trips.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              No hay viajes registrados.
            </p>
          </div>
        ) : (
          trips.map((trip) => (
            <article
              key={trip.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row">
                <div>
                  <h2 className="text-lg font-bold">
                    {trip.origin_address}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    hacia {trip.destination_address}
                  </p>

                  <p className="mt-3 text-sm text-gray-500">
                    Pasajero: {names[trip.passenger_id] || "Sin identificar"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Conductor:{" "}
                    {trip.driver_id
                      ? names[trip.driver_id] || "Sin identificar"
                      : "Sin asignar"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Solicitado:{" "}
                    {new Date(trip.requested_at).toLocaleString("es-MX")}
                  </p>
                </div>

                <div className="lg:text-right">
                  <p className="font-semibold">
                    {statusLabels[trip.status]}
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    $
                    {(
                      trip.final_price ??
                      trip.estimated_price ??
                      0
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
