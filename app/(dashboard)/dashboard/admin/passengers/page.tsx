"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Passenger = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  rating: number;
  total_trips: number;
  account_active: boolean;
  created_at: string;
};

export default function AdminPassengersPage() {
  const router = useRouter();

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPassengers();
  }, []);

  async function loadPassengers() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || currentProfile?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, avatar_url, rating, total_trips, account_active, created_at"
      )
      .eq("role", "passenger")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error cargando pasajeros: ${error.message}`);
    } else {
      setPassengers(data ?? []);
    }

    setLoading(false);
  }

  async function updatePassengerStatus(
    passengerId: string,
    newActiveStatus: boolean
  ) {
    const action = newActiveStatus ? "activar" : "suspender";

    const confirmed = window.confirm(
      `¿Seguro que quieres ${action} esta cuenta?`
    );

    if (!confirmed) return;

    setProcessingId(passengerId);
    setMessage("");

    const { error } = await supabase.rpc("update_passenger_status", {
      passenger_user_id: passengerId,
      new_active_status: newActiveStatus,
    });

    if (error) {
      setMessage(`Error actualizando pasajero: ${error.message}`);
    } else {
      setMessage(
        newActiveStatus
          ? "Cuenta activada correctamente."
          : "Cuenta suspendida correctamente."
      );

      await loadPassengers();
    }

    setProcessingId(null);
  }

  const activeCount = passengers.filter(
    (passenger) => passenger.account_active
  ).length;

  const inactiveCount = passengers.filter(
    (passenger) => !passenger.account_active
  ).length;

  const totalTrips = passengers.reduce(
    (total, passenger) => total + passenger.total_trips,
    0
  );

  if (loading) {
    return <p>Cargando pasajeros...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Pasajeros
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta y administra las cuentas de pasajeros registradas en AXI.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Pasajeros activos</p>
          <p className="mt-3 text-3xl font-bold">{activeCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Cuentas suspendidas</p>
          <p className="mt-3 text-3xl font-bold">{inactiveCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes acumulados</p>
          <p className="mt-3 text-3xl font-bold">{totalTrips}</p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {passengers.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              No hay pasajeros registrados.
            </p>
          </div>
        ) : (
          passengers.map((passenger) => (
            <article
              key={passenger.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-lg font-bold">
                    {passenger.avatar_url ? (
                      <img
                        src={passenger.avatar_url}
                        alt={passenger.full_name || "Pasajero"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      passenger.full_name?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-bold">
                      {passenger.full_name || "Usuario sin nombre"}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Teléfono: {passenger.phone || "No registrado"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Registro:{" "}
                      {new Date(passenger.created_at).toLocaleDateString(
                        "es-MX"
                      )}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Calificación: {passenger.rating}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Viajes: {passenger.total_trips}
                    </p>

                    <p
                      className={`mt-1 text-sm font-semibold ${
                        passenger.account_active
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {passenger.account_active
                        ? "Cuenta activa"
                        : "Cuenta suspendida"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {passenger.account_active ? (
                    <button
                      onClick={() =>
                        updatePassengerStatus(passenger.id, false)
                      }
                      disabled={processingId === passenger.id}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      {processingId === passenger.id
                        ? "Procesando..."
                        : "Suspender"}
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        updatePassengerStatus(passenger.id, true)
                      }
                      disabled={processingId === passenger.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {processingId === passenger.id
                        ? "Procesando..."
                        : "Activar"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
