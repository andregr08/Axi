"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DriverStatusPage() {
  const router = useRouter();

  const [online, setOnline] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");


  async function loadDriverStatus() {
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

    if (profile?.role !== "driver") {
      router.replace("/dashboard");
      return;
    }

    const { data: driver, error } = await supabase
      .from("drivers")
      .select("online, current_lat, current_lng")
      .eq("id", session.user.id)
      .single();

    if (error) {
      setMessage(`Error cargando estado: ${error.message}`);
    } else {
      setOnline(driver.online);
      setLatitude(driver.current_lat);
      setLongitude(driver.current_lng);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDriverStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);
  function shareLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("Tu navegador no permite usar la ubicación.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLatitude = position.coords.latitude;
        const newLongitude = position.coords.longitude;
        const newAccuracy = position.coords.accuracy;

        const { error } = await supabase.rpc(
          "update_driver_location",
          {
            latitude_value: newLatitude,
            longitude_value: newLongitude,
            speed_value: position.coords.speed,
            heading_value: position.coords.heading,
            accuracy_value: newAccuracy,
          }
        );

        setLocating(false);

        if (error) {
          setMessage(`Error actualizando ubicación: ${error.message}`);
          return;
        }

        setLatitude(newLatitude);
        setLongitude(newLongitude);
        setAccuracy(newAccuracy);
        setMessage("Ubicación actualizada correctamente.");
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setMessage("Debes permitir el acceso al GPS.");
          return;
        }

        setMessage("No pudimos obtener tu ubicación.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  }

  async function changeOnlineStatus(nextOnline: boolean) {
    setProcessing(true);
    setMessage("");

    const { error } = await supabase.rpc("set_driver_online", {
      online_status: nextOnline,
    });

    setProcessing(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setOnline(nextOnline);
    setMessage(
      nextOnline
        ? "Ya estás en línea y puedes recibir viajes."
        : "Ahora estás fuera de línea."
    );
  }

  if (loading) {
    return <p>Cargando estado del conductor...</p>;
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Conductor
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Disponibilidad
        </h1>

        <p className="mt-2 text-gray-600">
          Comparte tu ubicación y controla si estás disponible para recibir viajes.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="rounded-xl bg-gray-100 p-5">
          <p className="text-sm text-gray-500">Estado actual</p>

          <p
            className={`mt-2 text-2xl font-bold ${
              online ? "text-green-600" : "text-gray-700"
            }`}
          >
            {online ? "En línea" : "Fuera de línea"}
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <h2 className="text-lg font-bold">Ubicación GPS</h2>

          {latitude !== null && longitude !== null ? (
            <div className="mt-3 text-sm text-gray-600">
              <p>Latitud: {Number(latitude).toFixed(6)}</p>
              <p>Longitud: {Number(longitude).toFixed(6)}</p>

              {accuracy !== null && (
                <p>Precisión aproximada: {Math.round(accuracy)} metros</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Todavía no has compartido tu ubicación.
            </p>
          )}

          <button
            type="button"
            onClick={shareLocation}
            disabled={locating}
            className="mt-5 w-full rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {locating
              ? "Obteniendo ubicación..."
              : "Actualizar mi ubicación"}
          </button>
        </div>

        {message && (
          <div className="rounded-xl bg-gray-100 p-4 text-sm">
            {message}
          </div>
        )}

        {online ? (
          <button
            onClick={() => changeOnlineStatus(false)}
            disabled={processing}
            className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white disabled:opacity-50"
          >
            {processing ? "Procesando..." : "Ponerme fuera de línea"}
          </button>
        ) : (
          <button
            onClick={() => changeOnlineStatus(true)}
            disabled={processing}
            className="w-full rounded-xl bg-black py-3 font-semibold text-white disabled:opacity-50"
          >
            {processing ? "Procesando..." : "Ponerme en línea"}
          </button>
        )}
      </div>
    </section>
  );
}
