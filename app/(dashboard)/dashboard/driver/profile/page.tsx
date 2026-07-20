"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CarFront,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Gauge,
  History,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import AvatarUploader from "@/components/profile/AvatarUploader";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isDriver } from "@/lib/auth/roles";
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

type DriverProfile = {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
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

export default function DriverProfilePage() {
  const router = useRouter();

  const [stats, setStats] =
    useState<DriverStats>(EMPTY_STATS);

  const [profile, setProfile] =
    useState<DriverProfile | null>(null);

  const [userId, setUserId] =
    useState<string | null>(null);

  const [activity, setActivity] =
    useState<DriverActivity[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadDriverProfile = useCallback(
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
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("full_name, phone, role, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (
        profileError ||
        !profileData ||
        !isDriver(profileData.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      setProfile({
        full_name: profileData.full_name,
        phone: profileData.phone,
        avatar_url: profileData.avatar_url,
      });

      const [
        statsResult,
        activityResult,
      ] = await Promise.all([
        supabase.rpc(
          "get_driver_dashboard_stats"
        ),
        supabase.rpc(
          "get_driver_activity_history",
          {
            result_limit: 50,
          }
        ),
      ]);

      if (statsResult.error) {
        setMessage(
          `Error cargando estadÃ­sticas: ${statsResult.error.message}`
        );
      } else {
        const resolvedStats =
          Array.isArray(statsResult.data)
            ? statsResult.data[0]
            : statsResult.data;

        setStats({
          ...EMPTY_STATS,
          ...(resolvedStats as Partial<DriverStats> | null),
        });
      }

      if (activityResult.error) {
        setMessage(
          `Error cargando historial: ${activityResult.error.message}`
        );
      } else {
        setActivity(
          (activityResult.data ?? []) as DriverActivity[]
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDriverProfile();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadDriverProfile]);

  function formatMoney(
    value: number | null
  ) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value ?? 0));
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return "Sin fecha";
    }

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value));
  }

  function formatHours(
    value: number
  ) {
    const hours = Number(value ?? 0);

    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }

    return `${hours.toFixed(1)} h`;
  }

  const totalDistance = useMemo(
    () =>
      activity.reduce(
        (total, item) =>
          total +
          Number(item.distance_km ?? 0),
        0
      ),
    [activity]
  );

  const totalActivityEarnings =
    useMemo(
      () =>
        activity.reduce(
          (total, item) =>
            total +
            Number(
              item.driver_earnings ?? 0
            ),
          0
        ),
      [activity]
    );

  const rating =
    Number(stats.average_rating ?? 0);

  const ratingLabel =
    stats.rating_count === 0
      ? "Sin reseÃ±as todavÃ­a"
      : rating >= 4.8
        ? "Servicio excelente"
        : rating >= 4.5
          ? "Muy buen servicio"
          : rating >= 4
            ? "Buen servicio"
            : "Sigue mejorando";

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-80 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="flex min-h-[65vh] items-center justify-center">
        <Card className="max-w-lg text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-red-100 text-red-700">
            <UserRound size={34} />
          </span>

          <h1 className="mt-6 text-3xl font-black text-slate-950">
            Perfil no disponible
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            {message ||
              "No fue posible cargar la cuenta del conductor."}
          </p>

          <Link
            href="/dashboard"
            className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </Link>
        </Card>
      </section>
    );
  }

  const displayName =
    profile.full_name ||
    "Conductor AXI";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative">
              <span className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-yellow-400 text-3xl font-black text-black shadow-2xl shadow-yellow-400/20">
                {initials || "AX"}
              </span>

              <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-4 border-slate-950 bg-emerald-500 text-white">
                <BadgeCheck size={18} />
              </span>
            </div>

            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                <Sparkles size={15} />
                Perfil del conductor
              </span>

              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                {displayName}
              </h1>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                  <Star
                    size={17}
                    className="fill-yellow-400 text-yellow-400"
                  />
                  {stats.rating_count > 0
                    ? rating.toFixed(2)
                    : "Nuevo"}
                </span>

                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                  <ShieldCheck
                    size={17}
                    className="text-emerald-400"
                  />
                  Cuenta verificada
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
            <button
              type="button"
              onClick={() =>
                loadDriverProfile(true)
              }
              disabled={refreshing}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw
                size={19}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshing
                ? "Actualizando..."
                : "Actualizar datos"}
            </button>

            <Link
              href="/dashboard/profile"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 font-black text-white transition hover:bg-white/10"
            >
              Editar mi perfil
              <ArrowRight size={19} />
            </Link>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <EarningsCard
          label="Ganancias de hoy"
          value={formatMoney(
            stats.earnings_today
          )}
          description={`${stats.trips_today} viaje${
            stats.trips_today === 1
              ? ""
              : "s"
          } realizado${
            stats.trips_today === 1
              ? ""
              : "s"
          } hoy`}
          icon={CircleDollarSign}
          highlighted
        />

        <EarningsCard
          label="Esta semana"
          value={formatMoney(
            stats.earnings_week
          )}
          description={`${stats.trips_week} viajes completados`}
          icon={TrendingUp}
        />

        <EarningsCard
          label="Este mes"
          value={formatMoney(
            stats.earnings_month
          )}
          description="Ganancia acumulada"
          icon={WalletCards}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Viajes completados"
          value={String(
            stats.completed_trips
          )}
          description="Historial total"
          icon={Route}
          iconClass="bg-blue-100 text-blue-700"
        />

        <StatCard
          label="Tiempo conectado"
          value={formatHours(
            stats.worked_hours
          )}
          description="Horas registradas"
          icon={Clock3}
          iconClass="bg-violet-100 text-violet-700"
        />

        <StatCard
          label="Distancia registrada"
          value={`${totalDistance.toFixed(
            1
          )} km`}
          description="Viajes recientes"
          icon={Navigation}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="CalificaciÃ³n"
          value={
            stats.rating_count > 0
              ? rating.toFixed(2)
              : "Nueva"
          }
          description={`${stats.rating_count} reseÃ±a${
            stats.rating_count === 1
              ? ""
              : "s"
          }`}
          icon={Star}
          iconClass="bg-yellow-100 text-yellow-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#facc15,#fde047)] p-7 text-black">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/30 blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-black text-yellow-400">
                    <Star size={24} />
                  </span>

                  <BadgeCheck size={26} />
                </div>

                <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-black/60">
                  ReputaciÃ³n AXI
                </p>

                <div className="mt-2 flex items-end gap-3">
                  <p className="text-5xl font-black">
                    {stats.rating_count > 0
                      ? rating.toFixed(2)
                      : "5.00"}
                  </p>

                  <p className="pb-1 font-black">
                    / 5
                  </p>
                </div>

                <p className="mt-3 text-sm font-bold text-black/65">
                  {ratingLabel}
                </p>

                <div className="mt-6 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(
                    (star) => (
                      <Star
                        key={star}
                        size={23}
                        className={cn(
                          star <=
                            Math.round(
                              rating || 5
                            )
                            ? "fill-black text-black"
                            : "text-black/20"
                        )}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-7 text-slate-500">
                Tu calificaciÃ³n se calcula con las
                reseÃ±as recibidas despuÃ©s de cada
                viaje completado.
              </p>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Total de reseÃ±as
                </p>

                <p className="mt-1 text-2xl font-black text-slate-950">
                  {stats.rating_count}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  InformaciÃ³n personal
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Datos de contacto
                </h2>
              </div>

              <UserRound
                size={25}
                className="text-yellow-600"
              />
            </div>

            <div className="mt-6 space-y-3">
              <ProfileDataRow
                label="Nombre"
                value={displayName}
                icon={UserRound}
              />

              <ProfileDataRow
                label="TelÃ©fono"
                value={
                  profile.phone ||
                  "Sin telÃ©fono registrado"
                }
                icon={Phone}
              />

              <ProfileDataRow
                label="Tipo de cuenta"
                value="Conductor AXI"
                icon={CarFront}
              />
            </div>

            <Link
              href="/dashboard/profile"
              className="mt-6 flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
            >
              Administrar datos
              <ChevronRight size={18} />
            </Link>
          </Card>

          <Card className="bg-[#0B0F19] text-white">
            <Gauge
              size={28}
              className="text-yellow-400"
            />

            <h2 className="mt-5 text-2xl font-black">
              Inicia tu jornada
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              Actualiza tu GPS y activa tu
              disponibilidad para comenzar a
              recibir solicitudes.
            </p>

            <Link
              href="/dashboard/driver/status"
              className="mt-6 flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300"
            >
              Ir a disponibilidad
              <ArrowRight size={19} />
            </Link>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Historial del conductor
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Actividad reciente
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Viajes completados, ganancias y
                  reseÃ±as recibidas.
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-right">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                  Ganancia mostrada
                </p>

                <p className="mt-1 text-xl font-black text-emerald-800">
                  {formatMoney(
                    totalActivityEarnings
                  )}
                </p>
              </div>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="relative flex min-h-[650px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

              <div className="relative max-w-md text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                  <History size={35} />
                </span>

                <h3 className="mt-7 text-3xl font-black text-slate-950">
                  TodavÃ­a no hay viajes completados
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-500">
                  Cuando completes tu primer viaje,
                  aquÃ­ aparecerÃ¡n la ruta, ganancia,
                  distancia, duraciÃ³n y calificaciÃ³n.
                </p>

                <Link
                  href="/dashboard/driver/available-trips"
                  className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
                >
                  Ver viajes disponibles
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activity.map((item) => (
                <ActivityCard
                  key={item.trip_id}
                  item={item}
                  formatMoney={formatMoney}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function EarningsCard({
  label,
  value,
  description,
  icon: Icon,
  highlighted = false,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof CircleDollarSign;
  highlighted?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        highlighted &&
          "bg-[#0B0F19] text-white"
      )}
    >
      {highlighted && (
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-yellow-400/15 blur-2xl" />
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              highlighted
                ? "text-slate-400"
                : "text-slate-500"
            )}
          >
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight">
            {value}
          </p>

          <p
            className={cn(
              "mt-3 text-xs font-semibold",
              highlighted
                ? "text-slate-500"
                : "text-slate-400"
            )}
          >
            {description}
          </p>
        </div>

        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            highlighted
              ? "bg-yellow-400 text-black"
              : "bg-emerald-100 text-emerald-700"
          )}
        >
          <Icon size={22} />
        </span>
      </div>
    </Card>
  );
}

