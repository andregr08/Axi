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
  Navigation,
  Phone,
  Route,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
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
  destination_address: string;
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
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
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
        destination_address,
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
        .select("id, full_name")
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

      setDriverName(
        loadedTrip.driver_id
          ? driver?.full_name || "Conductor sin nombre"
          : "Sin asignar"
      );
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

      {!isCancelled && (
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
    </section>
  );
}
