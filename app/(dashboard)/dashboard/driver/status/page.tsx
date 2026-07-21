"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CarFront,
  CheckCircle2,
  Clock3,
  Gauge,
  LocateFixed,
  MapPin,
  Navigation,
  PauseCircle,
  PlayCircle,
  Power,
  Radio,
  RefreshCw,
  Route,
  Satellite,
  ShieldCheck,
  Signal,
  SignalZero,
  Star,
  WalletCards,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isDriver } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type DriverOperationalStatus =
  | "offline"
  | "available"
  | "offer_pending"
  | "to_pickup"
  | "on_trip"
  | "paused";

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

const operationalStatusLabels: Record<
  DriverOperationalStatus,
  string
> = {
  offline: "Fuera de línea",
  available: "Disponible",
  offer_pending: "Oferta pendiente",
  to_pickup: "Recogiendo pasajero",
  on_trip: "En viaje",
  paused: "Solicitudes pausadas",
};

const operationalStatusDescriptions: Record<
  DriverOperationalStatus,
  string
> = {
  offline:
    "Conéctate para comenzar a recibir solicitudes de viaje.",
  available:
    "Estás disponible y puedes recibir nuevas solicitudes.",
  offer_pending:
    "Tienes una solicitud pendiente por aceptar o rechazar.",
  to_pickup:
    "Tienes un viaje aceptado y debes dirigirte al pasajero.",
  on_trip:
    "Actualmente estás realizando un viaje.",
  paused:
    "Sigues conectado, pero no recibirás nuevas solicitudes.",
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

export default function DriverStatusPage() {
  const router = useRouter();

  const [online, setOnline] = useState(false);
  const [
    operationalStatus,
    setOperationalStatus,
  ] = useState<DriverOperationalStatus>("offline");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [stats, setStats] = useState<DriverStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [message, setMessage] = useState("");

  const locationWatchId = useRef<number | null>(null);
  const locationHeartbeatId = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const lastLocationUpdate = useRef(0);
  const latestLocation = useRef<{
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number;
  } | null>(null);

  const loadDriverStatus = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshingStats(true);
      } else {
        setLoading(true);
      }

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

      if (!isDriver(profile?.role)) {
        router.replace("/dashboard");
        return;
      }

      const [
        driverResult,
        statsResult,
      ] = await Promise.all([
        supabase
          .from("drivers")
          .select(
            "online, operational_status, current_lat, current_lng"
          )
          .eq("id", session.user.id)
          .single(),

        supabase.rpc(
          "get_driver_dashboard_stats"
        ),
      ]);

      if (driverResult.error) {
        setMessage(
          `Error cargando estado: ${driverResult.error.message}`
        );
      } else {
        setOnline(
          Boolean(driverResult.data.online)
        );
        setOperationalStatus(
          (
            driverResult.data.operational_status ??
            (driverResult.data.online
              ? "available"
              : "offline")
          ) as DriverOperationalStatus
        );
        setLatitude(
          driverResult.data.current_lat
        );
        setLongitude(
          driverResult.data.current_lng
        );
      }

      if (statsResult.error) {
        setMessage(
          `Error cargando estadísticas: ${statsResult.error.message}`
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

      setLoading(false);
      setRefreshingStats(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDriverStatus();
  }, [loadDriverStatus]);

  useEffect(() => {
    const channel = supabase
      .channel(
        `driver-operational-status-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
        },
        (payload) => {
          const nextDriver = payload.new as {
            id?: string;
            online?: boolean;
            operational_status?: DriverOperationalStatus;
          };

          void supabase.auth
            .getSession()
            .then(({ data }) => {
              if (
                data.session?.user.id !==
                nextDriver.id
              ) {
                return;
              }

              setOnline(
                Boolean(nextDriver.online)
              );

              if (
                nextDriver.operational_status
              ) {
                setOperationalStatus(
                  nextDriver.operational_status
                );
              }
            });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const clearLocationTracking = () => {
      if (
        locationWatchId.current !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          locationWatchId.current
        );

        locationWatchId.current = null;
      }

      if (locationHeartbeatId.current !== null) {
        clearInterval(locationHeartbeatId.current);
        locationHeartbeatId.current = null;
      }
    };

    if (!online || !navigator.geolocation) {
      clearLocationTracking();
      return;
    }

    const sendLocationToSupabase = async (
      location: {
        latitude: number;
        longitude: number;
        speed: number | null;
        heading: number | null;
        accuracy: number;
      }
    ) => {
      const { error } = await supabase.rpc(
        "update_driver_location",
        {
          latitude_value: location.latitude,
          longitude_value: location.longitude,
          speed_value: location.speed,
          heading_value: location.heading,
          accuracy_value: location.accuracy,
        }
      );

      if (error) {
        console.error(
          "Error actualizando GPS continuo:",
          error.message
        );
      }
    };

    const handlePosition = (
      position: GeolocationPosition
    ) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        accuracy: position.coords.accuracy,
      };

      latestLocation.current = location;

      setLatitude(location.latitude);
      setLongitude(location.longitude);
      setAccuracy(location.accuracy);

      const now = Date.now();

      if (
        now - lastLocationUpdate.current >=
        5000
      ) {
        lastLocationUpdate.current = now;
        void sendLocationToSupabase(location);
      }
    };

    const handleLocationError = (
      error: GeolocationPositionError
    ) => {
      if (
        error.code ===
        error.PERMISSION_DENIED
      ) {
        setMessage(
          "Debes permitir el acceso continuo al GPS para permanecer en línea."
        );
      } else {
        console.error(
          "Error obteniendo ubicación:",
          error.message
        );
      }
    };

    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      }
    );

    locationWatchId.current =
      navigator.geolocation.watchPosition(
        handlePosition,
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000,
        }
      );

    locationHeartbeatId.current =
      setInterval(() => {
        if (latestLocation.current) {
          void sendLocationToSupabase(
            latestLocation.current
          );
        }
      }, 30000);

    return clearLocationTracking;
  }, [online]);

  function shareLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("Tu navegador no permite utilizar la ubicación.");
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
    if (processing) {
      return;
    }

    setProcessing(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        setMessage(
          "Tu sesión terminó. Inicia sesión nuevamente."
        );
        router.push("/login");
        return;
      }

      if (nextOnline) {
        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "full_name, phone, avatar_url, account_active"
          )
          .eq("id", session.user.id)
          .single();

        if (profileError) {
          setMessage(
            `Error revisando tu perfil: ${profileError.message}`
          );
          return;
        }

        if (profile.account_active === false) {
          setMessage(
            "Tu cuenta está suspendida. Comunícate con soporte."
          );
          return;
        }

        const missingRequirements: string[] = [];

        if (!profile.full_name?.trim()) {
          missingRequirements.push("nombre completo");
        }

        if (!profile.phone?.trim()) {
          missingRequirements.push("teléfono");
        }

        if (!profile.avatar_url?.trim()) {
          missingRequirements.push("foto de perfil");
        }

        if (missingRequirements.length > 0) {
          setMessage(
            `Completa tu ${missingRequirements.join(
              ", "
            )} antes de ponerte en línea.`
          );
          return;
        }

        if (!navigator.geolocation) {
          setMessage(
            "Tu navegador no permite utilizar el GPS."
          );
          return;
        }

        let position: GeolocationPosition;

        try {
          position =
            await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0,
                  }
                );
              }
            );
        } catch (locationError) {
          const error =
            locationError as GeolocationPositionError;

          if (
            error.code ===
            GeolocationPositionError.PERMISSION_DENIED
          ) {
            setMessage(
              "Debes permitir el acceso a tu ubicación para ponerte en línea."
            );
            return;
          }

          if (
            error.code ===
            GeolocationPositionError.POSITION_UNAVAILABLE
          ) {
            setMessage(
              "No pudimos detectar tu ubicación. Activa el GPS e inténtalo nuevamente."
            );
            return;
          }

          setMessage(
            "La ubicación tardó demasiado en responder. Inténtalo nuevamente."
          );
          return;
        }

        const newLatitude =
          position.coords.latitude;
        const newLongitude =
          position.coords.longitude;
        const newAccuracy =
          position.coords.accuracy;

        const { error: locationError } =
          await supabase.rpc(
            "update_driver_location",
            {
              latitude_value: newLatitude,
              longitude_value: newLongitude,
              speed_value:
                position.coords.speed,
              heading_value:
                position.coords.heading,
              accuracy_value:
                newAccuracy,
            }
          );

        if (locationError) {
          setMessage(
            `Error actualizando ubicación: ${locationError.message}`
          );
          return;
        }

        setLatitude(newLatitude);
        setLongitude(newLongitude);
        setAccuracy(newAccuracy);

        lastLocationUpdate.current =
          Date.now();
      }

      const { error: onlineError } =
        await supabase.rpc(
          "set_driver_online",
          {
            online_status: nextOnline,
          }
        );

      if (onlineError) {
        setMessage(
          `Error cambiando tu estado: ${onlineError.message}`
        );
        return;
      }

      setOnline(nextOnline);

      setOperationalStatus(
        nextOnline ? "available" : "offline"
      );

      setMessage(
        nextOnline
          ? "Ya estás en línea y disponible para recibir viajes."
          : "Terminaste tu jornada y ahora estás fuera de línea."
      );
    } catch (unexpectedError) {
      console.error(
        "Error cambiando estado del conductor:",
        unexpectedError
      );

      setMessage(
        unexpectedError instanceof Error
          ? `Error inesperado: ${unexpectedError.message}`
          : "Ocurrió un error inesperado."
      );
    } finally {
      setProcessing(false);
    }
  }
  async function changeOperationalStatus(
    nextStatus: "available" | "paused"
  ) {
    setProcessing(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "set_driver_operational_status",
      {
        next_status: nextStatus,
      }
    );

    setProcessing(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    const resolvedStatus =
      (data ?? nextStatus) as DriverOperationalStatus;

    setOperationalStatus(resolvedStatus);

    setMessage(
      resolvedStatus === "paused"
        ? "Pausaste las solicitudes. Seguirás conectado y compartiendo tu ubicación."
        : "Reanudaste las solicitudes y ya estás disponible."
    );
  }

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

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="h-[430px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[430px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  const hasLocation =
    latitude !== null && longitude !== null;

  const currentStatusLabel =
    operationalStatusLabels[operationalStatus];

  const currentStatusDescription =
    operationalStatusDescriptions[operationalStatus];

  const isBusy =
    operationalStatus === "to_pickup" ||
    operationalStatus === "on_trip";

  const canPause =
    online &&
    operationalStatus === "available";

  const canResume =
    online &&
    operationalStatus === "paused";

  const locationQuality =
    accuracy === null
      ? "Sin medición"
      : accuracy <= 20
        ? "Excelente"
        : accuracy <= 50
          ? "Buena"
          : "Limitada";

  return (
    <section className="space-y-8">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10",
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

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]",
                online
                  ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-yellow-300"
              )}
            >
              {online ? (
                <Signal size={15} />
              ) : (
                <SignalZero size={15} />
              )}

              {currentStatusLabel}
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              {operationalStatus === "available"
                ? "Ya puedes recibir viajes"
                : operationalStatus === "offer_pending"
                  ? "Tienes una nueva solicitud"
                  : operationalStatus === "to_pickup"
                    ? "Dirígete al pasajero"
                    : operationalStatus === "on_trip"
                      ? "Viaje en curso"
                      : operationalStatus === "paused"
                        ? "Solicitudes pausadas"
                        : "Inicia tu jornada con AXI"}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {currentStatusDescription} Mientras permanezcas en línea,
              AXI actualizará automáticamente tu posición para solicitudes
              y viajes activos.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Satellite size={18} className="text-yellow-400" />
                GPS {hasLocation ? "listo" : "pendiente"}
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ShieldCheck size={18} className="text-yellow-400" />
                Cuenta verificada
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Estado actual
                </p>

                <p className="mt-2 text-3xl font-black">
                  {currentStatusLabel}
                </p>
              </div>

              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl",
                  online
                    ? "bg-emerald-400 text-emerald-950"
                    : "bg-yellow-400 text-black"
                )}
              >
                <Power size={26} />
              </span>
            </div>

            {(canPause || canResume) && (
              <button
                type="button"
                onClick={() =>
                  changeOperationalStatus(
                    canPause
                      ? "paused"
                      : "available"
                  )
                }
                disabled={processing}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 font-black text-white transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-50"
              >
                {canPause ? (
                  <PauseCircle size={20} />
                ) : (
                  <PlayCircle size={20} />
                )}

                {processing
                  ? "Procesando..."
                  : canPause
                    ? "Pausar solicitudes"
                    : "Reanudar solicitudes"}
              </button>
            )}

            <button
              type="button"
              onClick={() => changeOnlineStatus(!online)}
              disabled={processing || isBusy}
              className={cn(
                "flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 font-black transition disabled:pointer-events-none disabled:opacity-50",
                canPause || canResume
                  ? "mt-3"
                  : "mt-6",
                online
                  ? "bg-white text-red-700 hover:bg-red-50"
                  : "bg-yellow-400 text-black hover:bg-yellow-300"
              )}
            >
              {processing
                ? "Procesando..."
                : isBusy
                  ? "Viaje activo"
                  : online
                    ? "Terminar jornada"
                    : "Ponerme en línea"}

              {!processing && <ArrowRight size={19} />}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.toLowerCase().includes("error") ||
              message.toLowerCase().includes("debes") ||
              message.toLowerCase().includes("no pudimos")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Posición del conductor
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Ubicación GPS
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Actualiza tu ubicación antes de conectarte.
                </p>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <LocateFixed size={23} />
              </span>
            </div>
          </div>

          <div className="relative min-h-[330px] overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.18),_transparent_30%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)] p-6 sm:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.6)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,0.6)_2px,transparent_2px)] bg-[size:55px_55px] opacity-70" />

            <div className="relative flex min-h-[280px] flex-col justify-between">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur">
                  <MapPin size={21} className="text-emerald-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                    Latitud
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {latitude !== null
                      ? Number(latitude).toFixed(6)
                      : "Pendiente"}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur">
                  <Navigation size={21} className="text-yellow-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                    Longitud
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {longitude !== null
                      ? Number(longitude).toFixed(6)
                      : "Pendiente"}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur">
                  <Gauge size={21} className="text-blue-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                    Precisión
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {accuracy !== null
                      ? `${Math.round(accuracy)} m`
                      : locationQuality}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={shareLocation}
                disabled={locating}
                className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
              >
                <RefreshCw
                  size={19}
                  className={locating ? "animate-spin" : ""}
                />

                {locating
                  ? "Obteniendo ubicación..."
                  : hasLocation
                    ? "Actualizar mi ubicación"
                    : "Compartir mi ubicación"}
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Resumen real
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Jornada de hoy
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadDriverStatus(true)
                }
                disabled={refreshingStats}
                aria-label="Actualizar estadísticas"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700 transition hover:bg-yellow-200 disabled:opacity-50"
              >
                <RefreshCw
                  size={20}
                  className={
                    refreshingStats
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-slate-50 p-5">
                <Route
                  size={21}
                  className="text-blue-600"
                />

                <p className="mt-5 text-3xl font-black">
                  {stats.trips_today}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Viajes de hoy
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <Clock3
                  size={21}
                  className="text-violet-600"
                />

                <p className="mt-5 text-3xl font-black">
                  {formatHours(
                    stats.worked_hours
                  )}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Horas trabajadas
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <Star
                  size={21}
                  className="text-amber-500"
                />

                <p className="mt-5 text-3xl font-black">
                  {stats.rating_count > 0
                    ? Number(
                        stats.average_rating
                      ).toFixed(2)
                    : "—"}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  {stats.rating_count} reseña
                  {stats.rating_count === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <Activity
                  size={21}
                  className="text-emerald-600"
                />

                <p className="mt-5 text-3xl font-black">
                  {stats.completed_trips}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Viajes históricos
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl bg-[#0B0F19] p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    Ganancias de hoy
                  </p>

                  <p className="mt-2 text-4xl font-black">
                    {formatMoney(
                      stats.earnings_today
                    )}
                  </p>
                </div>

                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                  <WalletCards size={22} />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs text-slate-500">
                    Esta semana
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {formatMoney(
                      stats.earnings_week
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Este mes
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {formatMoney(
                      stats.earnings_month
                    )}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard/driver/profile"
              className="mt-4 flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
            >
              Ver ganancias e historial
              <ArrowRight size={18} />
            </Link>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-13 w-13 items-center justify-center rounded-2xl",
                  hasLocation
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {hasLocation ? (
                  <CheckCircle2 size={23} />
                ) : (
                  <Radio size={23} />
                )}
              </span>

              <div>
                <h2 className="text-lg font-black">
                  {hasLocation
                    ? "GPS preparado"
                    : "Falta compartir GPS"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {hasLocation
                    ? "Tu posición está lista para recibir solicitudes."
                    : "AXI necesita tu ubicación para mostrarte viajes cercanos."}
                </p>
              </div>
            </div>
          </Card>

          <Link
            href="/dashboard/driver/available-trips"
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
          >
            <CarFront size={20} />
            Ver viajes disponibles
          </Link>
        </div>
      </div>
    </section>
  );
}


