"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import {
  MOBILITY_CONFIG,
  createPricedTrip,
  estimateRouteSync,
  getDynamicFareEstimate,
  getPricingPeriodLabel,
  isMockMobilityMode,
  type DynamicFareEstimate,
  type MobilityCoordinates,
} from "@/lib/mobility";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

type Coordinates = MobilityCoordinates;

type PaymentMethod = "cash" | "card";
type RideType = "economy" | "comfort";

type ResolvedTripData = {
  originCoordinates: Coordinates;
  destinationPlace: SelectedPlace;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function getPassengerFareTotal(
  fare: DynamicFareEstimate | null | undefined
) {
  if (!fare) {
    return null;
  }

  const platformCommission = Number(
    fare.platform_commission ?? 0
  );

  const driverEarnings = Number(
    fare.driver_earnings ?? 0
  );

  const fullFare =
    platformCommission + driverEarnings;

  if (fullFare > 0) {
    return Number(fullFare.toFixed(2));
  }

  return Number(fare.estimated_price ?? 0);
}

export default function NewTripPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const english = locale === "en";

  const mockMobilityMode =
    isMockMobilityMode();

  const placesConfigured =
    !mockMobilityMode &&
    Boolean(
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

  const [rideType, setRideType] =
  useState<RideType>("economy");

  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resolvedTrip, setResolvedTrip] =
    useState<ResolvedTripData | null>(null);
  const [message, setMessage] = useState("");

  const [economyFare, setEconomyFare] =
    useState<DynamicFareEstimate | null>(null);

  const [comfortFare, setComfortFare] =
    useState<DynamicFareEstimate | null>(null);

  const dynamicFare =
    rideType === "economy"
      ? economyFare
      : comfortFare;

  const [
    pricingLoading,
    setPricingLoading,
  ] = useState(false);

  const [
    pricingError,
    setPricingError,
  ] = useState("");

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
        ...MOBILITY_CONFIG.defaultOrigin,
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
        ...MOBILITY_CONFIG.defaultDestination,
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

    const routeEstimate =
      estimateRouteSync(
        resolvedTrip.originCoordinates,
        {
          latitude:
            resolvedTrip.destinationPlace.latitude,
          longitude:
            resolvedTrip.destinationPlace.longitude,
        }
      );

    const {
      distanceKm,
      durationMinutes,
    } = routeEstimate;

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

    let tripId: string;

    try {
      tripId = await createPricedTrip({
        originAddress: origin.trim(),
        originLatitude:
          resolvedTrip.originCoordinates.latitude,
        originLongitude:
          resolvedTrip.originCoordinates.longitude,
        destinationAddress:
          resolvedTrip.destinationPlace.address,
        destinationLatitude:
          resolvedTrip.destinationPlace.latitude,
        destinationLongitude:
          resolvedTrip.destinationPlace.longitude,
        distanceKm,
        durationMinutes,
        paymentMethod,
        rideType,
      });
    } catch (error) {
      setLoading(false);
      setConfirmOpen(false);

      setMessage(
        `Error creando el viaje: ${
          error instanceof Error
            ? error.message
            : "No se pudo calcular el precio"
        }`
      );

      return;
    }

    const {
      data: dispatchResult,
      error: dispatchError,
    } = await supabase.rpc(
      "process_trip_dispatch",
      {
        requested_trip_id: tripId,
      }
    );

    setLoading(false);
    setConfirmOpen(false);

    if (dispatchError) {
      setMessage(
        `El viaje se creó, pero ocurrió un error buscando conductores: ${dispatchError.message}`
      );

      window.setTimeout(() => {
        router.push(`/dashboard/trips/${tripId}`);
        router.refresh();
      }, 2000);

      return;
    }

    const count = Number(
      (
        dispatchResult as {
          notified_drivers?: number;
        } | null
      )?.notified_drivers ?? 0
    );

    setMessage(
      count === 0
        ? "Viaje creado. Seguiremos buscando conductores cercanos."
        : `Viaje creado. Se notificó a ${count} conductor${
            count === 1 ? "" : "es"
          } cercano${count === 1 ? "" : "s"}.`
    );

    window.setTimeout(() => {
      router.push(`/dashboard/trips/${tripId}`);
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
            ...MOBILITY_CONFIG.defaultOrigin,
          }
        : null);

    const previewDestination =
      destinationPlace ??
      (!placesConfigured && destinationReady
        ? {
            placeId: "demo-preview",
            name: destination,
            address: destination,
            ...MOBILITY_CONFIG.defaultDestination,
          }
        : null);

    if (!previewOrigin || !previewDestination) {
      return null;
    }

    return estimateRouteSync(
      previewOrigin,
      {
        latitude: previewDestination.latitude,
        longitude: previewDestination.longitude,
      }
    );
  }, [
    destination,
    destinationPlace,
    destinationReady,
    originCoordinates,
    originReady,
    placesConfigured,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadDynamicFares() {
      if (!estimate) {
        setEconomyFare(null);
        setComfortFare(null);
        setPricingError("");
        return;
      }

      setPricingLoading(true);
      setPricingError("");

      try {
        const [economy, comfort] = await Promise.all([
          getDynamicFareEstimate(
            estimate.distanceKm,
            estimate.durationMinutes,
            "economy"
          ),
          getDynamicFareEstimate(
            estimate.distanceKm,
            estimate.durationMinutes,
            "comfort"
          ),
        ]);

        if (!cancelled) {
          setEconomyFare(economy);
          setComfortFare(comfort);
        }
      } catch (error) {
        if (!cancelled) {
          setEconomyFare(null);
          setComfortFare(null);
          setPricingError(
            error instanceof Error
              ? error.message
              : "No se pudieron calcular las tarifas."
          );
        }
      } finally {
        if (!cancelled) {
          setPricingLoading(false);
        }
      }
    }

    void loadDynamicFares();

    return () => {
      cancelled = true;
    };
  }, [estimate]);

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
            {english
              ? "Back to rides"
              : "Volver a viajes"}
          </button>

          <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
            {english
              ? "New request"
              : "Nueva solicitud"}
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            {english
              ? "Where are we going?"
              : "¿A dónde vamos?"}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            {english
              ? "Select your route, review the estimated price and choose how you will pay."
              : "Selecciona tu ruta, revisa el precio estimado y elige cómo pagarás el viaje."}
          </p>
        </div>

        {!placesConfigured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {english
              ? "Demo mode is active: addresses and estimates are provisional until Google Places and Routes are configured."
              : "Modo demo activo: las direcciones y estimaciones son provisionales hasta configurar Google Places y Routes."}
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
                    {english
                      ? "AXI route"
                      : "Ruta AXI"}
                  </p>

                  <p className="mt-1 font-black">
                    {english
                      ? "Select pickup and destination"
                      : "Selecciona origen y destino"}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <LocationStatus
                  label={english ? "Pickup" : "Origen"}
                  ready={originReady}
                />

                <LocationStatus
                  label={english ? "Destination" : "Destino"}
                  ready={destinationReady}
                />
              </div>
            </div>

            <div className="mt-7 space-y-7">
              <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-sm font-black text-slate-700">
                    {english
                      ? "Pickup point"
                      : "Punto de partida"}
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
                      ? english
                        ? "Locating..."
                        : "Ubicando..."
                      : english
                        ? "Use my location"
                        : "Usar mi ubicación"}
                  </button>
                </div>

                <PlaceAutocomplete
                  label={
                    english
                      ? "Search for your pickup location"
                      : "Busca el lugar donde te recogerán"
                  }
                  placeholder={
                    english
                      ? "Example: UDLAP, Cholula"
                      : "Ejemplo: UDLAP, Cholula"
                  }
                  value={origin}
                  onTextChange={handleOriginTextChange}
                  onPlaceSelect={handleOriginSelect}
                  resolvedExternally={
                    originCoordinates !== null
                  }
                />

                {originReady && (
                  <ConfirmedLocation
                    title={
                      english
                        ? "Pickup point confirmed"
                        : "Punto de partida confirmado"
                    }
                    value={origin}
                    variant="origin"
                  />
                )}
              </div>

              <div className="relative pl-6">
                <span className="absolute bottom-2 left-0 top-2 border-l-2 border-dashed border-slate-300" />

                <PlaceAutocomplete
                  label={
                    english
                      ? "Where do you want to go?"
                      : "¿A dónde quieres ir?"
                  }
                  placeholder={
                    english
                      ? "Example: Angelópolis, Puebla"
                      : "Ejemplo: Angelópolis, Puebla"
                  }
                  value={destination}
                  onTextChange={handleDestinationTextChange}
                  onPlaceSelect={handleDestinationSelect}
                />

                {destinationReady && (
                  <ConfirmedLocation
                    title={
                      english
                        ? "Destination confirmed"
                        : "Destino confirmado"
                    }
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
                {english ? "Payment method" : "Método de pago"}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <PaymentOption
                  active={paymentMethod === "cash"}
                  title={
                    english ? "Cash" : "Efectivo"
                  }
                  description={
                    english
                      ? "Pay the driver directly"
                      : "Paga directamente al taxista"
                  }
                  icon={Banknote}
                  onClick={() => setPaymentMethod("cash")}
                />

                <PaymentOption
                  active={paymentMethod === "card"}
                  title={
                    english ? "Card" : "Tarjeta"
                  }
                  description={
                    english
                      ? "Digital charge when the ride ends"
                      : "Cobro digital al terminar"
                  }
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
                    {english
                      ? "Your card will be selected or added on the secure payment screen."
                      : "La tarjeta se elegirá o registrará en la pantalla segura de pagos."}
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
              {english ? "Ride summary" : "Resumen del viaje"}
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {english ? "Your AXI ride" : "Tu viaje AXI"}
            </h2>

            <div className="mt-6 space-y-4">
              <SummaryLocation
                label={english ? "Pickup" : "Origen"}
                value={
                  origin ||
                  (english ? "Pending" : "Pendiente")
                }
                active={originReady}
              />

              <SummaryLocation
                label={english ? "Destination" : "Destino"}
                value={
                  destination ||
                  (english ? "Pending" : "Pendiente")
                }
                active={destinationReady}
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <EstimateCard
                icon={Route}
                label={english ? "Distance" : "Distancia"}
                value={
                  estimate
                    ? `${estimate.distanceKm.toFixed(1)} km`
                    : "--"
                }
              />

              <EstimateCard
                icon={Clock3}
                label={english ? "Time" : "Tiempo"}
                value={
                  estimate
                    ? `${estimate.durationMinutes} min`
                    : "--"
                }
              />
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {english ? "Choose your vehicle" : "Elige tu vehículo"}
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {english ? "Select an option for your ride" : "Selecciona la opción para tu viaje"}
                  </p>
                </div>

                <CircleDollarSign
                  size={25}
                  className="text-yellow-500"
                />
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setRideType("economy")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[1.4rem] border-2 p-4 text-left transition",
                    rideType === "economy"
                      ? "border-yellow-400 bg-slate-950 text-white shadow-lg"
                      : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black">
                        AXI 4
                      </span>

                      {rideType === "economy" && (
                        <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black uppercase text-black">
                          {english ? "Selected" : "Seleccionado"}
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "mt-1 text-xs font-bold",
                        rideType === "economy"
                          ? "text-slate-400"
                          : "text-slate-500"
                      )}
                    >
                      {english ? "Up to 4 passengers" : "Hasta 4 pasajeros"}
                    </p>
                  </div>

                  <p
                    className={cn(
                      "text-2xl font-black",
                      rideType === "economy"
                        ? "text-yellow-400"
                        : "text-slate-950"
                    )}
                  >
                    {economyFare
                      ? formatCurrency(
                          getPassengerFareTotal(economyFare) ?? 0
                        )
                      : estimate
                        ? formatCurrency(estimate.estimatedPrice)
                        : "--"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRideType("comfort")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[1.4rem] border-2 p-4 text-left transition",
                    rideType === "comfort"
                      ? "border-yellow-400 bg-slate-950 text-white shadow-lg"
                      : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black">
                        AXI 6
                      </span>

                      {rideType === "comfort" && (
                        <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black uppercase text-black">
                          {english ? "Selected" : "Seleccionado"}
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "mt-1 text-xs font-bold",
                        rideType === "comfort"
                          ? "text-slate-400"
                          : "text-slate-500"
                      )}
                    >
                      {english ? "Up to 6 passengers" : "Hasta 6 pasajeros"}
                    </p>
                  </div>

                  <p
                    className={cn(
                      "text-2xl font-black",
                      rideType === "comfort"
                        ? "text-yellow-400"
                        : "text-slate-950"
                    )}
                  >
                    {comfortFare
                      ? formatCurrency(
                          getPassengerFareTotal(comfortFare) ?? 0
                        )
                      : estimate
                        ? formatCurrency(
                            estimate.estimatedPrice * 1.25
                          )
                        : "--"}
                  </p>
                </button>
              </div>
            </div>

            <div className="mt-4">
              {pricingLoading && (
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                  <Clock3
                    size={16}
                    className="animate-pulse"
                  />

                  {english ? "Refreshing fare..." : "Actualizando tarifa..."}
                </div>
              )}

              {!pricingLoading && dynamicFare && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {english ? "The price for your ride has been updated." : "Precio actualizado para tu viaje."}
                </div>
              )}

              {pricingError && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {english
                      ? "Showing local estimate. "
                      : "Mostrando estimación local. "}
                  {pricingError}
                </div>
              )}
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
                    {english ? "Method" : "Método"}
                  </p>

                  <p className="font-black">
                    {paymentMethod === "cash"
                      ? english
                        ? "Cash"
                        : "Efectivo"
                      : english
                        ? "Card"
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
              {english ? "Review and request" : "Revisar y solicitar"}
              <ArrowRight size={19} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/trips")}
              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 font-black text-slate-600 transition hover:bg-slate-50"
            >
              {english ? "Cancel" : "Cancelar"}
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
                aria-label={
                  english ? "Close" : "Cerrar"
                }
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
                {english ? "Confirm your ride" : "Confirma tu viaje"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {english
                  ? "Review the route, payment method and price before searching for a driver."
                  : "Revisa la ruta, el método de pago y el precio antes de buscar un conductor."}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="space-y-4">
                <SummaryLocation
                  label={english ? "Pickup" : "Origen"}
                  value={origin}
                  active
                />

                <SummaryLocation
                  label={english ? "Destination" : "Destino"}
                  value={resolvedTrip.destinationPlace.address}
                  active
                />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <EstimateCard
                  icon={Route}
                  label={english ? "Distance" : "Distancia"}
                  value={`${estimate.distanceKm.toFixed(1)} km`}
                />

                <EstimateCard
                  icon={Clock3}
                  label={english ? "Time" : "Tiempo"}
                  value={`${estimate.durationMinutes} min`}
                />

                <EstimateCard
                  icon={CircleDollarSign}
                  label={english ? "Estimated" : "Estimado"}
                  value={formatCurrency(
                    getPassengerFareTotal(
                      dynamicFare
                    ) ??
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
                      {english ? "Payment method" : "Método de pago"}
                    </p>

                    <p className="font-black">
                      {paymentMethod === "cash"
                      ? english
                        ? "Cash"
                        : "Efectivo"
                      : english
                        ? "Card"
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
                  ? english
                    ? "Searching for drivers..."
                    : "Buscando conductores..."
                  : english
                    ? "Confirm and search for a driver"
                    : "Confirmar y buscar conductor"}

                {!loading && <ArrowRight size={19} />}
              </button>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="mt-3 h-12 w-full rounded-2xl border border-slate-200 font-black text-slate-600"
              >
                {english ? "Edit ride" : "Modificar viaje"}
              </button>

              <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                {english
                  ? "The price may change when Google Routes calculates the exact route."
                  : "El precio podrá ajustarse cuando Google Routes calcule la ruta exacta."}
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
  const { locale } = useLanguage();
  const english = locale === "en";
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
          {ready
            ? english
              ? "Location confirmed"
              : "Ubicación confirmada"
            : english
              ? "Pending"
              : "Pendiente"}
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
