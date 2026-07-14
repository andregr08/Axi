"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  PlaceAutocomplete,
  type SelectedPlace,
} from "@/components/maps/PlaceAutocomplete";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type PaymentMethod = "cash" | "card";

type ResolvedTripData = {
  originCoordinates: Coordinates;
  destinationPlace: SelectedPlace;
};

const BASE_FARE = 35;
const PRICE_PER_KM = 12;
const BOOKING_FEE = 8;

function calculateDistanceKm(
  origin: Coordinates,
  destination: Coordinates
) {
  const earthRadiusKm = 6371;

  const latitudeDifference =
    ((destination.latitude - origin.latitude) * Math.PI) / 180;

  const longitudeDifference =
    ((destination.longitude - origin.longitude) * Math.PI) / 180;

  const originLatitude =
    (origin.latitude * Math.PI) / 180;

  const destinationLatitude =
    (destination.latitude * Math.PI) / 180;

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));

  return Math.max(1, earthRadiusKm * centralAngle);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NewTripPage() {
  const router = useRouter();

  const placesConfigured = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [originCoordinates, setOriginCoordinates] =
    useState<Coordinates | null>(null);

  const [destinationPlace, setDestinationPlace] =
    useState<SelectedPlace | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resolvedTrip, setResolvedTrip] =
    useState<ResolvedTripData | null>(null);
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
        setMessage("Ubicación actual obtenida correctamente.");
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
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

  function resolveTripData(): ResolvedTripData | null {
    if (!origin.trim()) {
      setMessage("Selecciona tu punto de partida.");
      return null;
    }

    let resolvedOriginCoordinates = originCoordinates;

    if (!resolvedOriginCoordinates) {
      if (placesConfigured) {
        setMessage(
          "Selecciona una dirección real como origen o usa tu ubicación actual."
        );
        return null;
      }

      resolvedOriginCoordinates = {
        latitude: 19.0414,
        longitude: -98.2063,
      };
    }

    if (!destination.trim()) {
      setMessage("Escribe el destino.");
      return null;
    }

    let resolvedDestinationPlace = destinationPlace;

    if (!resolvedDestinationPlace) {
      if (placesConfigured) {
        setMessage(
          "Selecciona una de las ubicaciones sugeridas para confirmar el destino."
        );
        return null;
      }

      resolvedDestinationPlace = {
        placeId: "demo-manual-destination",
        name: destination.trim(),
        address: destination.trim(),
        latitude: 19.0544,
        longitude: -98.2221,
      };
    }

    return {
      originCoordinates: resolvedOriginCoordinates,
      destinationPlace: resolvedDestinationPlace,
    };
  }

  function handleReviewTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const resolved = resolveTripData();

    if (!resolved) return;

    setResolvedTrip(resolved);
    setConfirmOpen(true);
  }

  async function createTrip() {
    if (!resolvedTrip) return;

    setLoading(true);
    setMessage("");

    const distanceKm = calculateDistanceKm(
      resolvedTrip.originCoordinates,
      {
        latitude: resolvedTrip.destinationPlace.latitude,
        longitude: resolvedTrip.destinationPlace.longitude,
      }
    );

    const durationMinutes = Math.max(
      5,
      Math.round((distanceKm / 28) * 60)
    );

    const estimatedPrice = Math.max(
      55,
      Math.round(
        BASE_FARE +
          distanceKm * PRICE_PER_KM +
          BOOKING_FEE
      )
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setLoading(false);
      setConfirmOpen(false);
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
            resolvedTrip.originCoordinates.latitude,
          origin_lng:
            resolvedTrip.originCoordinates.longitude,
          destination_address:
            resolvedTrip.destinationPlace.address,
          destination_lat:
            resolvedTrip.destinationPlace.latitude,
          destination_lng:
            resolvedTrip.destinationPlace.longitude,
          distance_km: Number(distanceKm.toFixed(2)),
          duration_minutes: durationMinutes,
          estimated_price: estimatedPrice,
          booking_fee: BOOKING_FEE,
          payment_method: paymentMethod,
          status: "requested",
        })
        .select("id")
        .single();

    if (tripError || !trip) {
      setLoading(false);
      setConfirmOpen(false);

      setMessage(
        `Error creando el viaje: ${
          tripError?.message ?? "No se obtuvo el viaje"
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
    setConfirmOpen(false);

    if (dispatchError) {
      setMessage(
        `El viaje se creó, pero ocurrió un error buscando conductores: ${dispatchError.message}`
      );

      window.setTimeout(() => {
        router.push(`/dashboard/trips/${trip.id}`);
        router.refresh();
      }, 2000);

      return;
    }

    const count = Number(notifiedDrivers ?? 0);

    setMessage(
      count === 0
        ? "Viaje creado. Seguiremos buscando conductores cercanos."
        : `Viaje creado. Se notificó a ${count} conductor${
            count === 1 ? "" : "es"
          } cercano${count === 1 ? "" : "s"}.`
    );

    window.setTimeout(() => {
      router.push(`/dashboard/trips/${trip.id}`);
      router.refresh();
    }, 1500);
  }

  const originReady =
    originCoordinates !== null ||
    (!placesConfigured && origin.trim().length > 2);

  const destinationReady =
    destinationPlace !== null ||
    (!placesConfigured && destination.trim().length > 2);

  const estimate = useMemo(() => {
    const previewOrigin =
      originCoordinates ??
      (!placesConfigured && originReady
        ? {
            latitude: 19.0414,
            longitude: -98.2063,
          }
        : null);

    const previewDestination =
      destinationPlace ??
      (!placesConfigured && destinationReady
        ? {
            placeId: "demo-preview",
            name: destination,
            address: destination,
            latitude: 19.0544,
            longitude: -98.2221,
          }
        : null);

    if (!previewOrigin || !previewDestination) {
      return null;
    }

    const distanceKm = calculateDistanceKm(
      previewOrigin,
      {
        latitude: previewDestination.latitude,
        longitude: previewDestination.longitude,
      }
    );

    const durationMinutes = Math.max(
      5,
      Math.round((distanceKm / 28) * 60)
    );

    const estimatedPrice = Math.max(
      55,
      Math.round(
        BASE_FARE +
          distanceKm * PRICE_PER_KM +
          BOOKING_FEE
      )
    );

    return {
      distanceKm,
      durationMinutes,
      estimatedPrice,
    };
  }, [
    destination,
    destinationPlace,
    destinationReady,
    originCoordinates,
    originReady,
    placesConfigured,
  ]);

  return (
    <>
      <section className="mx-auto max-w-5xl space-y-8">
        <div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/trips")}
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

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            Selecciona tu ruta, revisa el precio estimado y elige cómo
            pagarás el viaje.
          </p>
        </div>

        {!placesConfigured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Modo demo activo: las direcciones y estimaciones son
            provisionales hasta configurar Google Places y Routes.
          </div>
        )}

        <form
          onSubmit={handleReviewTrip}
          className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"
        >
          <div className="overflow-visible rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
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
                      className={locating ? "animate-pulse" : ""}
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
                  onTextChange={handleOriginTextChange}
                  onPlaceSelect={handleOriginSelect}
                />

                {originReady && (
                  <ConfirmedLocation
                    title="Punto de partida confirmado"
                    value={origin}
                    variant="origin"
                  />
                )}
              </div>

              <div className="relative pl-6">
                <span className="absolute bottom-2 left-0 top-2 border-l-2 border-dashed border-slate-300" />

                <PlaceAutocomplete
                  label="¿A dónde quieres ir?"
                  placeholder="Ejemplo: Angelópolis, Puebla"
                  value={destination}
                  onTextChange={handleDestinationTextChange}
                  onPlaceSelect={handleDestinationSelect}
                />

                {destinationReady && (
                  <ConfirmedLocation
                    title="Destino confirmado"
                    value={
                      destinationPlace?.address ?? destination
                    }
                    variant="destination"
                  />
                )}
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-black text-slate-700">
                Método de pago
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <PaymentOption
                  active={paymentMethod === "cash"}
                  title="Efectivo"
                  description="Paga directamente al taxista"
                  icon={Banknote}
                  onClick={() => setPaymentMethod("cash")}
                />

                <PaymentOption
                  active={paymentMethod === "card"}
                  title="Tarjeta"
                  description="Cobro digital al terminar"
                  icon={CreditCard}
                  onClick={() => setPaymentMethod("card")}
                />
              </div>

              {paymentMethod === "card" && (
                <div className="mt-3 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <p className="text-xs leading-6 text-blue-800">
                    La tarjeta se elegirá o registrará en la pantalla
                    segura de pagos.
                  </p>
                </div>
              )}
            </div>

            {message && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {message}
              </div>
            )}
          </div>

          <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] xl:sticky xl:top-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
              Resumen del viaje
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Tu viaje AXI
            </h2>

            <div className="mt-6 space-y-4">
              <SummaryLocation
                label="Origen"
                value={origin || "Pendiente"}
                active={originReady}
              />

              <SummaryLocation
                label="Destino"
                value={destination || "Pendiente"}
                active={destinationReady}
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <EstimateCard
                icon={Route}
                label="Distancia"
                value={
                  estimate
                    ? `${estimate.distanceKm.toFixed(1)} km`
                    : "--"
                }
              />

              <EstimateCard
                icon={Clock3}
                label="Tiempo"
                value={
                  estimate
                    ? `${estimate.durationMinutes} min`
                    : "--"
                }
              />
            </div>

            <div className="mt-6 rounded-[1.7rem] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Precio estimado
                  </p>

                  <p className="mt-2 text-4xl font-black text-yellow-400">
                    {estimate
                      ? formatCurrency(estimate.estimatedPrice)
                      : "--"}
                  </p>
                </div>

                <CircleDollarSign
                  size={31}
                  className="text-yellow-400"
                />
              </div>

              <div className="mt-4 flex justify-between text-xs text-slate-400">
                <span>Incluye tarifa de servicio</span>
                <span>{formatCurrency(BOOKING_FEE)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                {paymentMethod === "cash" ? (
                  <Banknote size={20} />
                ) : (
                  <CreditCard size={20} />
                )}

                <div>
                  <p className="text-xs font-bold text-slate-400">
                    Método
                  </p>

                  <p className="font-black">
                    {paymentMethod === "cash"
                      ? "Efectivo"
                      : "Tarjeta"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                locating ||
                !originReady ||
                !destinationReady
              }
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-40"
            >
              Revisar y solicitar
              <ArrowRight size={19} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/trips")}
              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 font-black text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </aside>
        </form>
      </section>

      {confirmOpen && resolvedTrip && estimate && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-trip-title"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="relative bg-slate-950 p-7 text-white">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>

              <Navigation
                size={31}
                className="text-yellow-400"
              />

              <h2
                id="confirm-trip-title"
                className="mt-5 text-3xl font-black"
              >
                Confirma tu viaje
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Revisa la ruta, el método de pago y el precio antes de
                buscar un conductor.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="space-y-4">
                <SummaryLocation
                  label="Origen"
                  value={origin}
                  active
                />

                <SummaryLocation
                  label="Destino"
                  value={resolvedTrip.destinationPlace.address}
                  active
                />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <EstimateCard
                  icon={Route}
                  label="Distancia"
                  value={`${estimate.distanceKm.toFixed(1)} km`}
                />

                <EstimateCard
                  icon={Clock3}
                  label="Tiempo"
                  value={`${estimate.durationMinutes} min`}
                />

                <EstimateCard
                  icon={CircleDollarSign}
                  label="Estimado"
                  value={formatCurrency(
                    estimate.estimatedPrice
                  )}
                />
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  {paymentMethod === "cash" ? (
                    <Banknote size={21} />
                  ) : (
                    <CreditCard size={21} />
                  )}

                  <div>
                    <p className="text-xs font-bold text-slate-400">
                      Método de pago
                    </p>

                    <p className="font-black">
                      {paymentMethod === "cash"
                        ? "Efectivo"
                        : "Tarjeta"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={createTrip}
                disabled={loading}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 font-black text-black transition hover:bg-yellow-300 disabled:opacity-60"
              >
                {loading
                  ? "Buscando conductores..."
                  : "Confirmar y buscar conductor"}

                {!loading && <ArrowRight size={19} />}
              </button>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="mt-3 h-12 w-full rounded-2xl border border-slate-200 font-black text-slate-600"
              >
                Modificar viaje
              </button>

              <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                El precio podrá ajustarse cuando Google Routes calcule
                la ruta exacta.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
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
        className={cn(
          "h-3 w-3 rounded-full",
          ready ? "bg-emerald-400" : "bg-slate-600"
        )}
      />

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          {label}
        </p>

        <p className="mt-0.5 text-xs font-bold text-slate-200">
          {ready ? "Ubicación confirmada" : "Pendiente"}
        </p>
      </div>
    </div>
  );
}

function ConfirmedLocation({
  title,
  value,
  variant,
}: {
  title: string;
  value: string;
  variant: "origin" | "destination";
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-3 rounded-2xl border p-4",
        variant === "origin"
          ? "border-emerald-100 bg-emerald-50"
          : "border-blue-100 bg-blue-50"
      )}
    >
      {variant === "origin" ? (
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-emerald-600"
        />
      ) : (
        <MapPin
          size={18}
          className="mt-0.5 shrink-0 text-blue-600"
        />
      )}

      <div>
        <p
          className={cn(
            "text-xs font-black",
            variant === "origin"
              ? "text-emerald-800"
              : "text-blue-800"
          )}
        >
          {title}
        </p>

        <p
          className={cn(
            "mt-1 text-xs leading-5",
            variant === "origin"
              ? "text-emerald-700"
              : "text-blue-700"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function PaymentOption({
  active,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: typeof Banknote;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 text-left transition",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
          active
            ? "bg-yellow-400 text-black"
            : "bg-slate-100 text-slate-600"
        )}
      >
        <Icon size={22} />
      </span>

      <div>
        <p className="font-black">{title}</p>
        <p
          className={cn(
            "mt-1 text-xs",
            active ? "text-slate-400" : "text-slate-500"
          )}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

function SummaryLocation({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-white shadow",
          active ? "bg-yellow-400" : "bg-slate-300"
        )}
      />

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-1 line-clamp-2 text-sm font-black leading-6 text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function EstimateCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon size={19} className="text-slate-600" />

      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}
