"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  vehicle_year: number | null;
  color: string | null;
  plates: string;
  capacity: number;
  status: "pending" | "active" | "maintenance" | "suspended";
  verified: boolean;
};

export default function VehiclesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [plates, setPlates] = useState("");
  const [capacity, setCapacity] = useState("4");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      setMessage(`Error cargando perfil: ${profileError.message}`);
      setLoading(false);
      return;
    }

    if (profile.role !== "driver" && profile.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select(
        "id, brand, model, vehicle_year, color, plates, capacity, status, verified"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error cargando vehículos: ${error.message}`);
    } else {
      setVehicles(data ?? []);
    }

    setLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!brand.trim() || !model.trim() || !plates.trim()) {
      setMessage("Completa marca, modelo y placas.");
      return;
    }

    const parsedYear = year ? Number(year) : null;
    const parsedCapacity = Number(capacity);

    if (
      parsedYear !== null &&
      (Number.isNaN(parsedYear) || parsedYear < 1980 || parsedYear > 2100)
    ) {
      setMessage("Escribe un año válido.");
      return;
    }

    if (
      Number.isNaN(parsedCapacity) ||
      parsedCapacity < 1 ||
      parsedCapacity > 20
    ) {
      setMessage("La capacidad debe estar entre 1 y 20 pasajeros.");
      return;
    }

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("vehicles").insert({
      driver_id: session.user.id,
      brand: brand.trim(),
      model: model.trim(),
      vehicle_year: parsedYear,
      color: color.trim() || null,
      plates: plates.trim().toUpperCase(),
      capacity: parsedCapacity,
      status: "pending",
      verified: false,
      is_primary: vehicles.length === 0,
    });

    setSaving(false);

    if (error) {
      setMessage(`Error registrando vehículo: ${error.message}`);
      return;
    }

    setBrand("");
    setModel("");
    setYear("");
    setColor("");
    setPlates("");
    setCapacity("4");
    setMessage("Vehículo registrado. Quedó pendiente de revisión.");

    await loadVehicles();
  }

  const statusName: Record<Vehicle["status"], string> = {
    pending: "Pendiente",
    active: "Activo",
    maintenance: "Mantenimiento",
    suspended: "Suspendido",
  };

  if (loading) {
    return <p>Cargando vehículos...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Gestión de vehículos
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Vehículos
        </h1>

        <p className="mt-2 text-gray-600">
          Registra y administra los vehículos vinculados a tu cuenta.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-7 shadow-sm"
        >
          <h2 className="mb-6 text-xl font-bold">
            Registrar vehículo
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Marca
              </label>

              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Ejemplo: Nissan"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Modelo
              </label>

              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Ejemplo: Versa"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Año
              </label>

              <input
                type="number"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="2024"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Color
              </label>

              <input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="Blanco"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Placas
              </label>

              <input
                value={plates}
                onChange={(event) => setPlates(event.target.value)}
                placeholder="ABC-123-A"
                className="w-full rounded-xl border px-4 py-3 uppercase"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Capacidad
              </label>

              <input
                type="number"
                min="1"
                max="20"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-black py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Registrando..." : "Registrar vehículo"}
          </button>
        </form>

        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="mb-6 text-xl font-bold">
            Mis vehículos
          </h2>

          {vehicles.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
              <div className="text-center">
                <p className="font-semibold text-gray-700">
                  No hay vehículos registrados
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Registra tu primer vehículo para comenzar.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <article
                  key={vehicle.id}
                  className="rounded-xl border p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">
                        {vehicle.brand} {vehicle.model}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {vehicle.vehicle_year ?? "Año no registrado"}
                        {vehicle.color ? ` · ${vehicle.color}` : ""}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Placas: {vehicle.plates}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Capacidad: {vehicle.capacity}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {statusName[vehicle.status]}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {vehicle.verified
                          ? "Verificado"
                          : "Sin verificar"}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
