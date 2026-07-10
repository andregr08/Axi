"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

type TripOffer = {
  id: string;
  trip_id: string;
  distance_km: number | null;
  status: OfferStatus;
  expires_at: string;
  created_at: string;
  trips:
    | {
        origin_address: string;
        destination_address: string;
        estimated_price: number | null;
        duration_minutes: number | null;
        requested_at: string;
      }
    | {
        origin_address: string;
        destination_address: string;
        estimated_price: number | null;
        duration_minutes: number | null;
        requested_at: string;
      }[]
    | null;
};

export default function AvailableTripsPage() {
  const router = useRouter();

  const [offers, setOffers] = useState<TripOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "driver") {
        router.replace("/dashboard");
        return;
      }

      await loadOffers();

      channel = supabase
        .channel(`trip-offers-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "trip_offers",
            filter: `driver_id=eq.${session.user.id}`,
          },
          () => {
            loadOffers();
          }
        )
        .subscribe();
    }

    start();

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  async function loadOffers() {
    setLoading(true);
    setMessage("");

    await supabase.rpc("expire_trip_offers");

    const { data, error } = await supabase
      .from("trip_offers")
      .select(`
        id,
        trip_id,
        distance_km,
        status,
        expires_at,
        created_at,
        trips:trip_id (
          origin_address,
          destination_address,
          estimated_price,
          duration_minutes,
          requested_at
        )
      `)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`Error cargando ofertas: ${error.message}`);
    } else {
      setOffers((data ?? []) as TripOffer[]);
    }

    setLoading(false);
  }

  function getTrip(offer: TripOffer) {
    return Array.isArray(offer.trips) ? offer.trips[0] : offer.trips;
  }

  function secondsRemaining(expiresAt: string) {
    return Math.max(
      0,
      Math.ceil((new Date(expiresAt).getTime() - now) / 1000)
    );
  }

  async function acceptOffer(offerId: string) {
    const confirmed = window.confirm(
      "¿Seguro que quieres aceptar este viaje?"
    );

    if (!confirmed) return;

    setProcessingId(offerId);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "accept_trip_offer",
      {
        offer_id: offerId,
      }
    );

    if (error) {
      setMessage(`Error al aceptar: ${error.message}`);
      await loadOffers();
    } else {
      router.push(`/dashboard/trips/${data}`);
      router.refresh();
    }

    setProcessingId(null);
  }

  async function rejectOffer(offerId: string) {
    setProcessingId(offerId);
    setMessage("");

    const { error } = await supabase.rpc(
      "reject_trip_offer",
      {
        offer_id: offerId,
      }
    );

    if (error) {
      setMessage(`Error al rechazar: ${error.message}`);
    }

    await loadOffers();
    setProcessingId(null);
  }

  const activeOffers = useMemo(
    () =>
      offers.filter(
        (offer) => secondsRemaining(offer.expires_at) > 0
      ),
    [offers, now]
  );

  if (loading) {
    return <p>Cargando ofertas...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Conductor
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Viajes disponibles
        </h1>

        <p className="mt-2 text-gray-600">
          Las nuevas ofertas aparecerán automáticamente en tiempo real.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      {activeOffers.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="font-semibold text-gray-700">
            No hay ofertas disponibles
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Mantente en línea. Las nuevas solicitudes aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {activeOffers.map((offer) => {
            const trip = getTrip(offer);
            const remaining = secondsRemaining(offer.expires_at);

            if (!trip) return null;

            return (
              <article
                key={offer.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div>
                    <div className="mb-4 inline-flex rounded-full bg-black px-3 py-1 text-sm font-semibold text-white">
                      {remaining}s para responder
                    </div>

                    <h2 className="text-lg font-bold">
                      {trip.origin_address}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      hacia {trip.destination_address}
                    </p>

                    <p className="mt-3 text-sm text-gray-500">
                      Distancia para recoger:{" "}
                      {offer.distance_km !== null
                        ? `${offer.distance_km} km`
                        : "Sin calcular"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Duración estimada:{" "}
                      {trip.duration_minutes !== null
                        ? `${trip.duration_minutes} min`
                        : "Pendiente"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Solicitado:{" "}
                      {new Date(
                        trip.requested_at
                      ).toLocaleString("es-MX")}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 lg:items-end">
                    <p className="text-2xl font-bold">
                      ${(trip.estimated_price ?? 0).toFixed(2)}
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => rejectOffer(offer.id)}
                        disabled={processingId === offer.id}
                        className="rounded-lg border px-5 py-3 font-semibold disabled:opacity-50"
                      >
                        Rechazar
                      </button>

                      <button
                        onClick={() => acceptOffer(offer.id)}
                        disabled={processingId === offer.id}
                        className="rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        {processingId === offer.id
                          ? "Procesando..."
                          : "Aceptar"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
