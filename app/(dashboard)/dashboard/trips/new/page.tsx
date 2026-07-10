"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewTripPage() {
  const router = useRouter();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!origin.trim() || !destination.trim()) {
      setMessage("Escribe el origen y el destino.");
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

    const { error } = await supabase.from("trips").insert({
      passenger_id: session.user.id,
      origin_address: origin.trim(),
      origin_lat: 0,
      origin_lng: 0,
      destination_address: destination.trim(),
      destination_lat: 0,
      destination_lng: 0,
      status: "requested",
    });

    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    router.push("/dashboard/trips");
    router.refresh();
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
          Escribe el punto de partida y el destino.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-8 shadow-sm"
      >
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
          <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
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
            disabled={loading}
            className="flex-1 rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Solicitando..." : "Confirmar viaje"}
          </button>
        </div>
      </form>
    </section>
  );
}
