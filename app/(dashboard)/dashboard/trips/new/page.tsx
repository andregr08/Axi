"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function NewTripPage() {
  const router = useRouter();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function getCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("Tu navegador no permite obtener la ubicación.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocating(false);
        setMessage("Ubicación actual obtenida correctamente.");
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setMessage(
            "Debes permitir el acceso a tu ubicación para solicitar un viaje."
          );
          return;
        }

        setMessage("No pudimos obtener tu ubicación. Intenta otra vez.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!origin.trim() || !destination.trim()) {
      setMessage("Escribe el origen y el destino.");
      return;
    }

    if (!coordinates) {
      setMessage("Primero obtén tu ubicación actual.");
      return;
    }

    setLoading(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        passenger_id: session.user.id,
        origin_address: origin.trim(),
        origin_lat: coordinates.latitude,
        origin_lng: coordinates.longitude,
        destination_address: destination.trim(),

        // Se reemplazarán cuando integremos el mapa y buscador de destino.
        destination_lat: 0,
        destination_lng: 0,

        status: "requested",
      })
      .select("id")
      .single();

    if (tripError || !trip) {
      setLoading(false);
      setMessage(
        `Error creando el viaje: ${
          tripError?.message ?? "No se obtuvo el viaje"
        }`
      );
      return;
    }

    const { data: notifiedDrivers, error: dispatchError } =
      await supabase.rpc("dispatch_trip", {
        requested_trip_id: trip.id,
        search_radius_km: 10,
        drivers_limit: 10,
      });

    setLoading(false);

    if (dispatchError) {
      setMessage(
        `El viaje se creó, pero ocurrió un error buscando conductores: ${dispatchError.message}`
      );

      window.setTimeout(() => {
        router.push("/dashboard/trips");
        router.refresh();
      }, 2500);

      return;
    }

    const count = Number(notifiedDrivers ?? 0);

    if (count === 0) {
      setMessage(
        "Viaje creado. Por ahora no encontramos conductores cercanos; seguiremos buscando."
      );
    } else {
      setMessage(
        `Viaje creado. Se notificó a ${count} conductor${
          count === 1 ? "" : "es"
        } cercano${count === 1 ? "" : "s"}.`
      );
    }

    window.setTimeout(() => {
      router.push("/dashboard/trips");
      router.refresh();
    }, 2000);
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Nueva solicitud
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Solicitar viaje
        </h1>

        <p className="mt-2 text-gray-600">
          Indica tu punto de partida y el destino.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-8 shadow-sm"
      >
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Ubicación actual
          </label>

          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={locating}
            className="w-full rounded-xl border px-4 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {locating
              ? "Obteniendo ubicación..."
              : coordinates
                ? "Ubicación obtenida"
                : "Usar mi ubicación actual"}
          </button>

          {coordinates && (
            <p className="mt-2 text-xs text-gray-500">
              GPS: {coordinates.latitude.toFixed(6)},{" "}
              {coordinates.longitude.toFixed(6)}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label
            htmlFor="origin"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Punto de partida
          </label>

          <input
            id="origin"
            type="text"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder="Ejemplo: Angelópolis, Puebla"
            className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="destination"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Destino
          </label>

          <input
            id="destination"
            type="text"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="Ejemplo: Centro de Cholula"
            className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
          />
        </div>

        {message && (
          <p className="mb-5 rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/trips")}
            className="flex-1 rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading || locating}
            className="flex-1 rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Buscando conductores..." : "Confirmar viaje"}
          </button>
        </div>
      </form>
    </section>
  );
}
