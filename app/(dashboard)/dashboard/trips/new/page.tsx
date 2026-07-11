"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type RideType = "axi" | "comfort" | "xl";

const rideOptions = [
  {
    id: "axi" as const,
    name: "AXI",
    description: "La opción más rápida y económica",
    seats: "4 pasajeros",
    eta: "3 min",
    estimatedPrice: 85,
    icon: CarFront,
  },
  {
    id: "comfort" as const,
    name: "AXI Comfort",
    description: "Más espacio y comodidad",
    seats: "4 pasajeros",
    eta: "6 min",
    estimatedPrice: 115,
    icon: ShieldCheck,
  },
  {
    id: "xl" as const,
    name: "AXI XL",
    description: "Ideal para grupos o equipaje",
    seats: "6 pasajeros",
    eta: "8 min",
    estimatedPrice: 155,
    icon: UsersRound,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export default function NewTripPage() {
  const router = useRouter();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [rideType, setRideType] = useState<RideType>("axi");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedRide = useMemo(
    () => rideOptions.find((option) => option.id === rideType) ?? rideOptions[0],
    [rideType]
  );

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setErrorMessage("Este dispositivo no permite obtener tu ubicación.");
      return;
    }

    setLocating(true);
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      () => {
        setOrigin("Mi ubicación actual");
        setLocating(false);
      },
      () => {
        setErrorMessage("No se pudo obtener tu ubicación.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function handleCreateTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!origin.trim() || !destination.trim()) {
      setErrorMessage("Escribe el origen y el destino del viaje.");
      return;
    }

    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("trips").insert({
      passenger_id: session.user.id,
      origin_address: origin.trim(),
      destination_address: destination.trim(),
      status: "requested",
      estimated_price: selectedRide.estimatedPrice,
      requested_at: new Date().toISOString(),
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push("/dashboard/trips");
    router.refresh();
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/trips"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />
          Volver a viajes
        </Link>

        <span className="hidden rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-700 sm:inline-flex">
          Sistema disponible
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:px-9">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-400/20 blur-3xl" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
                <Navigation size={15} />
                Nuevo viaje
              </span>

              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                ¿A dónde vamos?
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Selecciona tu origen, destino y tipo de vehículo para solicitar
                un AXI.
              </p>
            </div>
          </div>

          <GoogleMapView />
        </div>

        <form
          onSubmit={handleCreateTrip}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <MapPin size={22} />
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              Paso 1 de 1
            </span>
          </div>

          <h2 className="mt-7 text-3xl font-black text-slate-950">
            Datos del recorrido
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Confirma los puntos del viaje y el tipo de unidad.
          </p>

          <div className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="origin"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Origen
              </label>

              <div className="relative">
                <MapPin
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500"
                />

                <input
                  id="origin"
                  type="text"
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="Escribe el punto de salida"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-14 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                />

                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  aria-label="Usar ubicación actual"
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-950 text-yellow-400 transition hover:scale-105 disabled:opacity-50"
                >
                  <LocateFixed
                    size={17}
                    className={locating ? "animate-pulse" : ""}
                  />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="destination"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Destino
              </label>

              <div className="relative">
                <Navigation
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500"
                />

                <input
                  id="destination"
                  type="text"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Escribe tu destino"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm font-black text-slate-950">
              Elige tu tipo de viaje
            </p>

            <div className="mt-3 space-y-3">
              {rideOptions.map((option) => {
                const Icon = option.icon;
                const selected = rideType === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRideType(option.id)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-yellow-400 bg-yellow-50 ring-2 ring-yellow-400/20"
                        : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        selected
                          ? "bg-yellow-400 text-black"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      <Icon size={22} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-slate-950">
                        {option.name}
                      </span>

                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {option.description}
                      </span>

                      <span className="mt-2 flex items-center gap-3 text-[11px] font-bold text-slate-400">
                        <span>{option.seats}</span>
                        <span>•</span>
                        <span>{option.eta}</span>
                      </span>
                    </span>

                    <span className="font-black text-slate-950">
                      {formatCurrency(option.estimatedPrice)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <CircleDollarSign size={18} />
                Precio estimado
              </span>

              <span className="text-2xl font-black text-slate-950">
                {formatCurrency(selectedRide.estimatedPrice)}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Clock3 size={18} />
                Tiempo aproximado
              </span>

              <span className="font-black text-slate-950">
                {selectedRide.eta}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
          >
            {loading ? "Solicitando viaje..." : "Solicitar AXI"}

            {!loading && <ArrowRight size={19} />}
          </button>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <p className="text-xs leading-6 text-emerald-800">
              Tu solicitud se enviará a los conductores disponibles cercanos.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
