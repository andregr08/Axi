"use client";

import { use, useEffect, useRef, useState } from "react";
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
  payment_status: string;
  distance_km: number | null;
  duration_minutes: number | null;
  fare_subtotal: number | null;
  booking_fee: number | null;
  platform_commission: number | null;
  driver_earnings: number | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  dispatch_attempt: number;
  last_dispatch_at: string | null;
  cancellation_reason: string | null;
  cancellation_fee: number;
  cancelled_by: string | null;
};

const statusLabels: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³",
  in_progress: "Viaje en curso",
  completed: "Viaje completado",
  cancelled: "Viaje cancelado",
};

const nextDriverAction: Partial<
  Record<TripStatus, { status: TripStatus; label: string }>
> = {
  accepted: {
    status: "driver_arriving",
    label: "Voy en camino",
  },
  driver_arriving: {
    status: "driver_arrived",
    label: "Ya lleguÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©",
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

  const retryingRef = useRef(false);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(30);

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

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        setMessage("No fue posible cargar tu perfil.");
        setLoading(false);
        return;
      }

      setRole(profile.role as UserRole);
      await loadTrip();

      channel = supabase
        .channel(`trip-${id}-${crypto.randomUUID()}`)
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

  useEffect(() => {
    if (
      !trip ||
      role !== "passenger" ||
      trip.status !== "searching" ||
      trip.driver_id
    ) {
      return;
    }

    const timer = window.setInterval(async () => {
      const dispatchTime = trip.last_dispatch_at
        ? new Date(trip.last_dispatch_at).getTime()
        : new Date(trip.requested_at).getTime();

      const elapsedSeconds = Math.floor(
        (Date.now() - dispatchTime) / 1000
      );

      const remaining = Math.max(0, 30 - elapsedSeconds);
      setSecondsRemaining(remaining);

      if (remaining === 0 && !retryingRef.current) {
        retryingRef.current = true;
        await retryDispatch();
        retryingRef.current = false;
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [trip, role]);

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
        payment_status,
        distance_km,
        duration_minutes,
        fare_subtotal,
        booking_fee,
        platform_commission,
        driver_earnings,
        requested_at,
        accepted_at,
        started_at,
        completed_at,
        dispatch_attempt,
        last_dispatch_at,
        cancellation_reason,
        cancellation_fee,
        cancelled_by
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

  async function retryDispatch() {
    setMessage("Ampliando la bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda de conductores...");

    const { data, error } = await supabase.rpc(
      "retry_trip_dispatch",
      {
        requested_trip_id: id,
      }
    );

    if (error) {
      setMessage(`Error en la bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda: ${error.message}`);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (result?.trip_cancelled) {
      setMessage(
        "No encontramos conductores disponibles. El viaje fue cancelado."
      );
    } else {
      setMessage(
        `Intento ${result?.attempt_number}: se notificÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ a ${
          result?.notified_drivers ?? 0
        } conductores en un radio de ${result?.radius_km ?? 0} km.`
      );
    }

    await loadTrip();
  }

  async function cancelAsDriver() {
    if (!trip) return;

    const reason = window.prompt(
      "Escribe el motivo por el que cancelas el viaje:"
    );

    if (!reason) return;

    if (reason.trim().length < 5) {
      setMessage("El motivo debe tener al menos 5 caracteres.");
      return;
    }

    const confirmed = window.confirm(
      "El viaje volverÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ a buscar otro conductor. ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Confirmas la cancelaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setMessage("");

    const { error } = await supabase.rpc("driver_cancel_trip", {
      requested_trip_id: trip.id,
      cancellation_reason_value: reason.trim(),
    });

    if (error) {
      setMessage(`Error cancelando viaje: ${error.message}`);
    } else {
      setMessage(
        "Cancelaste el viaje. El pasajero volverÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ a buscar otro conductor."
      );

      await loadTrip();
    }

    setProcessing(false);
  }

  async function advanceStatus(nextStatus: TripStatus) {
    if (!trip) return;

    const confirmed = window.confirm(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Confirmas la acciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n "${statusLabels[nextStatus]}"?`
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

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1 text-sm font-medium text-gray-500">
            Viaje
          </p>

          <h1 className="text-3xl font-bold text-gray-900">
            {statusLabels[trip.status]}
          </h1>

          <p className="mt-2 text-gray-600">
            La informaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se actualiza automÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ticamente.
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard/trips")}
          className="rounded-xl border px-5 py-3 font-semibold"
        >
          Volver a mis viajes
        </button>
      </div>

      {trip.status === "searching" && role === "passenger" && (
        <div className="mb-6 rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">
            Buscando conductores cercanos
          </p>

          <p className="mt-2 text-3xl font-bold">
            {secondsRemaining}s
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Ronda actual: {trip.dispatch_attempt || 1} de 3
          </p>
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Recorrido</h2>

          <p className="text-sm text-gray-500">Origen</p>
          <p className="mt-1 font-semibold">
            {trip.origin_address}
          </p>

          <p className="mt-5 text-sm text-gray-500">Destino</p>
          <p className="mt-1 font-semibold">
            {trip.destination_address}
          </p>

          <p className="mt-5 text-sm text-gray-500">Precio</p>
          <p className="mt-1 text-2xl font-bold">
            $
            {(
              trip.final_price ??
              trip.estimated_price ??
              0
            ).toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Participantes
          </h2>

          <p className="text-sm text-gray-500">Pasajero</p>
          <p className="mt-1 font-semibold">{passengerName}</p>

          <p className="mt-5 text-sm text-gray-500">Conductor</p>
          <p className="mt-1 font-semibold">{driverName}</p>

          <p className="mt-5 text-sm text-gray-500">Estado</p>
          <p className="mt-1 font-semibold">
            {statusLabels[trip.status]}
          </p>
        </div>
      </div>

      {[
        "accepted",
        "driver_arriving",
        "driver_arrived",
        "in_progress",
      ].includes(trip.status) &&
        role !== "admin" && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/trips/${trip.id}/chat`)
              }
              className="w-full rounded-xl border px-5 py-4 text-lg font-semibold hover:bg-gray-50"
            >
              Abrir chat
            </button>
          </div>
        )}
      {role === "driver" &&
        driverAction &&
        trip.status !== "completed" &&
        trip.status !== "cancelled" && (
          <div className="mt-8 rounded-2xl bg-white p-7 shadow-sm">
            <div className="space-y-3">
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

              {[
                "accepted",
                "driver_arriving",
                "driver_arrived",
              ].includes(trip.status) && (
                <button
                  onClick={cancelAsDriver}
                  disabled={processing}
                  className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancelar viaje
                </button>
              )}
            </div>
          </div>
        )}

      {trip.status === "completed" &&
        role === "passenger" &&
        trip.payment_status !== "paid" && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/trips/${trip.id}/payment`)
              }
              className="w-full rounded-xl bg-black px-5 py-4 text-lg font-semibold text-white hover:bg-gray-800"
            >
              Pagar viaje
            </button>
          </div>
        )}
      {role === "passenger" &&
        !["completed", "cancelled"].includes(trip.status) && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/trips/${trip.id}/promo`)
              }
              className="w-full rounded-xl border px-5 py-4 text-lg font-semibold hover:bg-gray-50"
            >
              Aplicar cupón
            </button>
          </div>
        )}
      {trip.status === "cancelled" && (
        <div className="mt-8 rounded-2xl bg-red-50 p-7">
          <h2 className="text-2xl font-bold text-red-700">
            Viaje cancelado
          </h2>

          <div className="mt-5 space-y-3 text-red-700">
            <div>
              <p className="text-sm font-semibold">
                Motivo
              </p>
              <p className="mt-1">
                {trip.cancellation_reason ||
                  "No se registrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ un motivo."}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold">
                PenalizaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n
              </p>
              <p className="mt-1 text-xl font-bold">
                ${Number(trip.cancellation_fee ?? 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold">
                Cancelado por
              </p>
              <p className="mt-1">
                {trip.cancelled_by === trip.passenger_id
                  ? "Pasajero"
                  : trip.cancelled_by === trip.driver_id
                    ? "Conductor"
                    : "Sistema"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
