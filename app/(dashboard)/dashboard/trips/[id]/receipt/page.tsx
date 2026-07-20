"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isFinance } from "@/lib/auth/roles";

type UserRole = "admin" | "driver" | "passenger";

type TripReceipt = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  origin_address: string;
  destination_address: string;
  status: string;
  distance_km: number | null;
  duration_minutes: number | null;
  fare_subtotal: number | null;
  booking_fee: number | null;
  final_price: number | null;
  platform_commission: number | null;
  driver_earnings: number | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export default function TripReceiptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] = useState<TripReceipt | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadReceipt() {
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

      if (profileError || !currentProfile) {
        setMessage("No fue posible cargar tu perfil.");
        setLoading(false);
        return;
      }

      setRole(currentProfile.role as UserRole);

      const { data, error } = await supabase
        .from("trips")
        .select(`
          id,
          passenger_id,
          driver_id,
          origin_address,
          destination_address,
          status,
          distance_km,
          duration_minutes,
          fare_subtotal,
          booking_fee,
          final_price,
          platform_commission,
          driver_earnings,
          requested_at,
          started_at,
          completed_at
        `)
        .eq("id", tripId)
        .single();

      if (error || !data) {
        setMessage(
          `No fue posible cargar el recibo: ${
            error?.message ?? "Viaje no encontrado"
          }`
        );
        setLoading(false);
        return;
      }

      const loadedTrip = data as TripReceipt;

      if (loadedTrip.status !== "completed") {
        setMessage("El recibo estará disponible cuando termine el viaje.");
        setLoading(false);
        return;
      }

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
            : "Sin conductor"
        );
      }

      setLoading(false);
    }

    loadReceipt();
  }, [router, tripId]);

  function formatMoney(value: number | null) {
    return `$${Number(value ?? 0).toFixed(2)} MXN`;
  }

  function formatDate(value: string | null) {
    if (!value) return "No registrado";

    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (loading) {
    return <p>Cargando recibo...</p>;
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible mostrar el recibo."}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
          className="rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
        >
          Volver al viaje
        </button>

        <button
          onClick={() => window.print()}
          className="rounded-xl bg-black px-5 py-3 font-semibold text-white"
        >
          Imprimir recibo
        </button>
      </div>

      <article className="rounded-2xl bg-white p-8 shadow-sm print:shadow-none">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-3xl font-bold">AXI</p>
              <p className="mt-1 text-sm text-gray-500">
                Recibo de viaje
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">Folio</p>
              <p className="mt-1 font-mono text-sm">
                {trip.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 border-b py-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Pasajero</p>
            <p className="mt-1 font-semibold">{passengerName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Conductor</p>
            <p className="mt-1 font-semibold">{driverName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Inicio</p>
            <p className="mt-1 font-semibold">
              {formatDate(trip.started_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Finalización</p>
            <p className="mt-1 font-semibold">
              {formatDate(trip.completed_at)}
            </p>
          </div>
        </div>

        <div className="border-b py-6">
          <div>
            <p className="text-sm text-gray-500">Origen</p>
            <p className="mt-1 font-semibold">
              {trip.origin_address}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm text-gray-500">Destino</p>
            <p className="mt-1 font-semibold">
              {trip.destination_address}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Distancia</p>
              <p className="mt-1 text-lg font-bold">
                {trip.distance_km !== null
                  ? `${Number(trip.distance_km).toFixed(2)} km`
                  : "Sin calcular"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Duración</p>
              <p className="mt-1 text-lg font-bold">
                {trip.duration_minutes !== null
                  ? `${trip.duration_minutes} minutos`
                  : "Sin calcular"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 py-6">
          <div className="flex justify-between gap-5">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold">
              {formatMoney(trip.fare_subtotal)}
            </span>
          </div>

          <div className="flex justify-between gap-5">
            <span className="text-gray-600">Cuota de servicio</span>
            <span className="font-semibold">
              {formatMoney(trip.booking_fee)}
            </span>
          </div>

          <div className="flex justify-between gap-5 border-t pt-4 text-xl">
            <span className="font-bold">Total</span>
            <span className="font-bold">
              {formatMoney(trip.final_price)}
            </span>
          </div>

          {role === "driver" && (
            <div className="flex justify-between gap-5 rounded-xl bg-green-50 p-4 text-green-700">
              <span className="font-semibold">
                Tu ganancia
              </span>
              <span className="font-bold">
                {formatMoney(trip.driver_earnings)}
              </span>
            </div>
          )}

          {isFinance(role) && (
            <>
              <div className="flex justify-between gap-5 rounded-xl bg-gray-50 p-4">
                <span className="font-semibold">Comisión AXI</span>
                <span className="font-bold">
                  {formatMoney(trip.platform_commission)}
                </span>
              </div>

              <div className="flex justify-between gap-5 rounded-xl bg-green-50 p-4 text-green-700">
                <span className="font-semibold">
                  Ganancia del conductor
                </span>
                <span className="font-bold">
                  {formatMoney(trip.driver_earnings)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="border-t pt-6 text-center text-sm text-gray-500">
          Gracias por viajar con AXI.
        </div>
      </article>
    </section>
  );
}