function StatCard({
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
    <Card className="transition duration-300 hover:-translate-y-1 hover:shadow-xl">
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

      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-3 text-xs font-semibold text-slate-400">
        {description}
      </p>
    </Card>
  );
}

function ProfileDataRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
        <Icon size={20} />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-1 truncate font-black text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function ActivityCard({
  item,
  formatMoney,
  formatDate,
}: {
  item: DriverActivity;
  formatMoney: (
    value: number | null
  ) => string;
  formatDate: (
    value: string | null
  ) => string;
}) {
  return (
    <article className="p-6 transition hover:bg-slate-50 sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex gap-4">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <MapPin size={19} />
              </span>

              <span className="my-2 h-10 border-l-2 border-dashed border-slate-300" />

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <Navigation size={19} />
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Punto de partida
                </p>

                <h3 className="mt-1 font-black leading-6 text-slate-950">
                  {item.origin_address}
                </h3>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Destino
                </p>

                <p className="mt-1 font-black leading-6 text-slate-950">
                  {item.destination_address}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
              <CalendarDays size={14} />
              {formatDate(
                item.completed_at
              )}
            </span>

            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
              <Route size={14} />
              {item.distance_km !== null
                ? `${Number(
                    item.distance_km
                  ).toFixed(2)} km`
                : "Sin distancia"}
            </span>

            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
              <Clock3 size={14} />
              {item.duration_minutes !== null
                ? `${item.duration_minutes} min`
                : "Sin duraciÃ³n"}
            </span>
          </div>
        </div>

        <div className="xl:w-72 xl:text-right">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Ganancia del conductor
          </p>

          <p className="mt-1 text-3xl font-black text-emerald-600">
            {formatMoney(
              item.driver_earnings
            )}
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-400">
            Total del viaje:{" "}
            {formatMoney(item.final_price)}
          </p>

          {item.passenger_rating !== null ? (
            <div className="mt-5 rounded-2xl border border-yellow-100 bg-yellow-50 p-4 text-left">
              <div className="flex items-center gap-2">
                <Star
                  size={17}
                  className="fill-yellow-500 text-yellow-500"
                />

                <p className="font-black text-yellow-900">
                  {item.passenger_rating} de 5
                </p>
              </div>

              <p className="mt-2 text-sm leading-6 text-yellow-800">
                {item.passenger_comment ||
                  "El pasajero no dejÃ³ comentario."}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left">
              <p className="text-xs font-semibold text-slate-400">
                Este viaje todavÃ­a no tiene
                calificaciÃ³n.
              </p>
            </div>
          )}

          <Link
            href={`/dashboard/trips/${item.trip_id}`}
            className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
          >
            Ver detalles
            <ChevronRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}






