"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

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
  origin_address: string;
  destination_address: string;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
};

const statusData: Record<
  TripStatus,
  {
    title: string;
    description: string;
    step: number;
  }
> = {
  requested: {
    title: "Viaje solicitado",
    description: "Tu solicitud fue enviada correctamente.",
    step: 1,
  },
  searching: {
    title: "Buscando conductor",
    description: "Estamos localizando un conductor cercano.",
    step: 2,
  },
  accepted: {
    title: "Conductor asignado",
    description: "Un conductor aceptó tu solicitud.",
    step: 3,
  },
  driver_arriving: {
    title: "Conductor en camino",
    description: "Tu conductor se dirige al punto de origen.",
    step: 4,
  },
  driver_arrived: {
    title: "El conductor llegó",
    description: "Tu unidad ya se encuentra en el punto de origen.",
    step: 5,
  },
  in_progress: {
    title: "Viaje en curso",
    description: "Te estás dirigiendo hacia tu destino.",
    step: 6,
  },
  completed: {
    title: "Viaje completado",
    description: "Llegaste correctamente a tu destino.",
    step: 7,
  },
  cancelled: {
    title: "Viaje cancelado",
    description: "Esta solicitud fue cancelada.",
    step: 0,
  },
};

const progressSteps = [
  "Solicitud",
  "Buscando",
  "Asignado",
  "En camino",
  "Llegó",
  "En viaje",
  "Completado",
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

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTrip() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("Debes iniciar sesión para consultar este viaje.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, origin_address, destination_address, status, estimated_price, final_price, requested_at"
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error cargando viaje:", error.message);
        setErrorMessage("No encontramos este viaje.");
      } else {
        setTrip(data as Trip);
      }

      setLoading(false);
    }

    void loadTrip();
  }, [id]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  if (!trip || errorMessage) {
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
            {errorMessage || "No fue posible cargar la información."}
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

  const currentStatus = statusData[trip.status];
  const displayPrice = trip.final_price ?? trip.estimated_price;
  const isCancelled = trip.status === "cancelled";
  const isCompleted = trip.status === "completed";

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/trips"
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />
          Volver a viajes
        </Link>

        <p className="text-sm font-semibold text-slate-500">
          Solicitado el {formatDate(trip.requested_at)}
        </p>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:px-9 sm:py-10",
          isCancelled ? "bg-red-950" : "bg-[#0B0F19]"
        )}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge
              className={cn(
                "border border-white/10",
                isCancelled
                  ? "bg-red-500/20 text-red-200"
                  : isCompleted
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-yellow-400 text-black"
              )}
            >
              {currentStatus.title}
            </Badge>

            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              {isCancelled
                ? "Este viaje fue cancelado"
                : isCompleted
                  ? "Llegaste a tu destino"
                  : "Tu viaje con AXI"}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {currentStatus.description}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Precio del viaje
            </p>

            <p className="mt-2 text-4xl font-black">
              {formatCurrency(displayPrice)}
            </p>
          </div>
        </div>
      </div>

      {!isCancelled && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Seguimiento
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Progreso del viaje
              </h2>
            </div>

            <Clock3 size={25} className="text-yellow-600" />
          </div>

          <div className="mt-8 grid grid-cols-7 gap-2">
            {progressSteps.map((step, index) => {
              const stepNumber = index + 1;
              const completed = stepNumber <= currentStatus.step;
              const active = stepNumber === currentStatus.step;

              return (
                <div key={step} className="min-w-0 text-center">
                  <div
                    className={cn(
                      "mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition",
                      completed
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-slate-200 bg-white text-slate-400",
                      active && "ring-4 ring-yellow-400/20"
                    )}
                  >
                    {completed ? <Check size={18} /> : stepNumber}
                  </div>

                  <p
                    className={cn(
                      "mt-3 hidden truncate text-[10px] font-bold uppercase tracking-wide sm:block",
                      completed ? "text-slate-950" : "text-slate-400"
                    )}
                  >
                    {step}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <GoogleMapView />

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">
                Detalles del recorrido
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
                    Origen
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
                  {currentStatus.title}
                </p>
              </div>
            </div>
          </Card>

          {!isCancelled && !isCompleted && (
            <Card className="bg-[#0B0F19] text-white">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                  <CarFront size={25} />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">
                    Conductor AXI
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Buscando información
                  </h2>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-400">
                Los datos del conductor aparecerán cuando la solicitud sea
                aceptada.
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
                ¿Cómo estuvo tu viaje?
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-black/65">
                La calificación estará disponible cuando Gali conecte el módulo
                de reseñas.
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
        </div>
      </div>
    </section>
  );
}
