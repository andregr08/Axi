"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DriverStatus = "pending" | "active" | "suspended" | "rejected";

type Driver = {
  id: string;
  license_number: string | null;
  license_expiration: string | null;
  status: DriverStatus;
  verified: boolean;
  online: boolean;
  created_at: string;
  profiles:
    | {
        full_name: string | null;
        phone: string | null;
        rating: number;
        total_trips: number;
        account_active: boolean;
      }
    | {
        full_name: string | null;
        phone: string | null;
        rating: number;
        total_trips: number;
        account_active: boolean;
      }[]
    | null;
};

export default function AdminDriversPage() {
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDrivers();
  }, []);

  async function loadDrivers() {
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
      .from("drivers")
      .select(`
        id,
        license_number,
        license_expiration,
        status,
        verified,
        online,
        created_at,
        profiles:id (
          full_name,
          phone,
          rating,
          total_trips,
          account_active
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error cargando conductores: ${error.message}`);
    } else {
      setDrivers((data ?? []) as Driver[]);
    }

    setLoading(false);
  }

  async function updateStatus(
    driverId: string,
    newStatus: DriverStatus
  ) {
    const confirmed = window.confirm(
      `¿Confirmas cambiar el estado del conductor a ${newStatus}?`
    );

    if (!confirmed) return;

    setProcessingId(driverId);
    setMessage("");

    const { error } = await supabase.rpc("update_driver_status", {
      driver_user_id: driverId,
      new_status: newStatus,
    });

    if (error) {
      setMessage(`Error actualizando conductor: ${error.message}`);
    } else {
      setMessage("Conductor actualizado correctamente.");
      await loadDrivers();
    }

    setProcessingId(null);
  }

  function getProfile(driver: Driver) {
    return Array.isArray(driver.profiles)
      ? driver.profiles[0]
      : driver.profiles;
  }

  const activeCount = drivers.filter(
    (driver) => driver.status === "active"
  ).length;

  const suspendedCount = drivers.filter(
    (driver) => driver.status === "suspended"
  ).length;

  const onlineCount = drivers.filter(
    (driver) => driver.online
  ).length;

  if (loading) {
    return <p>Cargando conductores...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Conductores
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta y administra el estado de los conductores de AXI.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Activos</p>
          <p className="mt-3 text-3xl font-bold">{activeCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Suspendidos</p>
          <p className="mt-3 text-3xl font-bold">{suspendedCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">En línea</p>
          <p className="mt-3 text-3xl font-bold">{onlineCount}</p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {drivers.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              No hay conductores registrados.
            </p>
          </div>
        ) : (
          drivers.map((driver) => {
            const profile = getProfile(driver);

            return (
              <article
                key={driver.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="text-xl font-bold">
                      {profile?.full_name || "Conductor sin nombre"}
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                      Licencia: {driver.license_number || "No registrada"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Vencimiento:{" "}
                      {driver.license_expiration
                        ? new Date(
                            driver.license_expiration
                          ).toLocaleDateString("es-MX")
                        : "No registrado"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Teléfono: {profile?.phone || "No registrado"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Calificación: {profile?.rating ?? 5}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Viajes: {profile?.total_trips ?? 0}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Estado: {driver.status}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Verificado: {driver.verified ? "Sí" : "No"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Conectado: {driver.online ? "Sí" : "No"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() =>
                        updateStatus(driver.id, "active")
                      }
                      disabled={processingId === driver.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Activar
                    </button>

                    <button
                      onClick={() =>
                        updateStatus(driver.id, "suspended")
                      }
                      disabled={processingId === driver.id}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      Suspender
                    </button>

                    <button
                      onClick={() =>
                        updateStatus(driver.id, "rejected")
                      }
                      disabled={processingId === driver.id}
                      className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Rechazar
                    </button>

                    <button
                      onClick={() =>
                        updateStatus(driver.id, "pending")
                      }
                      disabled={processingId === driver.id}
                      className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Pendiente
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
