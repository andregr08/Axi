"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Bell,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Menu,
  Navigation,
  Route,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import {
  GoogleMapView,
  type MapCoordinates,
} from "@/components/maps/GoogleMap";
import {
  PlaceAutocomplete,
  type SelectedPlace,
} from "@/components/maps/PlaceAutocomplete";
import {
  createPricedTrip,
  getDynamicFareEstimate,
  getPricingPeriodLabel,
  type DynamicFareEstimate,
  type RideType,
} from "@/lib/mobility";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type PaymentMethod = "cash" | "card";

type BookingStep =
  | "home"
  | "search"
  | "options"
  | "requesting";

type RideOption = {
  id: RideType;
  name: string;
  description: string;
  passengers: number;
  multiplier: number;
  pickupMinutes: number;
};

const BASE_FARE = 35;
const PRICE_PER_KM = 12;
const BOOKING_FEE = 8;

const rideOptions: RideOption[] = [
  {
    id: "economy",
    name: "AXI Eco",
    description: "Viajes cómodos a mejor precio",
    passengers: 4,
    multiplier: 1,
    pickupMinutes: 4,
  },
  {
    id: "comfort",
    name: "AXI Comfort",
    description: "Autos más espaciosos y recientes",
    passengers: 4,
    multiplier: 1.35,
    pickupMinutes: 6,
  },
  {
    id: "xl",
    name: "AXI XL",
    description: "Más espacio para grupos",
    passengers: 6,
    multiplier: 1.75,
    pickupMinutes: 8,
  },
];

function calculateDistanceKm(
  origin: Coordinates,
  destination: Coordinates
) {
  const earthRadiusKm = 6371;

  const latitudeDifference =
    ((destination.latitude -
      origin.latitude) *
      Math.PI) /
    180;

  const longitudeDifference =
    ((destination.longitude -
      origin.longitude) *
      Math.PI) /
    180;

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
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    );

  return Math.max(
    1,
    earthRadiusKm * centralAngle
  );
}

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

function shortAddress(value: string) {
  const firstPart =
    value.split(",")[0]?.trim();

  return firstPart || value;
}

