"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Route,
  Signal,
  Timer,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isDriver } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

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

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value ?? 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AvailableTripsPage() {
  const router = useRouter();

  const [offers, setOffers] = useState<TripOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(0);

  const loadOffers = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

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
    setRefreshing(false);
  }, []);

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

      if (!isDriver(profile?.role)) {
        router.replace("/dashboard");
        return;
      }

      await loadOffers();

      const channelName =
        `trip-offers-${session.user.id}-${crypto.randomUUID()}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "trip_offers",
            filter: `driver_id=eq.${session.user.id}`,
          },
          () => {
            void loadOffers(true);
          }
        )
        .subscribe();
    }

    void start();

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadOffers, router]);

  function getTrip(offer: TripOffer) {
    return Array.isArray(offer.trips)
      ? offer.trips[0]
      : offer.trips;
  }

  function secondsRemaining(expiresAt: string) {
    return Math.max(
      0,
      Math.ceil(
        (new Date(expiresAt).getTime() - now) / 1000
      )
    );
  }

  async function acceptOffer(offerId: string) {
    const confirmed = window.confirm(
      "Â¿Seguro que quieres aceptar este viaje?"
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
      await loadOffers(true);
      setProcessingId(null);
      return;
    }

    router.push(`/dashboard/trips/${data}`);
    router.refresh();
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
    } else {
      setMessage("Oferta rechazada correctamente.");
    }

    await loadOffers(true);
    setProcessingId(null);
  }

  const activeOffers = offers.filter(
    (offer) =>
      secondsRemaining(offer.expires_at) > 0
  );

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <Signal size={15} />
              Solicitudes en tiempo real
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Viajes disponibles
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Revisa nuevas solicitudes cercanas, compara los recorridos y
              acepta el viaje que mejor se adapte a tu ubicaciÃ³n.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Radio size={18} className="text-emerald-400" />
                ActualizaciÃ³n automÃ¡tica
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <CarFront size={18} className="text-yellow-400" />
                {activeOffers.length} oferta
                {activeOffers.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Solicitudes activas
                </p>

                <p className="mt-2 text-5xl font-black">
                  {activeOffers.length}
                </p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <Activity size={26} />
              </span>
            </div>

            <button
              type="button"
              onClick={() => loadOffers(true)}
              disabled={refreshing}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 font-black text-slate-950 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "animate-spin" : ""}
              />

              {refreshing
                ? "Actualizando..."
                : "Actualizar solicitudes"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.toLowerCase().includes("error")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      {activeOffers.length === 0 ? (
        <Card className="relative flex min-h-[480px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

          <div className="relative max-w-lg text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
              <CarFront size={34} />
            </span>

            <h2 className="mt-7 text-3xl font-black text-slate-950">
              No hay solicitudes disponibles
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              Mantente en lÃ­nea y con el GPS actualizado. Las nuevas ofertas
              aparecerÃ¡n aquÃ­ automÃ¡ticamente cuando un pasajero cercano
              solicite un viaje.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => loadOffers(true)}
                disabled={refreshing}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300 disabled:opacity-60"
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? "animate-spin" : ""}
                />
                Buscar otra vez
              </button>

              <Link
                href="/dashboard/driver/status"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 font-black text-slate-950 transition hover:border-slate-950"
              >
                <LocateFixed size={18} />
                Revisar disponibilidad
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {activeOffers.map((offer) => {
            const trip = getTrip(offer);
            const remaining = secondsRemaining(
              offer.expires_at
            );

            if (!trip) return null;

            const urgency =
              remaining <= 10
                ? "critical"
                : remaining <= 20
                  ? "warning"
                  : "normal";

            const percentage = Math.min(
              100,
              Math.max(0, (remaining / 30) * 100)
            );

            return (
              <article
                key={offer.id}
                className={cn(
                  "relative overflow-hidden rounded-[2rem] border bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl",
                  urgency === "critical"
                    ? "border-red-300"
                    : urgency === "warning"
                      ? "border-amber-300"
                      : "border-slate-200"
                )}
              >
                <div
                  className={cn(
                    "h-1.5 transition-all duration-1000",
                    urgency === "critical"
                      ? "bg-red-500"
                      : urgency === "warning"
                        ? "bg-amber-400"
                        : "bg-yellow-400"
                  )}
                  style={{
                    width: `${percentage}%`,
                  }}
                />

                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
                          urgency === "critical"
                            ? "bg-red-100 text-red-700"
                            : urgency === "warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-950 text-white"
                        )}
                      >
                        <Timer size={15} />
                        {remaining}s para responder
                      </span>

                      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Nueva solicitud
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Estimado
                      </p>

                      <p className="mt-1 text-3xl font-black text-slate-950">
                        {formatCurrency(
                          trip.estimated_price
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 flex gap-4">
                    <div className="flex w-11 shrink-0 flex-col items-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <MapPin size={20} />
                      </span>

                      <span className="my-2 h-12 border-l-2 border-dashed border-slate-300" />

                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                        <Navigation size={20} />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-8">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                          Recoger en
                        </p>

                        <h2 className="mt-2 text-lg font-black leading-6 text-slate-950">
                          {trip.origin_address}
                        </h2>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                          Destino
                        </p>

                        <p className="mt-2 font-black leading-6 text-slate-950">
                          {trip.destination_address}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <LocateFixed
                        size={19}
                        className="text-blue-600"
                      />

                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Recogida
                      </p>

                      <p className="mt-1 font-black text-slate-950">
                        {offer.distance_km !== null
                          ? `${Number(
                              offer.distance_km
                            ).toFixed(1)} km`
                          : "Pendiente"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <Clock3
                        size={19}
                        className="text-violet-600"
                      />

                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                        DuraciÃ³n
                      </p>

                      <p className="mt-1 font-black text-slate-950">
                        {trip.duration_minutes !== null
                          ? `${trip.duration_minutes} min`
                          : "Pendiente"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <CircleDollarSign
                        size={19}
                        className="text-emerald-600"
                      />

                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tarifa
                      </p>

                      <p className="mt-1 font-black text-slate-950">
                        {formatCurrency(
                          trip.estimated_price
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Clock3 size={14} />
                    Solicitado {formatDate(trip.requested_at)}
                  </div>

                  <div className="mt-7 grid grid-cols-[0.7fr_1.3fr] gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        rejectOffer(offer.id)
                      }
                      disabled={
                        processingId === offer.id
                      }
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 font-black text-red-700 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <X size={19} />
                      Rechazar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        acceptOffer(offer.id)
                      }
                      disabled={
                        processingId === offer.id
                      }
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {processingId === offer.id ? (
                        <>
                          <RefreshCw
                            size={19}
                            className="animate-spin"
                          />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={19} />
                          Aceptar viaje
                          <ArrowRight size={19} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Card className="bg-[#0B0F19] text-white">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
              RecomendaciÃ³n AXI
            </p>

            <h2 className="mt-2 text-2xl font-black">
              MantÃ©n tu ubicaciÃ³n actualizada
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Una ubicaciÃ³n precisa permite que AXI te muestre viajes mÃ¡s
              cercanos y calcule mejor la distancia de recogida.
            </p>
          </div>

          <Link
            href="/dashboard/driver/status"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
          >
            <Route size={19} />
            Revisar mi ubicaciÃ³n
          </Link>
        </div>
      </Card>
    </section>
  );
}


