"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DriverStats = {
  earnings_today: number;
  earnings_week: number;
  earnings_month: number;
  completed_trips: number;
  trips_today: number;
  trips_week: number;
  worked_hours: number;
  average_rating: number;
  rating_count: number;
};

type DriverProfile = {
  full_name: string | null;
  phone: string | null;
};

type DriverActivity = {
  trip_id: string;
  origin_address: string;
  destination_address: string;
  completed_at: string | null;
  driver_earnings: number;
  final_price: number;
  distance_km: number | null;
  duration_minutes: number | null;
  passenger_rating: number | null;
  passenger_comment: string | null;
};

export default function DriverProfilePage() {
  const router = useRouter();

  const [stats, setStats] = useState<DriverStats | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [activity, setActivity] = useState<DriverActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadDriverProfile() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("full_name, phone, role")
        .eq("id", session.user.id)
        .single();

    if (
      profileError ||
      !profileData ||
      profileData.role !== "driver"
    ) {
      router.replace("/dashboard");
      return;
    }

    setProfile({
      full_name: profileData.full_name,
      phone: profileData.phone,
    });

    const { data: statsData, error: statsError } =
      await supabase.rpc("get_driver_dashboard_stats");

    if (statsError) {
      setMessage(
        `Error cargando estadísticas: ${statsError.message}`
      );
      setLoading(false);
      return;
    }

    const statsResult = Array.isArray(statsData)
      ? statsData[0]
      : statsData;

    setStats(statsResult as DriverStats);

    const { data: activityData, error: activityError } =
      await supabase.rpc("get_driver_activity_history", {
        result_limit: 50,
      });

    if (activityError) {
      setMessage(
        `Error cargando historial: ${activityError.message}`
      );
    } else {
      setActivity((activityData ?? []) as DriverActivity[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDriverProfile();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function formatMoney(value: number | null) {
    return `$${Number(value ?? 0).toFixed(2)} MXN`;
  }

  function formatDate(value: string | null) {
    if (!value) return "Sin fecha";

    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (loading) {
    return <p>Cargando perfil del conductor...</p>;
  }

  if (!stats || !profile) {
    return (
      <section>
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible cargar el perfil."}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Cuenta de conductor
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          {profile.full_name || "Conductor AXI"}
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta tu actividad, ganancias y reputación.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">Ganancias de hoy</p>
          <p className="mt-3 text-3xl font-bold">
            {formatMoney(stats.earnings_today)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Ganancias de la semana
          </p>
          <p className="mt-3 text-3xl font-bold">
            {formatMoney(stats.earnings_week)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Ganancias del mes
          </p>
          <p className="mt-3 text-3xl font-bold">
            {formatMoney(stats.earnings_month)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes completados
          </p>
          <p className="mt-3 text-3xl font-bold">
            {stats.completed_trips}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes de hoy</p>
          <p className="mt-3 text-3xl font-bold">
            {stats.trips_today}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes esta semana
          </p>
          <p className="mt-3 text-3xl font-bold">
            {stats.trips_week}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Horas trabajadas
          </p>
          <p className="mt-3 text-3xl font-bold">
            {Number(stats.worked_hours).toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <p className="text-sm text-gray-500">
            Calificación promedio
          </p>

          <div className="mt-3 flex items-center gap-3">
            <p className="text-4xl font-bold">
              {Number(stats.average_rating).toFixed(2)}
            </p>
            <span className="text-3xl text-yellow-400">★</span>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            Basado en {stats.rating_count} reseñas
          </p>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <p className="text-sm text-gray-500">
            Información de contacto
          </p>

          <p className="mt-3 font-semibold">
            {profile.full_name || "Sin nombre"}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {profile.phone || "Sin teléfono registrado"}
          </p>

          <button
            type="button"
            onClick={() => router.push("/dashboard/profile")}
            className="mt-5 rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
          >
            Editar perfil
          </button>
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-5">
          <h2 className="text-2xl font-bold">
            Historial de actividad
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Tus viajes completados, ganancias y reseñas recibidas.
          </p>
        </div>

        {activity.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-gray-700">
              Todavía no tienes viajes completados.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {activity.map((item) => (
              <article
                key={item.trip_id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-6 lg:flex-row">
                  <div>
                    <h3 className="text-lg font-bold">
                      {item.origin_address}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      hacia {item.destination_address}
                    </p>

                    <p className="mt-3 text-sm text-gray-500">
                      {formatDate(item.completed_at)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                      <span>
                        {item.distance_km !== null
                          ? `${Number(item.distance_km).toFixed(2)} km`
                          : "Distancia sin calcular"}
                      </span>

                      <span>
                        {item.duration_minutes !== null
                          ? `${item.duration_minutes} min`
                          : "Duración sin calcular"}
                      </span>
                    </div>
                  </div>

                  <div className="lg:min-w-64 lg:text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {formatMoney(item.driver_earnings)}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Total del viaje: {formatMoney(item.final_price)}
                    </p>

                    {item.passenger_rating !== null ? (
                      <div className="mt-4 rounded-xl bg-yellow-50 p-4 text-left">
                        <p className="font-semibold text-yellow-800">
                          {item.passenger_rating} de 5 ★
                        </p>

                        <p className="mt-1 text-sm text-yellow-800">
                          {item.passenger_comment ||
                            "El pasajero no dejó comentario."}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-gray-400">
                        Sin calificación del pasajero
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/dashboard/trips/${item.trip_id}`)
                      }
                      className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
                    >
                      Ver viaje
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
