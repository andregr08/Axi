"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CarFront,
  CircleDollarSign,
  Clock3,
  CreditCard,
  History,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { RideActionPanel } from "@/components/trips/RideActionPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type PassengerStats = {
  completed_trips: number;
  cancelled_trips: number;
  trips_this_month: number;
  total_spent: number;
  spent_this_month: number;
  average_rating: number;
  rating_count: number;
};

type PassengerActivity = {
  trip_id: string;
  origin_address: string;
  destination_address: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  final_price: number;
  amount_due: number;
  payment_method: string | null;
  payment_status: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_rating: number | null;
  review_rating: number | null;
  review_comment: string | null;
};

type SavedPlace = {
  id: string;
  type: "home" | "work" | "favorite";
  label: string;
  address: string;
};

type PassengerHomeProps = {
  name: string;
  email: string;
};

const EMPTY_STATS: PassengerStats = {
  completed_trips: 0,
  cancelled_trips: 0,
  trips_this_month: 0,
  total_spent: 0,
  spent_this_month: 0,
  average_rating: 0,
  rating_count: 0,
};

const activeTripStatuses = [
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

const tripStatusLabels: Record<string, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "Viaje en curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Fecha pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PassengerHome({
  name,
  email,
}: PassengerHomeProps) {
  const [stats, setStats] =
    useState<PassengerStats>(EMPTY_STATS);

  const [activity, setActivity] =
    useState<PassengerActivity[]>([]);

  const [places, setPlaces] =
    useState<SavedPlace[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadPassengerDashboard = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage(
          "Tu sesión ya no está disponible."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [
        statsResult,
        activityResult,
        placesResult,
      ] = await Promise.all([
        supabase.rpc(
          "get_passenger_dashboard_stats"
        ),

        supabase.rpc(
          "get_passenger_activity_history",
          {
            result_limit: 5,
          }
        ),

        supabase
          .from("saved_places")
          .select(
            "id, type, label, address"
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(3),
      ]);

      const errors = [
        statsResult.error,
        activityResult.error,
        placesResult.error,
      ].filter(Boolean);

      if (statsResult.data) {
        const resolvedStats =
          Array.isArray(statsResult.data)
            ? statsResult.data[0]
            : statsResult.data;

        setStats({
          ...EMPTY_STATS,
          ...(resolvedStats as
            | Partial<PassengerStats>
            | null),
        });
      }

      if (activityResult.data) {
        setActivity(
          activityResult.data as PassengerActivity[]
        );
      }

      if (placesResult.data) {
        setPlaces(
          placesResult.data as SavedPlace[]
        );
      }

      if (errors.length > 0) {
        setMessage(
          "Algunos datos no pudieron actualizarse, pero puedes seguir utilizando tu panel."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    []
  );

  useEffect(() => {
    const initialTimer =
      window.setTimeout(() => {
        void loadPassengerDashboard();
      }, 0);

    const channel = supabase
      .channel(
        `passenger-home-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
        },
        () => {
          void loadPassengerDashboard(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          void loadPassengerDashboard(true);
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadPassengerDashboard]);

  const activeTrips = useMemo(
    () =>
      activity.filter((item) =>
        activeTripStatuses.includes(
          item.status
        )
      ),
    [activity]
  );

  const pendingPayments = useMemo(
    () =>
      activity.filter(
        (item) =>
          item.status === "completed" &&
          item.payment_status !== "paid"
      ),
    [activity]
  );

  const latestTrip =
    activeTrips[0] ??
    activity[0] ??
    null;

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-80 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-9 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-9 lg:px-12 lg:py-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <Navigation size={15} />
              Movilidad inteligente
            </span>

            <p className="mt-6 text-sm font-semibold text-slate-400">
              Hola, {name}
            </p>

            <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              ¿A dónde vamos hoy?
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Solicita un viaje, revisa tu actividad y administra tus lugares frecuentes desde un solo panel.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/trips/new"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
              >
                <CarFront size={19} />
                Solicitar viaje
              </Link>

              <Link
                href="/dashboard/passenger/history"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 font-black text-white transition hover:bg-white/10"
              >
                Ver historial
                <ArrowRight size={19} />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Gasto del mes
                </p>

                <p className="mt-3 text-4xl font-black">
                  {formatMoney(
                    stats.spent_this_month
                  )}
                </p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <CircleDollarSign size={27} />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">
                  {stats.trips_this_month}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Viajes este mes
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">
                  {activeTrips.length}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Viajes activos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            loadPassengerDashboard(true)
          }
          disabled={refreshing}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-slate-950 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          {refreshing
            ? "Actualizando..."
            : "Actualizar panel"}
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Viajes completados"
          value={String(
            stats.completed_trips
          )}
          description="Historial total"
          icon={Route}
          iconClass="bg-blue-100 text-blue-700"
        />

        <MetricCard
          label="Gasto total"
          value={formatMoney(
            stats.total_spent
          )}
          description="En viajes completados"
          icon={CircleDollarSign}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <MetricCard
          label="Calificación"
          value={
            stats.rating_count > 0
              ? Number(
                  stats.average_rating
                ).toFixed(2)
              : "Nueva"
          }
          description={
            stats.rating_count > 0
              ? `${stats.rating_count} reseñas`
              : "Sin reseñas todavía"
          }
          icon={Star}
          iconClass="bg-amber-100 text-amber-700"
        />

        <MetricCard
          label="Pagos pendientes"
          value={String(
            pendingPayments.length
          )}
          description={
            pendingPayments.length > 0
              ? "Requieren atención"
              : "Todo está al corriente"
          }
          icon={CreditCard}
          iconClass="bg-violet-100 text-violet-700"
        />
      </div>

      <section>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Solicitud de viaje
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Encuentra tu próximo destino
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Consulta el mapa y comienza una nueva solicitud.
            </p>
          </div>

          <Badge variant="success">
            Sistema disponible
          </Badge>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.75fr]">
          <GoogleMapView />
          <RideActionPanel role="passenger" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Actividad reciente
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Últimos viajes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Revisa tus solicitudes y recorridos recientes.
              </p>
            </div>

            <Link
              href="/dashboard/passenger/history"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-black transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
            >
              Ver historial completo
              <ArrowRight size={17} />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="relative flex min-h-80 items-center justify-center overflow-hidden bg-slate-50 px-6 py-12">
              <div className="max-w-md text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                  <Route size={34} />
                </span>

                <h3 className="mt-6 text-2xl font-black">
                  Todavía no tienes viajes
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Solicita tu primer viaje para comenzar a construir tu historial.
                </p>

                <Link
                  href="/dashboard/trips/new"
                  className="mt-6 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black"
                >
                  Solicitar viaje
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:p-7">
              {activity.map((item) => (
                <article
                  key={item.trip_id}
                  className="rounded-[1.6rem] border border-slate-200 p-5 transition hover:border-slate-400"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex gap-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                          <MapPin size={20} />
                        </span>

                        <div className="min-w-0">
                          <h3 className="truncate font-black text-slate-950">
                            {item.origin_address}
                          </h3>

                          <p className="mt-1 truncate text-sm text-slate-500">
                            hacia{" "}
                            {item.destination_address}
                          </p>

                          <p className="mt-2 text-xs font-semibold text-slate-400">
                            {formatDate(
                              item.completed_at ??
                                item.requested_at
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-black",
                          item.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {tripStatusLabels[
                          item.status
                        ] ?? item.status}
                      </span>

                      <p className="min-w-28 text-right text-xl font-black text-slate-950">
                        {formatMoney(
                          item.amount_due ??
                            item.final_price
                        )}
                      </p>

                      <Link
                        href={`/dashboard/trips/${item.trip_id}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
                      >
                        Ver viaje
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="bg-[#0B0F19] text-white">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <Clock3 size={23} />
              </span>

              <Badge className="bg-white/10 text-white">
                Viaje reciente
              </Badge>
            </div>

            {latestTrip ? (
              <>
                <h2 className="mt-6 text-xl font-black">
                  {tripStatusLabels[
                    latestTrip.status
                  ] ?? latestTrip.status}
                </h2>

                <p className="mt-3 text-sm font-semibold text-slate-200">
                  {latestTrip.origin_address}
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  hacia{" "}
                  {latestTrip.destination_address}
                </p>

                <Link
                  href={`/dashboard/trips/${latestTrip.trip_id}`}
                  className="mt-6 flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 font-black transition hover:bg-white/10"
                >
                  Abrir viaje
                  <ArrowRight size={18} />
                </Link>
              </>
            ) : (
              <>
                <h2 className="mt-6 text-xl font-black">
                  Sin viajes recientes
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Tu siguiente viaje aparecerá aquí.
                </p>
              </>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Direcciones rápidas
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Lugares guardados
                </h2>
              </div>

              <Bookmark
                size={25}
                className="text-yellow-600"
              />
            </div>

            {places.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-500">
                  Aún no tienes lugares guardados.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {places.map((place) => (
                  <div
                    key={place.id}
                    className="rounded-2xl bg-slate-50 p-4"
                  >
                    <p className="font-black text-slate-800">
                      {place.label}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {place.address}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/dashboard/passenger/profile"
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 font-black transition hover:border-slate-950"
            >
              Administrar lugares
              <ArrowRight size={17} />
            </Link>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-[#0B0F19] text-white">
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <UserRound size={23} />
            </span>

            <Badge className="bg-white/10 text-white">
              Pasajero
            </Badge>
          </div>

          <h2 className="mt-6 text-2xl font-black">
            {name}
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            {email}
          </p>

          <Link
            href="/dashboard/profile"
            className="mt-6 flex h-13 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 font-black transition hover:bg-white/10"
          >
            Administrar perfil
            <ArrowRight size={18} />
          </Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Accesos rápidos
              </p>

              <h2 className="mt-1 text-xl font-black">
                Herramientas del pasajero
              </h2>
            </div>

            <ShieldCheck
              size={26}
              className="text-emerald-600"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <QuickLink
              href="/dashboard/trips/new"
              label="Solicitar viaje"
              icon={Navigation}
            />

            <QuickLink
              href="/dashboard/passenger/history"
              label="Historial"
              icon={History}
            />

            <QuickLink
              href="/dashboard/payments"
              label="Pagos"
              icon={CreditCard}
            />

            <QuickLink
              href="/dashboard/security"
              label="Seguridad"
              icon={ShieldCheck}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Route;
  iconClass: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          iconClass
        )}
      >
        <Icon size={22} />
      </span>

      <p className="mt-6 text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-3 text-sm text-slate-400">
        {description}
      </p>
    </Card>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Route;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
    >
      <Icon size={19} />
      {label}
    </Link>
  );
}