export default function PasajeroPage() {
  const router = useRouter();

  const [checkingAccount, setCheckingAccount] =
    useState(true);

  const placesConfigured = Boolean(
    process.env
      .NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );

  const [step, setStep] =
    useState<BookingStep>("home");

  useEffect(() => {
    let active = true;

    async function validateAccount() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role, account_active")
          .eq("id", session.user.id)
          .maybeSingle();

      if (!active) return;

      if (profileError || !profile) {
        await supabase.auth.signOut();
        router.replace(
          "/login?error=account-verification"
        );
        return;
      }

      if (profile.account_active === false) {
        await supabase.auth.signOut();
        router.replace("/login?error=suspended");
        return;
      }

      if (profile.role !== "passenger") {
        router.replace("/dashboard");
        return;
      }

      setCheckingAccount(false);
    }

    void validateAccount();

    return () => {
      active = false;
    };
  }, [router]);

  const [origin, setOrigin] = useState(
    "Mi ubicación actual"
  );

  const [
    originCoordinates,
    setOriginCoordinates,
  ] = useState<Coordinates | null>(null);

  const [destination, setDestination] =
    useState("");

  const [
    destinationPlace,
    setDestinationPlace,
  ] = useState<SelectedPlace | null>(
    null
  );

  const [rideType, setRideType] =
    useState<RideType>("economy");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>("cash");

  const [locating, setLocating] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    dynamicFares,
    setDynamicFares,
  ] = useState<
    Partial<
      Record<
        RideType,
        DynamicFareEstimate
      >
    >
  >({});

  const [
    pricingLoading,
    setPricingLoading,
  ] = useState(false);

  const [
    pricingError,
    setPricingError,
  ] = useState("");

  const selectedRide =
    rideOptions.find(
      (option) => option.id === rideType
    ) ?? rideOptions[0];

  const mapOrigin =
    useMemo<MapCoordinates | null>(
      () =>
        originCoordinates
          ? {
              lat:
                originCoordinates.latitude,
              lng:
                originCoordinates.longitude,
            }
          : null,
      [originCoordinates]
    );

  const mapDestination =
    useMemo<MapCoordinates | null>(
      () =>
        destinationPlace
          ? {
              lat:
                destinationPlace.latitude,
              lng:
                destinationPlace.longitude,
            }
          : null,
      [destinationPlace]
    );

  const estimate = useMemo(() => {
    if (
      !originCoordinates ||
      !destinationPlace
    ) {
      return null;
    }

    const distanceKm =
      calculateDistanceKm(
        originCoordinates,
        {
          latitude:
            destinationPlace.latitude,
          longitude:
            destinationPlace.longitude,
        }
      );

    const durationMinutes = Math.max(
      5,
      Math.round(
        (distanceKm / 28) * 60
      )
    );

    const basePrice = Math.max(
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
      basePrice,
    };
  }, [
    destinationPlace,
    originCoordinates,
  ]);

  const selectedFare =
    dynamicFares[rideType];

  const selectedPrice =
    getPassengerFareTotal(selectedFare) ??
    (estimate
      ? Math.round(
          estimate.basePrice *
            selectedRide.multiplier
        )
      : null);

  useEffect(() => {
    let cancelled = false;

    async function loadDynamicFares() {
      if (!estimate) {
        setDynamicFares({});
        setPricingError("");
        return;
      }

      setPricingLoading(true);
      setPricingError("");

      try {
        const results =
          await Promise.all(
            rideOptions.map(
              async (option) => {
                const fare =
                  await getDynamicFareEstimate(
                    estimate.distanceKm,
                    estimate.durationMinutes,
                    option.id
                  );

                return [
                  option.id,
                  fare,
                ] as const;
              }
            )
          );

        if (cancelled) {
          return;
        }

        setDynamicFares(
          Object.fromEntries(results)
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDynamicFares({});
        setPricingError(
          error instanceof Error
            ? error.message
            : "No se pudo calcular la tarifa."
        );
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

  function getCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage(
        "Tu navegador no permite obtener tu ubicación."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOriginCoordinates({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
        });

        setOrigin("Mi ubicación actual");
        setLocating(false);
      },
      (error) => {
        setLocating(false);

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          setMessage(
            "Permite el acceso a tu ubicación para pedir un viaje."
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

  function handleDestinationTextChange(
    value: string
  ) {
    setDestination(value);
    setDestinationPlace(null);
    setMessage("");
  }

  function handleDestinationSelect(
    place: SelectedPlace
  ) {
    setDestination(place.address);
    setDestinationPlace(place);
    setMessage("");

    if (!originCoordinates) {
      getCurrentLocation();
    }

    setStep("options");
  }

  function openSearch() {
    setMessage("");
    setStep("search");

    if (!originCoordinates) {
      getCurrentLocation();
    }
  }

  function goBack() {
    setMessage("");

    if (step === "options") {
      setStep("search");
      return;
    }

    if (step === "search") {
      setStep("home");
      return;
    }

    router.back();
  }

  async function requestRide() {
    if (
      !originCoordinates ||
      !destinationPlace ||
      !estimate ||
      !selectedPrice
    ) {
      setMessage(
        "Confirma tu ubicación y selecciona un destino."
      );

      setStep("search");
      return;
    }

    setLoading(true);
    setStep("requesting");
    setMessage("");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role, account_active")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setLoading(false);
      router.replace(
        "/login?error=account-verification"
      );
      return;
    }

    if (profile.account_active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      router.replace("/login?error=suspended");
      return;
    }

    if (profile.role !== "passenger") {
      setLoading(false);
      router.replace("/dashboard");
      return;
    }

    let tripId: string;

    try {
      tripId = await createPricedTrip({
        originAddress: origin.trim(),
        originLatitude:
          originCoordinates.latitude,
        originLongitude:
          originCoordinates.longitude,
        destinationAddress:
          destinationPlace.address,
        destinationLatitude:
          destinationPlace.latitude,
        destinationLongitude:
          destinationPlace.longitude,
        distanceKm:
          estimate.distanceKm,
        durationMinutes:
          estimate.durationMinutes,
        paymentMethod,
        rideType,
      });
    } catch (error) {
      setLoading(false);
      setStep("options");

      setMessage(
        `No pudimos crear el viaje: ${
          error instanceof Error
            ? error.message
            : "Error desconocido"
        }`
      );

      return;
    }

    const { error: dispatchError } =
      await supabase.rpc(
        "process_trip_dispatch",
        {
          requested_trip_id: tripId,
        }
      );

    setLoading(false);

    if (dispatchError) {
      setMessage(
        "El viaje fue creado. AXI continuará buscando conductores."
      );
    }

    router.push(
      `/dashboard/trips/${tripId}`
    );

    router.refresh();
  }

  if (checkingAccount) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
        <div className="text-center">
          <LoaderCircle
            size={40}
            className="mx-auto animate-spin text-yellow-500"
          />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Verificando tu cuenta...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] min-h-[680px] overflow-hidden bg-slate-200">
      <div className="absolute inset-0">
        <GoogleMapView
          origin={mapOrigin}
          destination={mapDestination}
          showUserLocation
          showRoute={
            Boolean(
              mapOrigin &&
                mapDestination
            )
          }
          heightClassName="h-full"
          className="rounded-none border-0 shadow-none"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-black/30 to-transparent" />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard")
          }
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_8px_30px_rgba(15,23,42,0.2)] transition hover:scale-105"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>

        <div className="rounded-full bg-slate-950 px-5 py-3 text-lg font-black tracking-tight text-white shadow-xl">
          AXI
          <span className="text-yellow-400">
            .
          </span>
        </div>

        <button
          type="button"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_8px_30px_rgba(15,23,42,0.2)] transition hover:scale-105"
          aria-label="Notificaciones"
        >
          <Bell size={21} />

          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-yellow-400" />
        </button>
      </header>

      <button
        type="button"
        onClick={getCurrentLocation}
        disabled={locating}
        className="absolute right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_8px_30px_rgba(15,23,42,0.2)] transition hover:scale-105 disabled:opacity-60 sm:right-6"
        style={{
          bottom:
            step === "home"
              ? "330px"
              : step === "search"
                ? "500px"
                : "560px",
        }}
        aria-label="Usar mi ubicación"
      >
        <LocateFixed
          size={22}
          className={
            locating
              ? "animate-pulse"
              : ""
          }
        />
      </button>

      <section
        className={cn(
          "absolute inset-x-0 bottom-0 z-40 mx-auto w-full bg-white shadow-[0_-20px_70px_rgba(15,23,42,0.18)] transition-all duration-300",
          "rounded-t-[2rem] sm:bottom-5 sm:max-w-xl sm:rounded-[2rem]",
          step === "home" &&
            "min-h-[300px]",
          step === "search" &&
            "min-h-[470px]",
          step === "options" &&
            "max-h-[76dvh] overflow-y-auto",
          step === "requesting" &&
            "min-h-[300px]"
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

        {step === "home" && (
          <HomePanel
            onOpenSearch={openSearch}
            onChooseRecent={(
              value
            ) => {
              setDestination(value);
              setStep("search");
              getCurrentLocation();
            }}
          />
        )}

        {step === "search" && (
          <SearchPanel
            origin={origin}
            destination={destination}
            locating={locating}
            placesConfigured={
              placesConfigured
            }
            message={message}
            onBack={goBack}
            onLocate={getCurrentLocation}
            onDestinationTextChange={
              handleDestinationTextChange
            }
            onDestinationSelect={
              handleDestinationSelect
            }
          />
        )}

        {step === "options" &&
          estimate &&
          selectedPrice && (
            <OptionsPanel
              origin={origin}
              destination={
                destinationPlace
                  ?.address ??
                destination
              }
              distanceKm={
                estimate.distanceKm
              }
              durationMinutes={
                estimate.durationMinutes
              }
              selectedRideId={
                rideType
              }
              paymentMethod={
                paymentMethod
              }
              message={message}
              dynamicFares={
                dynamicFares
              }
              pricingLoading={
                pricingLoading
              }
              pricingError={
                pricingError
              }
              onBack={goBack}
              onSelectRide={
                setRideType
              }
              onSelectPayment={
                setPaymentMethod
              }
              onRequestRide={
                requestRide
              }
            />
          )}

        {step === "requesting" && (
          <RequestingPanel
            destination={
              destinationPlace?.address ??
              destination
            }
          />
        )}
      </section>
    </main>
  );
}

function HomePanel({
  onOpenSearch,
  onChooseRecent,
}: {
  onOpenSearch: () => void;
  onChooseRecent: (
    value: string
  ) => void;
}) {
  const recentPlaces = [
    "Universidad de las Américas Puebla",
    "Angelópolis Lifestyle Center",
  ];

  return (
    <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-7">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">
        ¿A dónde vamos?
      </h1>

      <button
        type="button"
        onClick={onOpenSearch}
        className="mt-5 flex min-h-16 w-full items-center gap-4 rounded-2xl bg-slate-100 px-5 text-left transition hover:bg-slate-200"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
          <Navigation size={18} />
        </span>

        <span className="flex-1 text-base font-bold text-slate-500">
          Ingresa tu destino
        </span>

        <ChevronRight
          size={21}
          className="text-slate-400"
        />
      </button>

      <div className="mt-4 divide-y divide-slate-100">
        {recentPlaces.map((place) => (
          <button
            key={place}
            type="button"
            onClick={() =>
              onChooseRecent(place)
            }
            className="flex w-full items-center gap-4 py-3.5 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <Clock3
                size={18}
                className="text-slate-600"
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-slate-900">
                {shortAddress(place)}
              </span>

              <span className="mt-0.5 block text-xs text-slate-400">
                Destino reciente
              </span>
            </span>

            <ChevronRight
              size={18}
              className="text-slate-300"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchPanel({
  origin,
  destination,
  locating,
  placesConfigured,
  message,
  onBack,
  onLocate,
  onDestinationTextChange,
  onDestinationSelect,
}: {
  origin: string;
  destination: string;
  locating: boolean;
  placesConfigured: boolean;
  message: string;
  onBack: () => void;
  onLocate: () => void;
  onDestinationTextChange: (
    value: string
  ) => void;
  onDestinationSelect: (
    place: SelectedPlace
  ) => void;
}) {
  return (
    <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Solicitar viaje
          </p>

          <h2 className="text-xl font-black text-slate-950">
            Elige tu destino
          </h2>
        </div>
      </div>

      <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex w-5 shrink-0 flex-col items-center pt-2">
            <span className="h-3 w-3 rounded-full border-[3px] border-emerald-500 bg-white" />
            <span className="my-1 h-12 border-l-2 border-dashed border-slate-300" />
            <span className="h-3 w-3 bg-slate-950" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <button
              type="button"
              onClick={onLocate}
              disabled={locating}
              className="flex min-h-12 w-full items-center justify-between rounded-xl bg-slate-50 px-4 text-left"
            >
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-400">
                  Punto de partida
                </span>

                <span className="block truncate text-sm font-black text-slate-900">
                  {locating
                    ? "Obteniendo ubicación..."
                    : origin}
                </span>
              </span>

              <LocateFixed
                size={18}
                className={
                  locating
                    ? "animate-pulse text-emerald-600"
                    : "text-slate-500"
                }
              />
            </button>

            <PlaceAutocomplete
              label="Destino"
              placeholder="¿A dónde quieres ir?"
              value={destination}
              onTextChange={
                onDestinationTextChange
              }
              onPlaceSelect={
                onDestinationSelect
              }
            />
          </div>
        </div>
      </div>

      {!placesConfigured && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Google Places no está configurado. El buscador funcionará en modo demostración.
        </p>
      )}

      {message && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </p>
      )}

      <div className="mt-5">
        <p className="text-sm font-black text-slate-950">
          Destinos sugeridos
        </p>

        <div className="mt-2 divide-y divide-slate-100">
          {[
            {
              title: "Casa",
              description:
                "Agrega tu dirección",
            },
            {
              title: "Trabajo",
              description:
                "Agrega tu lugar de trabajo",
            },
          ].map((place) => (
            <div
              key={place.title}
              className="flex items-center gap-4 py-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <MapPin
                  size={18}
                  className="text-slate-600"
                />
              </span>

              <div>
                <p className="font-bold text-slate-900">
                  {place.title}
                </p>

                <p className="text-xs text-slate-400">
                  {place.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionsPanel({
  origin,
  destination,
  distanceKm,
  durationMinutes,
  selectedRideId,
  paymentMethod,
  message,
  dynamicFares,
  pricingLoading,
  pricingError,
  onBack,
  onSelectRide,
  onSelectPayment,
  onRequestRide,
}: {
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  selectedRideId: RideType;
  paymentMethod: PaymentMethod;
  message: string;
  dynamicFares: Partial<
    Record<
      RideType,
      DynamicFareEstimate
    >
  >;
  pricingLoading: boolean;
  pricingError: string;
  onBack: () => void;
  onSelectRide: (
    value: RideType
  ) => void;
  onSelectPayment: (
    value: PaymentMethod
  ) => void;
  onRequestRide: () => void;
}) {
  const basePrice = Math.max(
    55,
    Math.round(
      BASE_FARE +
        distanceKm * PRICE_PER_KM +
        BOOKING_FEE
    )
  );

  const selectedOption =
    rideOptions.find(
      (option) =>
        option.id === selectedRideId
    ) ?? rideOptions[0];

  const selectedFare =
    dynamicFares[selectedRideId];

  const selectedPrice =
    getPassengerFareTotal(selectedFare) ??
    Math.round(
      basePrice *
        selectedOption.multiplier
    );

  return (
    <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Confirma tu viaje
          </p>

          <p className="truncate text-lg font-black text-slate-950">
            {shortAddress(destination)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
        <div className="flex w-5 shrink-0 flex-col items-center">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="my-1 h-7 border-l-2 border-dashed border-slate-300" />
          <span className="h-3 w-3 bg-slate-950" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-sm font-bold text-slate-600">
            {origin}
          </p>

          <p className="truncate text-sm font-black text-slate-950">
            {destination}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-black text-slate-950">
            {durationMinutes} min
          </p>

          <p className="text-xs text-slate-400">
            {distanceKm.toFixed(1)} km
          </p>
        </div>
      </div>

      <div className="mt-4">
        {pricingLoading && (
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
            <LoaderCircle
              size={16}
              className="animate-spin"
            />

            Actualizando tarifas...
          </div>
        )}

        {!pricingLoading && selectedFare && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Precio actualizado para tu viaje.
          </div>
        )}

        {pricingError && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Mostrando precio estimado
            local. {pricingError}
          </div>
        )}
      </div>

      <p className="mt-6 text-sm font-black text-slate-950">
        Elige un viaje
      </p>

      <div className="mt-2 space-y-2">
        {rideOptions.map((option) => {
          const active =
            selectedRideId ===
            option.id;

          const fare =
            dynamicFares[option.id];

          const price =
            getPassengerFareTotal(fare) ??
            Math.round(
              basePrice *
                option.multiplier
            );

          return (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                onSelectRide(
                  option.id
                )
              }
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border-2 p-3 text-left transition",
                active
                  ? "border-slate-950 bg-slate-50"
                  : "border-transparent hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl",
                  active
                    ? "bg-yellow-400 text-slate-950"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {option.id === "xl" ? (
                  <UsersRound
                    size={27}
                  />
                ) : (
                  <CarFront
                    size={28}
                  />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-black text-slate-950">
                    {option.name}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                    <UsersRound
                      size={12}
                    />
                    {
                      option.passengers
                    }
                  </span>
                </span>

                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {
                    option.description
                  }
                </span>

                <span className="mt-1 block text-xs font-bold text-emerald-600">
                  Llega en aproximadamente{" "}
                  {
                    option.pickupMinutes
                  }{" "}
                  min
                </span>
              </span>

              <span className="text-right">
                <span className="block text-lg font-black text-slate-950">
                  {formatCurrency(
                    price
                  )}
                </span>

                {active && (
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-white">
                    <Check
                      size={13}
                    />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm font-black text-slate-950">
          Método de pago
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <PaymentButton
            active={
              paymentMethod === "cash"
            }
            title="Efectivo"
            icon={Banknote}
            onClick={() =>
              onSelectPayment("cash")
            }
          />

          <PaymentButton
            active={
              paymentMethod === "card"
            }
            title="Tarjeta"
            icon={CreditCard}
            onClick={() =>
              onSelectPayment("card")
            }
          />
        </div>

        {paymentMethod === "card" && (
          <div className="mt-3 flex gap-3 rounded-2xl bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">
            <ShieldCheck
              size={17}
              className="mt-0.5 shrink-0"
            />
            La tarjeta se seleccionará desde el módulo seguro de pagos.
          </div>
        )}
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={onRequestRide}
        className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-black"
      >
        Pedir{" "}
        {selectedOption.name}
        <span className="text-yellow-400">
          {formatCurrency(
            selectedPrice
          )}
        </span>
      </button>
    </div>
  );
}

function PaymentButton({
  active,
  title,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: typeof Banknote;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-14 items-center justify-center gap-2 rounded-2xl border-2 font-black transition",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600"
      )}
    >
      <Icon size={19} />
      {title}
    </button>
  );
}

function RequestingPanel({
  destination,
}: {
  destination: string;
}) {
  return (
    <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 text-center">
      <button
        type="button"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"
        aria-label="Cerrar"
      >
        <X size={19} />
      </button>

      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-400 text-slate-950">
        <LoaderCircle
          size={36}
          className="animate-spin"
        />
      </span>

      <h2 className="mt-5 text-2xl font-black text-slate-950">
        Buscando conductor
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Estamos buscando un conductor cercano para llevarte a{" "}
        <strong className="text-slate-800">
          {shortAddress(
            destination
          )}
        </strong>
        .
      </p>

      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
        <Route size={18} />
        Esto normalmente tarda menos de un minuto
      </div>
    </div>
  );
}
