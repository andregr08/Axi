"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  WalletCards,
} from "lucide-react";

import {
  PlaceAutocomplete,
  type SelectedPlace,
} from "@/components/maps/PlaceAutocomplete";
import {
  TripRouteMap,
  type RoutePoint,
} from "@/components/maps/TripRouteMap";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type RouteData = {
  distanceKm: number;
  durationMinutes: number;
  routePoints: RoutePoint[];
};

const BOOKING_FEE = 8;
const BASE_FARE = 35;
const PRICE_PER_KM = 9;
const MINIMUM_FARE = 55;

export default function NewTripPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [originCoordinates, setOriginCoordinates] =
    useState<Coordinates | null>(null);

  const [destinationPlace, setDestinationPlace] =
    useState<SelectedPlace | null>(null);

  const [routeData, setRouteData] =
    useState<RouteData | null>(null);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [routeError, setRouteError] =
    useState("");

  const [locating, setLocating] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (!originCoordinates || !destinationPlace) {
      return;
    }

    const controller = new AbortController();

    const originCoords = originCoordinates;
    const destinationCoords = destinationPlace;

    async function loadRoute() {
      setRouteLoading(true);
      setRouteData(null);
      setRouteError("");

      try {
        const params = new URLSearchParams({
          originLat: String(originCoordinates!.latitude),
          originLng: String(originCoordinates!.longitude),
          destinationLat: String(destinationPlace!.latitude),
          destinationLng: String(destinationPlace!.longitude),
        });

        const response = await fetch(
          `/api/route?${params.toString()}`,
          {
            signal: controller.signal,
          }
        );

        const result: {
          distanceKm?: number;
          durationMinutes?: number;
          routePoints?: RoutePoint[];
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ??
              t("tripNew.routeCalculationFailed")
          );
        }

        setRouteData({
          distanceKm: Number(result.distanceKm ?? 0),
          durationMinutes: Number(
            result.durationMinutes ?? 0
          ),
          routePoints: Array.isArray(result.routePoints)
            ? result.routePoints
            : [],
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("Error calculando ruta:", error);

        setRouteError(
          error instanceof Error
            ? error.message
            : t("tripNew.routeCalculationFailed")
        );
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    }

    void loadRoute();

    return () => {
      controller.abort();
    };
  }, [originCoordinates, destinationPlace]);

  const estimatedPrice =
    routeData === null
      ? null
      : Math.max(
          MINIMUM_FARE,
          Math.round(
            (BASE_FARE +
              routeData.distanceKm * PRICE_PER_KM +
              BOOKING_FEE) *
              100
          ) / 100
        );

  const originReady =
    originCoordinates !== null;

  const destinationReady =
    destinationPlace !== null;

  const formReady =
    originReady &&
    destinationReady &&
    routeData !== null &&
    estimatedPrice !== null &&
    !routeLoading;

  function clearRoute() {
    setRouteData(null);
    setRouteError("");
    setMessage("");
  }

  function handleOriginTextChange(value: string) {
    setOrigin(value);
    setOriginCoordinates(null);
    clearRoute();
  }

  function handleOriginSelect(place: SelectedPlace) {
    setOrigin(place.address);
    setOriginCoordinates({
      latitude: place.latitude,
      longitude: place.longitude,
    });
    clearRoute();
  }

  function handleDestinationTextChange(
    value: string
  ) {
    setDestination(value);
    setDestinationPlace(null);
    clearRoute();
  }

  function handleDestinationSelect(
    place: SelectedPlace
  ) {
    setDestination(place.address);
    setDestinationPlace(place);
    clearRoute();
  }

  function getCurrentLocation() {
    setMessage("");
    setRouteError("");

    if (!navigator.geolocation) {
      setMessage(
        t("tripNew.browserLocationUnsupported")
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

        setOrigin(t("tripNew.currentLocation"));
        setLocating(false);

        setMessage(
          t("tripNew.locationSuccess")
        );
      },
      (error) => {
        setLocating(false);

        if (
          error.code === error.PERMISSION_DENIED
        ) {
          setMessage(
            t("tripNew.locationPermissionRequired")
          );
          return;
        }

        setMessage(
          t("tripNew.locationFailed")
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

    if (!originCoordinates) {
      setMessage(
        t("tripNew.invalidOrigin")
      );
      return;
    }

    if (!destinationPlace) {
      setMessage(
        t("tripNew.invalidDestination")
      );
      return;
    }

    if (!routeData || estimatedPrice === null) {
      setMessage(
        t("tripNew.waitForRoute")
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      const {
        data: trip,
        error: tripError,
      } = await supabase
        .from("trips")
        .insert({
          passenger_id: session.user.id,
          origin_address: origin.trim(),
          origin_lat: originCoordinates!.latitude,
          origin_lng: originCoordinates!.longitude,
          destination_address:
            destinationPlace.address,
          destination_lat:
            destinationPlace!.latitude,
          destination_lng:
            destinationPlace!.longitude,
          distance_km: routeData.distanceKm,
          duration_minutes:
            routeData.durationMinutes,
          estimated_price: estimatedPrice,
          booking_fee: BOOKING_FEE,
          payment_method: "cash",
          status: "requested",
        })
        .select("id")
        .single();

      if (tripError || !trip) {
        throw new Error(
          tripError?.message ??
            t("tripNew.tripCreationFailed")
        );
      }

      const {
        data: notifiedDrivers,
        error: dispatchError,
      } = await supabase.rpc("dispatch_trip", {
        requested_trip_id: trip.id,
        search_radius_km: 10,
        drivers_limit: 10,
      });

      if (dispatchError) {
        setMessage(
          t("tripNew.driverSearchError")
        );
      } else {
        const count = Number(
          notifiedDrivers ?? 0
        );

        setMessage(
          count > 0
            ? `${t("tripNew.tripCreatedNotified")} ${count} ${
                count === 1
                  ? t("tripNew.nearbyDriver")
                  : t("tripNew.nearbyDrivers")
              }.`
            : t("tripNew.tripCreatedSearching")
        );
      }

      window.setTimeout(() => {
        router.push(
          `/dashboard/trips/${trip.id}`
        );
        router.refresh();
      }, 1800);
    } catch (error) {
      console.error("Error creando viaje:", error);

      setMessage(
        error instanceof Error
          ? `${t("tripNew.creatingTripError")} ${error.message}`
          : t("tripNew.generalTripError")
      );
    } finally {
      setSubmitting(false);
    }
  }

  const successMessage =
    message.toLowerCase().includes("correctamente") ||
    message.toLowerCase().includes("viaje creado");

  return (
    <section className="mx-auto max-w-5xl space-y-7 pb-12">
      <header>
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard/trips")
          }
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />{t("tripNew.backToTrips")}</button>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-yellow-600">{t("tripNew.newRequest")}</p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{t("tripNew.title")}</h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">{t("tripNew.description")}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8"
      >
        <div className="rounded-[1.7rem] bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <Navigation size={22} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">{t("tripNew.axiRoute")}</p>

              <p className="mt-1 font-black">{t("tripNew.selectOriginDestination")}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LocationStatus
              label={t("tripNew.origin")}
              ready={originReady}
            />

            <LocationStatus
              label={t("tripNew.destination")}
              ready={destinationReady}
            />
          </div>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-700">{t("tripNew.startingPoint")}</p>

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
                    ? t("tripNew.locating")
                    : t("tripNew.useMyLocation")}
                </button>
              </div>

              <PlaceAutocomplete
                label={t("tripNew.originSearchLabel")}
                placeholder={t("tripNew.originPlaceholder")}
                value={origin}
                onTextChange={
                  handleOriginTextChange
                }
                onPlaceSelect={
                  handleOriginSelect
                }
              />

              {originCoordinates && (
                <ConfirmedLocation
                  origin
                  text={origin}
                />
              )}
            </div>

            <div>
              <PlaceAutocomplete
                label={t("tripNew.destinationSearchLabel")}
                placeholder={t("tripNew.destinationPlaceholder")}
                value={destination}
                onTextChange={
                  handleDestinationTextChange
                }
                onPlaceSelect={
                  handleDestinationSelect
                }
              />

              {destinationPlace && (
                <ConfirmedLocation
                  text={
                    destinationPlace.address
                  }
                />
              )}
            </div>
          </div>

          <div className="min-h-[360px]">
            {originCoordinates &&
            destinationPlace ? (
              <TripRouteMap
                origin={originCoordinates}
                destination={{
                  latitude:
                    destinationPlace!.latitude,
                  longitude:
                    destinationPlace!.longitude,
                }}
                routePoints={
                  routeData?.routePoints ?? []
                }
              />
            ) : (
              <div className="flex h-[360px] flex-col items-center justify-center rounded-[1.7rem] border border-slate-200 bg-slate-100 px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <MapPin size={25} />
                </span>

                <p className="mt-4 font-black text-slate-900">{t("tripNew.mapAppearsHere")}</p>

                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{t("tripNew.confirmLocationsForMap")}</p>
              </div>
            )}
          </div>
        </div>

        {routeLoading && (
          <Notice>{t("tripNew.calculatingBestRoute")}</Notice>
        )}

        {routeError && (
          <Notice error>
            {routeError}
          </Notice>
        )}

        {routeData &&
          estimatedPrice !== null && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <EstimateCard
                icon={<Route size={20} />}
                label={t("tripNew.distance")}
                value={`${routeData.distanceKm.toFixed(
                  1
                )} km`}
              />

              <EstimateCard
                icon={<Clock3 size={20} />}
                label={t("tripNew.estimatedTime")}
                value={`${routeData.durationMinutes} min`}
              />

              <EstimateCard
                icon={
                  <WalletCards size={20} />
                }
                label={t("tripNew.estimatedPrice")}
                value={`$${estimatedPrice.toFixed(
                  2
                )} MXN`}
                highlighted
              />
            </div>
          )}

        {message && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
              successMessage
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
              router.push("/dashboard/trips")
            }
            className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-slate-200 px-5 font-black text-slate-600 transition hover:bg-slate-50"
          >{t("tripNew.cancel")}</button>

          <button
            type="submit"
            disabled={
              submitting ||
              locating ||
              routeLoading ||
              !formReady
            }
            className="flex h-14 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
          >
            {submitting
              ? t("tripNew.searchingDrivers")
              : routeLoading
                ? t("tripNew.calculatingRoute")
                : t("tripNew.confirmTrip")}

            {!submitting &&
              !routeLoading && (
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
  const { t } = useLanguage();

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
            : t("tripNew.pending")}
        </p>
      </div>
    </div>
  );
}

function ConfirmedLocation({
  origin = false,
  text,
}: {
  origin?: boolean;
  text: string;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`mt-3 flex items-start gap-3 rounded-2xl border p-4 ${
        origin
          ? "border-emerald-100 bg-emerald-50"
          : "border-blue-100 bg-blue-50"
      }`}
    >
      {origin ? (
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

      <div className="min-w-0">
        <p
          className={`text-xs font-black ${
            origin
              ? "text-emerald-800"
              : "text-blue-800"
          }`}
        >
          {origin
            ? t("tripNew.originConfirmed")
            : t("tripNew.destinationConfirmed")}
        </p>

        <p
          className={`mt-1 break-words text-xs leading-5 ${
            origin
              ? "text-emerald-700"
              : "text-blue-700"
          }`}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function EstimateCard({
  icon,
  label,
  value,
  highlighted = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlighted
          ? "border-yellow-200 bg-yellow-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div
        className={`flex items-center gap-2 ${
          highlighted
            ? "text-yellow-700"
            : "text-slate-500"
        }`}
      >
        {icon}

        <p className="text-xs font-black uppercase tracking-wider">
          {label}
        </p>
      </div>

      <p className="mt-3 text-xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </div>
  );
}



