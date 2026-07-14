"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Navigation,
} from "lucide-react";
import {
  PlaceAutocomplete,
  type SelectedPlace,
} from "@/components/maps/PlaceAutocomplete";
import { supabase } from "@/lib/supabaseClient";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function NewTripPage() {
  const router = useRouter();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [originCoordinates, setOriginCoordinates] =
    useState<Coordinates | null>(null);

  const [destinationPlace, setDestinationPlace] =
    useState<SelectedPlace | null>(null);

  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleOriginTextChange(value: string) {
    setOrigin(value);
    setOriginCoordinates(null);
    setMessage("");
  }

  function handleOriginSelect(place: SelectedPlace) {
    setOrigin(place.address);
    setOriginCoordinates({
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setMessage("");
  }

  function handleDestinationTextChange(value: string) {
    setDestination(value);
    setDestinationPlace(null);
    setMessage("");
  }

  function handleDestinationSelect(place: SelectedPlace) {
    setDestination(place.address);
    setDestinationPlace(place);
    setMessage("");
  }

  function getCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage(
        "Tu navegador no permite obtener la ubicación."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOriginCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setOrigin("Mi ubicación actual");
        setLocating(false);
        setMessage(
          "Ubicación actual obtenida correctamente."
        );
      },
      (error) => {
        setLocating(false);

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          setMessage(
            "Debes permitir el acceso a tu ubicación para solicitar un viaje."
          );
          return;
        }

        setMessage(
          "No pudimos obtener tu ubicación. Intenta nuevamente."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!origin.trim()) {
      setMessage(
        "Selecciona tu punto de partida."
      );
      return;
    }

    if (!originCoordinates) {
      setMessage(
        "Selecciona una dirección real como origen o usa tu ubicación actual."
      );
      return;
    }

    if (!destination.trim()) {
      setMessage("Escribe el destino.");
      return;
    }

    if (!destinationPlace) {
      setMessage(
        "Selecciona una de las ubicaciones sugeridas para confirmar el destino."
      );
      return;
    }

    setLoading(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const { data: trip, error: tripError } =
      await supabase
        .from("trips")
        .insert({
          passenger_id: session.user.id,
          origin_address: origin.trim(),
          origin_lat:
            originCoordinates.latitude,
          origin_lng:
            originCoordinates.longitude,
          destination_address:
            destinationPlace.address,
          destination_lat:
            destinationPlace.latitude,
          destination_lng:
            destinationPlace.longitude,
          status: "requested",
        })
        .select("id")
        .single();

    if (tripError || !trip) {
      setLoading(false);
      setMessage(
        `Error creando el viaje: ${
          tripError?.message ??
          "No se obtuvo el viaje"
        }`
      );
      return;
    }

    const {
      data: notifiedDrivers,
      error: dispatchError,
    } = await supabase.rpc("dispatch_trip", {
      requested_trip_id: trip.id,
      search_radius_km: 10,
      drivers_limit: 10,
    });

    setLoading(false);

    if (dispatchError) {
      setMessage(
        `El viaje se creó, pero ocurrió un error buscando conductores: ${dispatchError.message}`
      );

      window.setTimeout(() => {
        router.push(
          `/dashboard/trips/${trip.id}`
        );
        router.refresh();
      }, 2500);

      return;
    }

    const count = Number(
      notifiedDrivers ?? 0
    );

    if (count === 0) {
      setMessage(
        "Viaje creado. Por ahora no encontramos conductores cercanos; seguiremos buscando."
      );
    } else {
      setMessage(
        `Viaje creado. Se notificó a ${count} conductor${
          count === 1 ? "" : "es"
        } cercano${count === 1 ? "" : "s"}.`
      );
    }

    window.setTimeout(() => {
      router.push(
        `/dashboard/trips/${trip.id}`
      );
      router.refresh();
    }, 2000);
  }

  const originReady =
    originCoordinates !== null;

  const destinationReady =
    destinationPlace !== null;

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard/trips")
          }
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />
          Volver a viajes
        </button>

        <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
          Nueva solicitud
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          ¿A dónde vamos?
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
          Busca una ubicación real y selecciona
          una de las opciones para establecer el
          punto exacto del viaje.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="overflow-visible rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8"
      >
        <div className="rounded-[1.7rem] bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <Navigation size={22} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
                Ruta AXI
              </p>

              <p className="mt-1 font-black">
                Selecciona origen y destino
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LocationStatus
              label="Origen"
              ready={originReady}
            />

            <LocationStatus
              label="Destino"
              ready={destinationReady}
            />
          </div>
        </div>

        <div className="mt-7 space-y-7">
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm font-black text-slate-700">
                Punto de partida
              </p>

              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={locating}
                className="inline-flex items-center gap-2 rounded-xl bg-yellow-100 px-3 py-2 text-xs font-black text-yellow-800 transition hover:bg-yellow-200 disabled:opacity-50"
              >
                <LocateFixed
                  size={15}
                  className={
                    locating
                      ? "animate-pulse"
                      : ""
                  }
                />

                {locating
                  ? "Ubicando..."
                  : "Usar mi ubicación"}
              </button>
            </div>

            <PlaceAutocomplete
              label="Busca el lugar donde te recogerán"
              placeholder="Ejemplo: UDLAP, Cholula"
              value={origin}
              onTextChange={
                handleOriginTextChange
              }
              onPlaceSelect={
                handleOriginSelect
              }
            />

            {originCoordinates && (
              <div className="mt-3 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />

                <div>
                  <p className="text-xs font-black text-emerald-800">
                    Punto de partida confirmado
                  </p>

                  <p className="mt-1 text-xs text-emerald-700">
                    {origin}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="relative pl-6">
            <span className="absolute bottom-2 left-0 top-2 border-l-2 border-dashed border-slate-300" />

            <PlaceAutocomplete
              label="¿A dónde quieres ir?"
              placeholder="Ejemplo: Angelópolis, Puebla"
              value={destination}
              onTextChange={
                handleDestinationTextChange
              }
              onPlaceSelect={
                handleDestinationSelect
              }
            />

            {destinationPlace && (
              <div className="mt-3 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <MapPin
                  size={18}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <p className="text-xs font-black text-blue-800">
                    Destino confirmado
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    {destinationPlace.address}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
              message
                .toLowerCase()
                .includes("correctamente") ||
              message
                .toLowerCase()
                .includes("viaje creado")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/trips"
              )
            }
            className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-slate-200 px-5 font-black text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              loading ||
              locating ||
              !originReady ||
              !destinationReady
            }
            className="flex h-14 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
          >
            {loading
              ? "Buscando conductores..."
              : "Confirmar viaje"}

            {!loading && (
              <ArrowRight size={19} />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function LocationStatus({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span
        className={`h-3 w-3 rounded-full ${
          ready
            ? "bg-emerald-400"
            : "bg-slate-600"
        }`}
      />

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          {label}
        </p>

        <p className="mt-0.5 text-xs font-bold text-slate-200">
          {ready
            ? "Ubicación confirmada"
            : "Pendiente"}
        </p>
      </div>
    </div>
  );
}
