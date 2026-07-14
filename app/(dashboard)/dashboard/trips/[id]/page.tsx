"use client";

import Link from "next/link";
import {
  use,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  CircleDollarSign,
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  Star,
  TimerReset,
  UserRound,
  XCircle,
} from "lucide-react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { SOSButton } from "@/components/safety/SOSButton";
import {
  DriverIdentityCard,
  type DriverIdentity,
} from "@/components/safety/DriverIdentityCard";
import { TripPinCard } from "@/components/safety/TripPinCard";
import { ShareTripCard } from "@/components/trips/ShareTripCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type UserRole = "admin" | "driver" | "passenger";

type TripStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type Trip = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const statusLabels: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "Viaje en curso",
  completed: "Viaje completado",
  cancelled: "Viaje cancelado",
};

const statusDescriptions: Record<TripStatus, string> = {
  requested: "La solicitud fue creada correctamente.",
  searching: "AXI está buscando un conductor cercano.",
  accepted: "Un conductor aceptó el viaje.",
  driver_arriving: "El conductor se dirige al punto de origen.",
  driver_arrived: "El conductor ya se encuentra en el punto de origen.",
  in_progress: "El viaje se encuentra en curso.",
  completed: "El recorrido terminó correctamente.",
  cancelled: "La solicitud fue cancelada.",
};

const nextDriverAction: Partial<
  Record<
    TripStatus,
    {
      status: TripStatus;
      label: string;
    }
  >
> = {
  accepted: {
    status: "driver_arriving",
    label: "Voy en camino",
  },
  driver_arriving: {
    status: "driver_arrived",
    label: "Ya llegué",
  },
  driver_arrived: {
    status: "in_progress",
    label: "Iniciar viaje",
  },
  in_progress: {
    status: "completed",
    label: "Finalizar viaje",
  },
};

const progressSteps: Array<{
  status: TripStatus;
  label: string;
}> = [
  {
    status: "accepted",
    label: "Aceptado",
  },
  {
    status: "driver_arriving",
    label: "En camino",
  },
  {
    status: "driver_arrived",
    label: "Llegó",
  },
  {
    status: "in_progress",
    label: "En curso",
  },
  {
    status: "completed",
    label: "Completado",
  },
];

function formatCurrency(value: number | null) {
  if (value === null) return "Por calcular";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusVariant(
  status: TripStatus
): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";

  if (
    status === "requested" ||
    status === "searching" ||
    status === "accepted"
  ) {
    return "warning";
  }

  return "default";
}

