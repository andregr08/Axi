"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CarFront,
  CircleDollarSign,

  Gauge,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

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

type DriverState = {
  online: boolean;
  verified: boolean;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
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
};

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  plates: string;
  status: string;
  verified: boolean;
  is_primary: boolean;
};

type DriverHomeProps = {
  name: string;
  email: string;
};

const EMPTY_STATS: DriverStats = {
  earnings_today: 0,
  earnings_week: 0,
  earnings_month: 0,
  completed_trips: 0,
  trips_today: 0,
  trips_week: 0,
  worked_hours: 0,
  average_rating: 0,
  rating_count: 0,
};

export function DriverHome({
  name,
  email,
}: DriverHomeProps) {
  const [stats, setStats] =
    useState<DriverStats>(EMPTY_STATS);

  const [driver, setDriver] =
    useState<DriverState | null>(null);

  const [activity, setActivity] =
    useState<DriverActivity[]>([]);

  const [vehicle, setVehicle] =
    useState<Vehicle | null>(null);

  const [activeOffers, setActiveOffers] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadDriverDashboard = useCallback(
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

      console.log("[AXI DRIVER] SESSION USER ID:", session?.user.id);
      console.log("[AXI DRIVER] SESSION EMAIL:", session?.user.email);

      if (!session) {
        setMessage("Tu sesión ya no está disponible.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const now = new Date().toISOString();

      const [
        driverResult,
        statsResult,
        activityResult,
        vehicleResult,
        offersResult,
      ] = await Promise.all([
        supabase
          .from("drivers")
          .select(
            "online, verified, status, current_lat, current_lng"
          )
          .eq("id", session.user.id)
          .maybeSingle(),

        supabase.rpc(
          "get_driver_dashboard_stats"
        ),

        supabase.rpc(
          "get_driver_activity_history",
          {
            result_limit: 3,
          }
        ),

        supabase
          .from("vehicles")
          .select(
            "id, brand, model, plates, status, verified, is_primary"
          )
          .eq("driver_id", session.user.id)
          .order("is_primary", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("trip_offers")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("driver_id", session.user.id)
          .eq("status", "pending")
          .gt("expires_at", now),
      ]);

      const errors = [
        driverResult.error,
        statsResult.error,
        activityResult.error,
        vehicleResult.error,
        offersResult.error,
      ].filter(Boolean);

      if (driverResult.data) {
        setDriver(
          driverResult.data as DriverState
        );
      }

      if (statsResult.data) {
        const resolvedStats =
          Array.isArray(statsResult.data)
            ? statsResult.data[0]
            : statsResult.data;

        setStats({
          ...EMPTY_STATS,
          ...(resolvedStats as Partial<DriverStats>),
        });
      }

      if (activityResult.data) {
        setActivity(
          activityResult.data as DriverActivity[]
        );
      }

      setVehicle(
        vehicleResult.data as Vehicle | null
      );

      setActiveOffers(
        offersResult.count ?? 0
      );

      if (errors.length > 0) {
        setMessage(
          "Algunos datos no pudieron actualizarse. Puedes seguir utilizando tu panel."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    []
  );

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void loadDriverDashboard();
    }, 0);

    const channel = supabase
      .channel(
        `driver-home-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_offers",
        },
        () => {
          void loadDriverDashboard(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
        },
        () => {
          void loadDriverDashboard(true);
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadDriverDashboard]);

  function formatMoney(value: number) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value ?? 0));
  }

  function formatHours(value: number) {
    const hours = Number(value ?? 0);

    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }

    return `${hours.toFixed(1)} h`;
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "Fecha pendiente";
    }

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value));
  }

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

  const online = Boolean(driver?.online);
  const verified = Boolean(driver?.verified);
  const hasGps =
    driver?.current_lat !== null &&
    driver?.current_lat !== undefined &&
    driver?.current_lng !== null &&
    driver?.current_lng !== undefined;

  return (
    <section className="space-y-8">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] px-6 py-9 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-9 lg:px-12 lg:py-12",
          online
            ? "bg-[linear-gradient(120deg,#052e16,#166534)]"
            : "bg-[#0B0F19]"
        )}
      >
        <div
          className={cn(
            "absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl",
            online
              ? "bg-emerald-400/20"
              : "bg-yellow-400/20"
          )}
        />

        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]",
                online
                  ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-yellow-300"
              )}
            >
              <Radio size={15} />
              {online
                ? "Conductor en línea"
                : "Conductor desconectado"}
            </span>

            <p className="mt-6 text-sm font-semibold text-slate-400">
              Hola, {name}
            </p>

            <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              {online
                ? "Tu jornada está activa"
                : "Tu jornada empieza aquí"}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Consulta solicitudes cercanas, controla tu disponibilidad y revisa tus ganancias reales desde un solo lugar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/driver/status"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
              >
                <Gauge size={19} />
                {online
                  ? "Administrar disponibilidad"
                  : "Ponerme en línea"}
              </Link>

              <Link
                href="/dashboard/driver/available-trips"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 font-black text-white transition hover:bg-white/10"
              >
                Ver viajes disponibles
                <ArrowRight size={19} />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Ganancias de hoy
                </p>

                <p className="mt-3 text-4xl font-black">
                  {formatMoney(
                    stats.earnings_today
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
                  {stats.trips_today}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Viajes hoy
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">
                  {formatHours(
                    stats.worked_hours
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Tiempo trabajado
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
            loadDriverDashboard(true)
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
          label="Ganancias semanales"
          value={formatMoney(
            stats.earnings_week
          )}
          description={`${stats.trips_week} viajes esta semana`}
          icon={CircleDollarSign}
          iconClass="bg-emerald-100 text-emerald-700"
        />

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
          label="Ofertas activas"
          value={String(activeOffers)}
          description={
            activeOffers > 0
              ? "Esperando tu respuesta"
              : "Sin solicitudes pendientes"
          }
          icon={Activity}
          iconClass="bg-violet-100 text-violet-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Operación en vivo
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Mapa del conductor
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Revisa tu posición y la operación disponible cerca de ti.
              </p>
            </div>

            <Badge
              variant={
                online
                  ? "success"
                  : "warning"
              }
            >
              {online
                ? "En línea"
                : "Fuera de línea"}
            </Badge>
          </div>

          <GoogleMapView />
        </div>

        <div className="space-y-6">
          <Card className="bg-[#0B0F19] text-white">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <CarFront size={23} />
              </span>

              <Badge className="bg-white/10 text-white">
                Mi unidad
              </Badge>
            </div>

            {vehicle ? (
              <>
                <h2 className="mt-6 text-2xl font-black">
                  {vehicle.brand}{" "}
                  {vehicle.model}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Placas {vehicle.plates}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-black",
                      vehicle.status === "active"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    )}
                  >
                    {vehicle.status === "active"
                      ? "Activo"
                      : vehicle.status}
                  </span>

                  <span
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-black",
                      vehicle.verified
                        ? "bg-blue-500/15 text-blue-300"
                        : "bg-white/10 text-slate-300"
                    )}
                  >
                    {vehicle.verified
                      ? "Verificado"
                      : "Sin verificar"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-6 text-2xl font-black">
                  Sin vehículo registrado
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Registra una unidad para completar tu cuenta de conductor.
                </p>
              </>
            )}

            <Link
              href="/dashboard/vehicles"
              className="mt-6 flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 font-black transition hover:bg-white/10"
            >
              Administrar vehículo
              <ArrowRight size={18} />
            </Link>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Preparación
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Estado operativo
                </h2>
              </div>

              <ShieldCheck
                size={25}
                className={
                  verified
                    ? "text-emerald-600"
                    : "text-amber-600"
                }
              />
            </div>

            <div className="mt-6 space-y-3">
              <StatusRow
                label="Cuenta de conductor"
                ready={
                  driver?.status === "active"
                }
                value={
                  driver?.status === "active"
                    ? "Activa"
                    : driver?.status ||
                      "Pendiente"
                }
              />

              <StatusRow
                label="Verificación"
                ready={verified}
                value={
                  verified
                    ? "Verificada"
                    : "Pendiente"
                }
              />

              <StatusRow
                label="Ubicación GPS"
                ready={hasGps}
                value={
                  hasGps
                    ? "Disponible"
                    : "Sin actualizar"
                }
              />

              <StatusRow
                label="Disponibilidad"
                ready={online}
                value={
                  online
                    ? "En línea"
                    : "Desconectado"
                }
              />
            </div>
          </Card>
        </div>
      </div>

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
              Tus recorridos y ganancias más recientes.
            </p>
          </div>

          <Link
            href="/dashboard/driver/profile"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-black transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
          >
            Ver perfil completo
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
                Todavía no tienes viajes completados
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                Ponte en línea para comenzar a recibir solicitudes cercanas.
              </p>

              <Link
                href="/dashboard/driver/status"
                className="mt-6 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black"
              >
                Revisar disponibilidad
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
                            item.completed_at
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {item.distance_km !== null && (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                        {Number(
                          item.distance_km
                        ).toFixed(1)}{" "}
                        km
                      </span>
                    )}

                    {item.passenger_rating !== null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
                        <Star size={14} />
                        {item.passenger_rating}
                      </span>
                    )}

                    <p className="min-w-28 text-right text-xl font-black text-emerald-600">
                      {formatMoney(
                        item.driver_earnings
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/*
        <Card className="bg-[#0B0F19] text-white">
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <UserRound size={23} />
            </span>

            <Badge className="bg-white/10 text-white">
              Conductor
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
        */}

        {/*
<Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Accesos rápidos
              </p>

              <h2 className="mt-1 text-xl font-black">
                Herramientas del conductor
              </h2>
            </div>

            <BadgeCheck
              size={26}
              className="text-emerald-600"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <QuickLink
              href="/dashboard/driver/available-trips"
              label="Viajes disponibles"
              icon={CarFront}
            />

            <QuickLink
              href="/dashboard/driver/status"
              label="Disponibilidad"
              icon={Gauge}
            />

            <QuickLink
              href="/dashboard/payments"
              label="Ganancias y pagos"
              icon={CircleDollarSign}
            />

            <QuickLink
              href="/dashboard/vehicles"
              label="Mi vehículo"
              icon={CarFront}
            />
          </div>
        </Card>
*/}
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
      <div className="relative">
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
      </div>
    </Card>
  );
}

function StatusRow({
  label,
  ready,
  value,
}: {
  label: string;
  ready: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "h-3 w-3 rounded-full",
            ready
              ? "bg-emerald-500"
              : "bg-amber-400"
          )}
        />

        <span className="text-sm font-black text-slate-700">
          {label}
        </span>
      </div>

      <span className="text-xs font-bold text-slate-500">
        {value}
      </span>
    </div>
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
