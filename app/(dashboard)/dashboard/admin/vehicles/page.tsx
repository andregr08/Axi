"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VehicleStatus = "pending" | "active" | "maintenance" | "suspended";

type Vehicle = {
  id: string;
  driver_id: string;
  brand: string;
  model: string;
  vehicle_year: number | null;
  color: string | null;
  plates: string;
  capacity: number;
  status: VehicleStatus;
  verified: boolean;
  created_at: string;
  profiles:
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[]
    | null;
};

export default function AdminVehiclesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select(`
        id,
        driver_id,
        brand,
        model,
        vehicle_year,
        color,
        plates,
        capacity,
        status,
        verified,
        created_at,
        profiles:driver_id (
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error cargando vehículos: ${error.message}`);
    } else {
      setVehicles((data ?? []) as Vehicle[]);
    }

    setLoading(false);
  }

  async function reviewVehicle(
    vehicleId: string,
    newStatus: VehicleStatus
  ) {
    const confirmed = window.confirm(
      `¿Confirmas cambiar el estado del vehículo a ${newStatus}?`
    );

    if (!confirmed) return;

    setProcessingId(vehicleId);
    setMessage("");

    const { error } = await supabase.rpc("review_vehicle", {
      vehicle_id: vehicleId,
      new_status: newStatus,
    });

    if (error) {
      setMessage(`Error actualizando vehículo: ${error.message}`);
    } else {
      setMessage("Vehículo actualizado correctamente.");
      await loadVehicles();
    }

    setProcessingId(null);
  }

  function getDriverName(vehicle: Vehicle) {
    const profile = Array.isArray(vehicle.profiles)
      ? vehicle.profiles[0]
      : vehicle.profiles;

    return profile?.full_name || "Conductor sin nombre";
  }

  const pendingCount = vehicles.filter(
    (vehicle) => vehicle.status === "pending"
  ).length;

  const activeCount = vehicles.filter(
    (vehicle) => vehicle.status === "active"
  ).length;

  const suspendedCount = vehicles.filter(
    (vehicle) => vehicle.status === "suspended"
  ).length;

  if (loading) {
    return <p>Cargando vehículos...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Vehículos
        </h1>

        <p className="mt-2 text-gray-600">
          Revisa, aprueba, suspende o marca vehículos en mantenimiento.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Pendientes</p>
          <p className="mt-3 text-3xl font-bold">{pendingCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Activos</p>
          <p className="mt-3 text-3xl font-bold">{activeCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Suspendidos</p>
          <p className="mt-3 text-3xl font-bold">{suspendedCount}</p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {vehicles.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              No hay vehículos registrados.
            </p>
          </div>
        ) : (
          vehicles.map((vehicle) => (
            <article
              key={vehicle.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-xl font-bold">
                    {vehicle.brand} {vehicle.model}
                  </h2>

                  <p className="mt-2 text-sm text-gray-500">
                    Conductor: {getDriverName(vehicle)}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Placas: {vehicle.plates}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Año: {vehicle.vehicle_year ?? "No registrado"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Color: {vehicle.color || "No registrado"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Capacidad: {vehicle.capacity}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Estado: {vehicle.status}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Verificación:{" "}
                    {vehicle.verified ? "Verificado" : "Sin verificar"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      reviewVehicle(vehicle.id, "active")
                    }
                    disabled={processingId === vehicle.id}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Aprobar
                  </button>

                  <button
                    onClick={() =>
                      reviewVehicle(vehicle.id, "maintenance")
                    }
                    disabled={processingId === vehicle.id}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Mantenimiento
                  </button>

                  <button
                    onClick={() =>
                      reviewVehicle(vehicle.id, "suspended")
                    }
                    disabled={processingId === vehicle.id}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Suspender
                  </button>

                  <button
                    onClick={() =>
                      reviewVehicle(vehicle.id, "pending")
                    }
                    disabled={processingId === vehicle.id}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Regresar a pendiente
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