export default function ActiveTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverIdentity, setDriverIdentity] =
    useState<DriverIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [message, setMessage] = useState("");

  const loadTrip = useCallback(async () => {
    const { data, error } = await supabase
      .from("trips")
      .select(`
        id,
        passenger_id,
        driver_id,
        vehicle_id,
        origin_address,
        origin_lat,
        origin_lng,
        destination_address,
        destination_lat,
        destination_lng,
        status,
        estimated_price,
        final_price,
        requested_at,
        accepted_at,
        started_at,
        completed_at
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      setMessage(
        `No fue posible cargar el viaje: ${
          error?.message ?? "Viaje no encontrado"
        }`
      );
      setLoading(false);
      return;
    }

    const loadedTrip = data as Trip;
    setTrip(loadedTrip);

    const userIds = [
      loadedTrip.passenger_id,
      loadedTrip.driver_id,
    ].filter(Boolean) as string[];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, rating")
        .in("id", userIds);

      const passenger = profiles?.find(
        (profile) => profile.id === loadedTrip.passenger_id
      );

      const driver = profiles?.find(
        (profile) => profile.id === loadedTrip.driver_id
      );

      setPassengerName(
        passenger?.full_name || "Pasajero sin nombre"
      );

      const resolvedDriverName =
        loadedTrip.driver_id
          ? driver?.full_name || "Conductor sin nombre"
          : "Sin asignar";

      setDriverName(resolvedDriverName);

      if (loadedTrip.driver_id) {
        let vehicleData: {
          brand: string | null;
          model: string | null;
          color: string | null;
          plates: string | null;
          verified: boolean | null;
        } | null = null;

        if (loadedTrip.vehicle_id) {
          const { data: vehicle } = await supabase
            .from("vehicles")
            .select("brand, model, color, plates, verified")
            .eq("id", loadedTrip.vehicle_id)
            .maybeSingle();

          vehicleData = vehicle;
        }

        setDriverIdentity({
          name: resolvedDriverName,
          avatarUrl: driver?.avatar_url ?? null,
          rating:
            driver?.rating !== null &&
            driver?.rating !== undefined
              ? Number(driver.rating)
              : null,
          vehicleBrand: vehicleData?.brand ?? null,
          vehicleModel: vehicleData?.model ?? null,
          vehicleColor: vehicleData?.color ?? null,
          vehiclePlates: vehicleData?.plates ?? null,
          verified: Boolean(vehicleData?.verified),
        });
      } else {
        setDriverIdentity(null);
      }
    }

    setLoading(false);
  }, [id]);

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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        setMessage("No fue posible cargar tu perfil.");
        setLoading(false);
        return;
      }

      setRole(profile.role as UserRole);

      await loadTrip();

      const channelName = `trip-${id}-${crypto.randomUUID()}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trips",
            filter: `id=eq.${id}`,
          },
          () => {
            void loadTrip();
          }
        )
        .subscribe();
    }

    void start();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [id, loadTrip, router]);

  useEffect(() => {
    const searching =
      trip?.status === "requested" ||
      trip?.status === "searching";

    if (!searching) {
      return;
    }

    const timer = window.setInterval(() => {
      setSearchSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [trip?.status]);

  async function cancelCurrentTrip() {
    if (!trip) return;

    const confirmed = window.confirm(
      "¿Seguro que quieres cancelar la solicitud? Los conductores dejarán de verla."
    );

    if (!confirmed) return;

    setCancelling(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setCancelling(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("trips")
      .update({
        status: "cancelled",
      })
      .eq("id", trip.id)
      .eq("passenger_id", session.user.id)
      .in("status", ["requested", "searching"]);

    if (error) {
      setMessage(`No fue posible cancelar el viaje: ${error.message}`);
      setCancelling(false);
      return;
    }

    setMessage("La solicitud fue cancelada correctamente.");
    setCancelling(false);
    await loadTrip();
  }

  function openExternalNavigation(
    provider: "google" | "apple",
    target: {
      latitude: number | null;
      longitude: number | null;
      address: string;
    }
  ) {
    const destination =
      target.latitude !== null &&
      target.longitude !== null
        ? `${target.latitude},${target.longitude}`
        : target.address;

    const encodedDestination =
      encodeURIComponent(destination);

    const url =
      provider === "google"
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`
        : `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function advanceStatus(nextStatus: TripStatus) {
    if (!trip) return;

    const confirmed = window.confirm(
      `¿Confirmas la acción "${statusLabels[nextStatus]}"?`
    );

    if (!confirmed) return;

    setProcessing(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "advance_trip_status",
      {
        trip_id: trip.id,
        next_status: nextStatus,
      }
    );

    if (error) {
      setMessage(`Error actualizando viaje: ${error.message}`);
    } else {
      setMessage("Estado del viaje actualizado correctamente.");
      await loadTrip();
    }

    setProcessing(false);
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="h-40 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  if (!trip) {
    return (
      <section className="flex min-h-[65vh] items-center justify-center">
        <Card className="max-w-lg text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-red-100 text-red-700">
            <Route size={34} />
          </span>

          <h1 className="mt-6 text-3xl font-black">
            Viaje no disponible
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            {message || "No fue posible cargar el viaje."}
          </p>

          <Link
            href="/dashboard/trips"
            className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <ArrowLeft size={18} />
            Volver a mis viajes
          </Link>
        </Card>
      </section>
    );
  }

  const driverAction = nextDriverAction[trip.status];

  const progressStatuses = progressSteps.map(
    (step) => step.status
  );

  const currentProgressIndex = progressStatuses.indexOf(
    trip.status
  );

  const isCancelled = trip.status === "cancelled";
  const isCompleted = trip.status === "completed";
  const isSearching =
    trip.status === "requested" ||
    trip.status === "searching";

  const searchMinutes = Math.floor(searchSeconds / 60);
  const searchRemainingSeconds = searchSeconds % 60;

  const searchTimeLabel =
    `${searchMinutes.toString().padStart(2, "0")}:` +
    `${searchRemainingSeconds.toString().padStart(2, "0")}`;

  const navigationToOrigin =
    trip.status === "accepted" ||
    trip.status === "driver_arriving" ||
    trip.status === "driver_arrived";

  const navigationToDestination =
    trip.status === "in_progress";

  const navigationTarget = navigationToOrigin
    ? {
        latitude: trip.origin_lat,
        longitude: trip.origin_lng,
        address: trip.origin_address,
        label: "Ir por el pasajero",
        description:
          "Abre la navegación hacia el punto de recogida.",
      }
    : navigationToDestination
      ? {
          latitude: trip.destination_lat,
          longitude: trip.destination_lng,
          address: trip.destination_address,
          label: "Ir al destino",
          description:
            "Abre la navegación hacia el destino final.",
        }
      : null;

  const displayPrice =
    trip.final_price ?? trip.estimated_price;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/trips"
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />
          Volver a mis viajes
        </Link>

        <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <CalendarDays size={16} />
          {formatDate(trip.requested_at)}
        </span>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:px-9 sm:py-10",
          isCancelled
            ? "bg-[linear-gradient(120deg,#450a0a,#7f1d1d)]"
            : isCompleted
              ? "bg-[linear-gradient(120deg,#052e16,#166534)]"
              : "bg-[#0B0F19]"
        )}
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge
              variant={getStatusVariant(trip.status)}
              className="border border-white/10"
            >
              {statusLabels[trip.status]}
            </Badge>

            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              {isCancelled
                ? "Este viaje fue cancelado"
                : isCompleted
                  ? "Llegaste a tu destino"
                  : "Tu viaje con AXI"}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {statusDescriptions[trip.status]}
            </p>
          </div>

          <div className="min-w-64 rounded-3xl border border-white/10 bg-white/10 px-6 py-5 backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
              Precio del viaje
            </p>

            <p className="mt-2 text-4xl font-black">
              {formatCurrency(displayPrice)}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800">
          {message}
        </div>
      )}

      {isSearching && (
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.1)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden bg-[#0B0F19] p-8">
              <div className="absolute h-72 w-72 animate-ping rounded-full border border-yellow-400/20" />
              <div className="absolute h-56 w-56 animate-pulse rounded-full border border-yellow-400/30" />
              <div className="absolute h-40 w-40 rounded-full border border-yellow-400/40" />

              <div className="absolute left-[18%] top-[22%] flex h-11 w-11 animate-bounce items-center justify-center rounded-2xl bg-white text-slate-950 shadow-xl">
                <CarFront size={20} />
              </div>

              <div className="absolute bottom-[20%] right-[16%] flex h-11 w-11 animate-pulse items-center justify-center rounded-2xl bg-white text-slate-950 shadow-xl">
                <CarFront size={20} />
              </div>

              <div className="absolute right-[22%] top-[18%] flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-slate-950 shadow-xl">
                <CarFront size={18} />
              </div>

              <div className="relative z-10 text-center">
                <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-yellow-400 text-black shadow-[0_0_60px_rgba(250,204,21,0.45)]">
                  <Radio size={38} className="animate-pulse" />
                </span>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                  Red AXI activa
                </p>

                <h2 className="mt-2 text-3xl font-black text-white">
                  Buscando taxista
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Revisando conductores disponibles cerca de ti.
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                    Solicitud enviada
                  </p>

                  <h2 className="mt-2 text-3xl font-black text-slate-950">
                    Encontraremos tu taxi
                  </h2>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-white">
                  <TimerReset size={21} className="text-yellow-400" />

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Tiempo buscando
                    </p>

                    <p className="mt-1 text-xl font-black">
                      {searchTimeLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <SearchStep
                  completed
                  title="Solicitud recibida"
                  description="AXI registró correctamente tu viaje."
                />

                <SearchStep
                  completed={searchSeconds >= 3}
                  title="Buscando conductores cercanos"
                  description="Estamos consultando taxistas disponibles."
                />

                <SearchStep
                  completed={searchSeconds >= 30}
                  active={searchSeconds >= 30}
                  title="Ampliando zona de búsqueda"
                  description="Buscaremos conductores en un radio mayor."
                />
              </div>

              <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <RefreshCw
                    size={18}
                    className="mt-0.5 shrink-0 animate-spin text-blue-600"
                  />

                  <p className="text-xs leading-6 text-blue-800">
                    No cierres esta pantalla. La información se actualizará
                    automáticamente cuando un conductor acepte.
                  </p>
                </div>
              </div>

              {role === "passenger" && (
                <button
                  type="button"
                  onClick={cancelCurrentTrip}
                  disabled={cancelling}
                  className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle size={19} />

                  {cancelling
                    ? "Cancelando solicitud..."
                    : "Cancelar solicitud"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {!isCancelled && !isSearching && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Seguimiento en vivo
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Progreso del viaje
              </h2>
            </div>

            <Clock3 size={25} className="text-yellow-600" />
          </div>

          <div className="mt-8 grid grid-cols-5 gap-2">
            {progressSteps.map((step, index) => {
              const completed =
                currentProgressIndex >= index ||
                isCompleted;

              const active =
                currentProgressIndex === index &&
                !isCompleted;

              return (
                <div
                  key={step.status}
                  className="min-w-0 text-center"
                >
                  <div
                    className={cn(
                      "mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black transition",
                      completed
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-slate-200 bg-white text-slate-400",
                      active && "ring-4 ring-yellow-400/20"
                    )}
                  >
                    {completed ? (
                      <Check size={18} />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <p
                    className={cn(
                      "mt-3 hidden truncate text-[10px] font-black uppercase tracking-wide sm:block",
                      completed
                        ? "text-slate-950"
                        : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!isSearching && (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <GoogleMapView />

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">
                Recorrido
              </h2>

              <Route className="text-yellow-600" size={25} />
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
                    Punto de partida
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {trip.origin_address}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Destino
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {trip.destination_address}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <CircleDollarSign
                  size={20}
                  className="text-emerald-600"
                />

                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Estimado
                </p>

                <p className="mt-1 font-black">
                  {formatCurrency(trip.estimated_price)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <Clock3 size={20} className="text-blue-600" />

                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Estado
                </p>

                <p className="mt-1 font-black">
                  {statusLabels[trip.status]}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">
                Participantes
              </h2>

              <UserRound size={24} className="text-slate-400" />
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <UserRound size={20} />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Pasajero
                  </p>

                  <p className="mt-1 font-black">
                    {passengerName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                  <CarFront size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Conductor
                  </p>

                  <p className="mt-1 truncate font-black">
                    {driverName}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {driverIdentity &&
            !isCompleted &&
            !isCancelled && (
              <DriverIdentityCard driver={driverIdentity} />
            )}

          {trip.driver_id &&
            !isCompleted &&
            !isCancelled && (
              <TripPinCard
                pin={null}
                visibleToPassenger={role === "passenger"}
              />
            )}

          {trip.driver_id &&
            !isCompleted &&
            !isCancelled && (
              <Card className="overflow-hidden border-slate-200">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
                    <MessageCircle size={25} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                      Comunicación del viaje
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      Coordina de forma segura
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Envía mensajes o fotografías sin compartir tu número
                      personal.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    href={`/dashboard/trips/${trip.id}/chat`}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300"
                  >
                    <MessageCircle size={19} />
                    Abrir chat
                  </Link>

                  <Link
                    href={`/dashboard/trips/${trip.id}/report`}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <ShieldCheck size={19} />
                    Reportar incidente
                  </Link>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs leading-6 text-slate-500">
                    El chat permanece disponible durante el viaje y registra
                    los mensajes para seguridad de ambas partes.
                  </p>
                </div>
              </Card>
            )}

          {!isCompleted && !isCancelled && role === "passenger" && (
            <ShareTripCard tripId={trip.id} />
          )}

          {!isCompleted && !isCancelled && (
            <Card className="border-red-100 bg-[linear-gradient(135deg,#fff7f7,#ffffff)]">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                  <ShieldCheck size={25} />
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
                    Seguridad durante el viaje
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Ayuda inmediata
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Mantén presionado el botón SOS únicamente si existe una
                    situación de riesgo o emergencia.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <SOSButton tripId={trip.id} />
              </div>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                La alerta se conectará después con ubicación, contactos de
                confianza y registro de incidentes.
              </p>
            </Card>
          )}

          {role === "driver" &&
            navigationTarget &&
            !isCompleted &&
            !isCancelled && (
              <Card className="overflow-hidden border-blue-100 bg-[linear-gradient(135deg,#eff6ff,#ffffff)]">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                    <Navigation size={26} />
                  </span>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                      Navegación del conductor
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      {navigationTarget.label}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {navigationTarget.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <MapPin
                      size={19}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Dirección
                      </p>

                      <p className="mt-1 text-sm font-black leading-6 text-slate-800">
                        {navigationTarget.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      openExternalNavigation(
                        "google",
                        navigationTarget
                      )
                    }
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800"
                  >
                    <Navigation size={19} />
                    Abrir Google Maps
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openExternalNavigation(
                        "apple",
                        navigationTarget
                      )
                    }
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <Route size={19} />
                    Abrir Apple Maps
                  </button>
                </div>

                <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                  La aplicación de mapas utilizará tu ubicación actual
                  para iniciar la ruta.
                </p>
              </Card>
            )}

          {role === "driver" &&
            driverAction &&
            !isCompleted &&
            !isCancelled && (
              <Card className="bg-[#0B0F19] text-white">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                    <CarFront size={25} />
                  </span>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
                      Acción del conductor
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Actualiza el viaje
                    </h2>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-400">
                  Confirma el siguiente paso para mantener informado al
                  pasajero en tiempo real.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    advanceStatus(driverAction.status)
                  }
                  disabled={processing}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-50"
                >
                  {processing
                    ? "Actualizando..."
                    : driverAction.label}

                  {!processing && <ArrowRight size={19} />}
                </button>
              </Card>
            )}

          {!trip.driver_id &&
            !isCompleted &&
            !isCancelled && (
              <Card className="bg-[#0B0F19] text-white">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                    <CarFront size={25} />
                  </span>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
                      Conductor AXI
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Buscando conductor
                    </h2>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-400">
                  La información del conductor aparecerá cuando alguien acepte
                  tu viaje.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-slate-500"
                  >
                    <Phone size={17} />
                    Llamar
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-slate-500"
                  >
                    <ShieldCheck size={17} />
                    Seguridad
                  </button>
                </div>
              </Card>
            )}

          {isCompleted && (
            <Card className="bg-yellow-400 text-black">
              <Star size={28} />

              <h2 className="mt-5 text-2xl font-black">
                Viaje completado
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-black/65">
                El recorrido terminó correctamente.
              </p>

              <div className="mt-6 flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/10 transition hover:bg-black hover:text-yellow-400"
                  >
                    <Star size={20} />
                  </button>
                ))}
              </div>
            </Card>
          )}

          {isCancelled && (
            <Card className="border-red-200 bg-red-50">
              <Route size={27} className="text-red-600" />

              <h2 className="mt-5 text-2xl font-black text-red-800">
                Viaje cancelado
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Este viaje ya no se encuentra activo.
              </p>
            </Card>
          )}
        </div>
      </div>
      )}
    </section>
  );
}

function SearchStep({
  completed,
  active = false,
  title,
  description,
}: {
  completed: boolean;
  active?: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          completed
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-200 text-slate-400",
          active && "animate-pulse bg-yellow-100 text-yellow-700"
        )}
      >
        {completed ? (
          <Check size={17} />
        ) : (
          <Radio size={17} />
        )}
      </span>

      <div>
        <p className="text-sm font-black text-slate-800">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
