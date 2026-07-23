"use client";

import Link from "next/link";
import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Route,
  Star,
} from "lucide-react";
import {
  type DriverIdentity,
} from "@/components/safety/DriverIdentityCard";
import { TripPinCard } from "@/components/safety/TripPinCard";
import { TripDetailHeader } from "@/components/trips/detail/TripDetailHeader";
import { TripProgress } from "@/components/trips/detail/TripProgress";
import { TripSafetyCard } from "@/components/trips/detail/TripSafetyCard";
import type {
  TripDetailData,
  TripDetailRole,
  TripDetailStatus,
  TripDriverLocation,
} from "@/components/trips/detail/TripDetailTypes";
import { DriverTripView } from "@/components/trips/driver/DriverTripView";
import { PassengerTripView } from "@/components/trips/passenger/PassengerTripView";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/lib/supabaseClient";

type ParticipantProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  rating: number | null;
};

type VehicleData = {
  brand: string | null;
  model: string | null;
  color: string | null;
  plates: string | null;
  verified: boolean | null;
};

const statusLabelKeys: Record<
  TripDetailStatus,
  string
> = {
  requested: "tripDetail.status.requested",
  searching: "tripDetail.status.searching",
  accepted: "tripDetail.status.accepted",
  driver_arriving: "tripDetail.status.driverArriving",
  driver_arrived: "tripDetail.status.driverArrived",
  in_progress: "tripDetail.status.inProgress",
  completed: "tripDetail.status.completed",
  cancelled: "tripDetail.status.cancelled",
};

const statusDescriptionKeys: Record<
  TripDetailStatus,
  string
> = {
  requested: "tripDetail.description.requested",
  searching: "tripDetail.description.searching",
  accepted: "tripDetail.description.accepted",
  driver_arriving: "tripDetail.description.driverArriving",
  driver_arrived: "tripDetail.description.driverArrived",
  in_progress: "tripDetail.description.inProgress",
  completed: "tripDetail.description.completed",
  cancelled: "tripDetail.description.cancelled",
};

const nextDriverAction: Partial<
  Record<
    TripDetailStatus,
    {
      status: TripDetailStatus;
      labelKey: string;
    }
  >
> = {
  accepted: {
    status: "driver_arriving",
    labelKey: "tripDetail.actions.onMyWay",
  },
  driver_arriving: {
    status: "driver_arrived",
    labelKey: "tripDetail.actions.arrived",
  },
  driver_arrived: {
    status: "in_progress",
    labelKey: "tripDetail.actions.startTrip",
  },
  in_progress: {
    status: "completed",
    labelKey: "tripDetail.actions.finishTrip",
  },
};

function formatCurrency(
  value: number | null,
  locale: "es" | "en"
) {
  if (value === null) {
    return locale === "es"
      ? "Por calcular"
      : "Pending";
  }

  return new Intl.NumberFormat(
    locale === "es" ? "es-MX" : "en-US",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  ).format(Math.round(value));
}

function formatDate(
  value: string,
  locale: "es" | "en"
) {
  return new Intl.DateTimeFormat(
    locale === "es" ? "es-MX" : "en-US",
    {
      dateStyle: "long",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(
    latitude2 - latitude1
  );

  const longitudeDifference = toRadians(
    longitude2 - longitude1
  );

  const firstLatitude = toRadians(latitude1);
  const secondLatitude = toRadians(latitude2);

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;
return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )
  );
}

function calculateArrivalMinutes(
  distanceKm: number
) {
  const averageCitySpeedKmH = 28;

  return Math.max(
    1,
    Math.ceil(
      (distanceKm / averageCitySpeedKmH) * 60
    )
  );
}

export default function ActiveTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [trip, setTrip] =
    useState<TripDetailData | null>(null);

  const [role, setRole] =
    useState<TripDetailRole | null>(null);

  const [passengerName, setPassengerName] =
    useState("");

  const [passengerPhone, setPassengerPhone] =
    useState<string | null>(null);

  const [driverPhone, setDriverPhone] =
    useState<string | null>(null);

  const [driverIdentity, setDriverIdentity] =
    useState<DriverIdentity | null>(null);

  const [driverLocation, setDriverLocation] =
    useState<TripDriverLocation | null>(null);

  const [locationConnected, setLocationConnected] =
    useState(false);

  
  const autoArrivalProcessingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] =
    useState(false);

  const [message, setMessage] = useState("");
  const [pinError, setPinError] = useState("");

  const [passengerTripPin, setPassengerTripPin] = useState<string | null>(null);

  const loadTrip = useCallback(async (currentRole?: TripDetailRole) => {
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

        trip_pin_verified_at,
        started_at,
        completed_at
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      setMessage(
        error?.message ??
          "No fue posible encontrar el viaje."
      );

      setLoading(false);
      return;
    }

    const loadedTrip =
      data as TripDetailData;

    setTrip(loadedTrip);

    if (currentRole === "passenger") {
      const { data: pinData, error: pinError } =
        await supabase.rpc(
          "get_passenger_trip_pin",
          {
            trip_id: loadedTrip.id,
          }
        );

  const [tripPin, setTripPin] =
    useState<string | null>(null);

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
        error?.message ??
          "No fue posible encontrar el viaje."
      );
      if (pinError) {
        console.error(
          "Error loading passenger trip PIN:",
          pinError.message
        );

        setPassengerTripPin(null);
      } else {
        setPassengerTripPin(
          typeof pinData === "string"
            ? pinData
            : null
        );
      }
    } else {
      setPassengerTripPin(null);
    }
    const userIds = [
      loadedTrip.passenger_id,
      loadedTrip.driver_id,
    ].filter(Boolean) as string[];

    let passenger:
      | ParticipantProfile
      | undefined;

    let driver:
      | ParticipantProfile
      | undefined;

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          avatar_url,
          rating
        `)
        .in("id", userIds);

      const resolvedProfiles =
        (profiles ?? []) as ParticipantProfile[];

      passenger = resolvedProfiles.find(
        (profile) =>
          profile.id === loadedTrip.passenger_id
      );

      driver = resolvedProfiles.find(
        (profile) =>
          profile.id === loadedTrip.driver_id
      );
    }

    setPassengerName(
      passenger?.full_name ||
        t(
          "tripDetail.participants.unnamedPassenger"
        )
    );

    setPassengerPhone(
      passenger?.phone ?? null
    );

    setDriverPhone(driver?.phone ?? null);

    if (loadedTrip.driver_id) {
      let vehicleData: VehicleData | null =
        null;

      if (loadedTrip.vehicle_id) {
        const { data: vehicle } =
          await supabase
            .from("vehicles")
            .select(`
              brand,
              model,
              color,
              plates,
              verified
            `)
            .eq("id", loadedTrip.vehicle_id)
            .maybeSingle();

        vehicleData =
          vehicle as VehicleData | null;
      }

      setDriverIdentity({
        name:
          driver?.full_name ||
          t(
            "tripDetail.participants.unnamedDriver"
          ),
        avatarUrl:
          driver?.avatar_url ?? null,
        rating:
          driver?.rating !== null &&
          driver?.rating !== undefined
            ? Number(driver.rating)
            : null,
        vehicleBrand:
          vehicleData?.brand ?? null,
        vehicleModel:
          vehicleData?.model ?? null,
        vehicleColor:
          vehicleData?.color ?? null,
        vehiclePlates:
          vehicleData?.plates ?? null,
        verified: Boolean(
          vehicleData?.verified
        ),
      });
    } else {
      setDriverIdentity(null);
      setDriverPhone(null);
    }

    setLoading(false);
  }, [id, t]);

  useEffect(() => {
    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        setMessage(
          t("tripDetail.errors.profile")
        );

        setLoading(false);
        return;
      }

      setRole(
        profile.role as TripDetailRole
      );

      await loadTrip(profile.role as TripDetailRole);

      channel = supabase
        .channel(
          `trip-${id}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trips",
            filter: `id=eq.${id}`,
          },
          () => {
            void loadTrip(role ?? undefined);
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
  }, [id, loadTrip, router, t]);

  useEffect(() => {
    if (!trip?.driver_id) {
      queueMicrotask(() => {
        setDriverLocation(null);
        setLocationConnected(false);
      });
      return;
    }

    let locationChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    const driverId = trip.driver_id;

    async function startLocationTracking() {
      const { data, error } = await supabase
        .from("driver_locations")
        .select(`
          driver_id,
          latitude,
          longitude,
          speed_kmh,
          heading,
          accuracy_meters,
          updated_at
        `)
        .eq("driver_id", driverId)
        .maybeSingle();

      if (error) {
        console.error(
          "Error loading driver location:",
          error.message
        );
      } else if (data) {
        setDriverLocation(
          data as TripDriverLocation
        );
      }

      locationChannel = supabase
        .channel(
          `driver-location-${driverId}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setDriverLocation(null);
              return;
            }

            setDriverLocation(
              payload.new as TripDriverLocation
            );
          }
        )
        .subscribe((status) => {
          setLocationConnected(
            status === "SUBSCRIBED"
          );
        });
    }

    void startLocationTracking();
return () => {
      if (locationChannel) {
        void supabase.removeChannel(
          locationChannel
        );
      }

      setLocationConnected(false);
    };
  }, [trip?.driver_id]);


  // AUTO DRIVER ARRIVAL
  useEffect(() => {
    if (
      role !== "driver" ||
      !trip ||
      trip.status !== "driver_arriving" ||
      !driverLocation ||
      trip.origin_lat === null ||
      trip.origin_lng === null
    ) {
      autoArrivalProcessingRef.current = false;
      return;
    }

    const accuracyMeters =
      driverLocation.accuracy_meters !== null &&
      driverLocation.accuracy_meters !== undefined
        ? Number(driverLocation.accuracy_meters)
        : null;

    if (
      accuracyMeters !== null &&
      accuracyMeters > 50
    ) {
      return;
    }

    const distanceToPickupKm =
      calculateDistanceKm(
        Number(driverLocation.latitude),
        Number(driverLocation.longitude),
        Number(trip.origin_lat),
        Number(trip.origin_lng)
      );

    const arrivalRadiusKm = 0.015;

    if (distanceToPickupKm > arrivalRadiusKm) {
      autoArrivalProcessingRef.current = false;
      return;
    }

    if (autoArrivalProcessingRef.current) {
      return;
    }

    autoArrivalProcessingRef.current = true;

    const currentTripId = trip.id;

    async function markDriverArrived() {
      const { error } = await supabase.rpc(
        "advance_trip_status",
        {
          trip_id: currentTripId,
          next_status: "driver_arrived",
        }
      );

      if (error) {
        console.error(
          "Error marking automatic arrival:",
          error.message
        );

        setMessage(
          `No fue posible registrar la llegada automática: ${error.message}`
        );

        autoArrivalProcessingRef.current = false;
        return;
      }

      setMessage(
        "Llegada detectada automáticamente. Solicita el PIN al pasajero."
      );

      await loadTrip("driver");
    }

    void start();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [id, loadTrip, router, t]);

  useEffect(() => {
    let cancelled = false;

    async function loadPassengerPin() {
      if (
        role !== "passenger" ||
        !trip ||
        ![
          "accepted",
          "driver_arriving",
          "driver_arrived",
        ].includes(trip.status)
      ) {
        setTripPin(null);
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_trip_security_pin",
        {
          p_trip_id: trip.id,
        }
      );

      if (cancelled) return;

      if (error) {
        console.error(
          "Error loading trip PIN:",
          error.message
        );
        setTripPin(null);
        return;
      }

      setTripPin(
        typeof data === "string" ? data : null
      );
    }

    void loadPassengerPin();

    return () => {
      cancelled = true;
    };
  }, [role, trip]);

  useEffect(() => {
    if (!trip?.driver_id) {
      queueMicrotask(() => {
        setDriverLocation(null);
        setLocationConnected(false);
      });
      return;
    }

    let locationChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    const driverId = trip.driver_id;

    async function startLocationTracking() {
      const { data, error } = await supabase
        .from("driver_locations")
        .select(`
          driver_id,
          latitude,
          longitude,
          speed_kmh,
          heading,
          accuracy_meters,
          updated_at
        `)
        .eq("driver_id", driverId)
        .maybeSingle();

      if (error) {
        console.error(
          "Error loading driver location:",
          error.message
        );
      } else if (data) {
        setDriverLocation(
          data as TripDriverLocation
        );
      }

      locationChannel = supabase
        .channel(
          `driver-location-${driverId}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setDriverLocation(null);
              return;
            }

            setDriverLocation(
              payload.new as TripDriverLocation
            );
          }
        )
        .subscribe((status) => {
          setLocationConnected(
            status === "SUBSCRIBED"
          );
        });
    }

    void startLocationTracking();

    return () => {
      if (locationChannel) {
        void supabase.removeChannel(
          locationChannel
        );
      }

      setLocationConnected(false);
    };
  }, [trip?.driver_id]);

  async function advanceStatus(
    nextStatus: TripDetailStatus
  ) {
    if (!trip) return;

    if (
      trip.status === "driver_arrived" &&
      nextStatus === "in_progress"
    ) {
      setMessage(
        "El viaje solo puede iniciar después de verificar el PIN del pasajero."
      );
      return;
    }

    const confirmed = window.confirm(
      `${t("tripDetail.confirmAction")} "${t(
        statusLabelKeys[nextStatus]
      )}"?`
    );

    if (!confirmed) return;

    void markDriverArrived();
  }, [
    role,
    trip,
    driverLocation,
    loadTrip,
  ]);
  async function advanceStatus(
    nextStatus: TripDetailStatus
  ) {
    if (!trip) return;

    const confirmed = window.confirm(
      `${t("tripDetail.confirmAction")} "${t(
        statusLabelKeys[nextStatus]
      )}"?`
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
      setMessage(
        `${t(
          "tripDetail.updateError"
        )}: ${error.message}`
      );
    } else {
      setMessage(
        t("tripDetail.updateSuccess")
      );

      await loadTrip(role ?? undefined);
    }

    setProcessing(false);
  }

  async function verifyTripPin(pin: string) {
    if (
      !trip ||
      trip.status !== "driver_arrived" ||
      processing
    ) {
      return;
    }

    setProcessing(true);
    setPinError("");
    setMessage("");

    const {
      data: pinVerified,
      error: verificationError,
    } = await supabase.rpc(
      "verify_trip_pin",
      {
        p_trip_id: trip.id,
        p_next_status: nextStatus,
        trip_id: trip.id,
        provided_pin: pin,
      }
    );

    if (verificationError) {
      console.error(
        "Error verifying trip PIN:",
        verificationError.message
      );

      setPinError(
        `No fue posible verificar el PIN: ${verificationError.message}`
      );

      setProcessing(false);
      return;
    }

    if (pinVerified !== true) {
      setPinError(
        "PIN incorrecto. Verifica el código con el pasajero."
      );

      setProcessing(false);
      return;
    }

    const { error: startError } =
      await supabase.rpc(
        "advance_trip_status",
        {
          trip_id: trip.id,
          next_status: "in_progress",
        }
      );

    if (startError) {
      console.error(
        "Error starting trip after PIN verification:",
        startError.message
      );

      setPinError(
        `El PIN fue correcto, pero no fue posible iniciar el viaje: ${startError.message}`
      );

      setProcessing(false);
      return;
    }

    setPinError("");
    setMessage(
      "PIN confirmado. El viaje ha iniciado."
    );

  const driverAction =
    nextDriverAction[trip.status];

  const isCompleted =
    trip.status === "completed";

  const isCancelled =
    trip.status === "cancelled";

  const displayPrice =
    trip.final_price ??
    trip.estimated_price;

  const driverDistanceKm =
    driverLocation &&
    trip.origin_lat !== null &&
    trip.origin_lng !== null
      ? calculateDistanceKm(
          Number(driverLocation.latitude),
          Number(driverLocation.longitude),
          Number(trip.origin_lat),
          Number(trip.origin_lng)
        )
      : null;

  const driverArrivalMinutes =
    driverDistanceKm !== null
      ? calculateArrivalMinutes(
          driverDistanceKm
        )
      : null;

  const heroTitle = isCancelled
    ? t("tripDetail.hero.cancelled")
    : isCompleted
      ? t("tripDetail.hero.completed")
      : role === "driver"
        ? "Servicio activo"
        : t("tripDetail.hero.active");

  return (
    <section className="space-y-8">
      <TripDetailHeader
        role={role}
        status={trip.status}
        requestedAt={formatDate(
          trip.requested_at,
          locale
        )}
        displayPrice={formatCurrency(
          displayPrice,
          locale
        )}
        statusLabel={t(
          statusLabelKeys[trip.status]
        )}
        title={heroTitle}
        description={t(
          statusDescriptionKeys[trip.status]
        )}
      />

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800">
          {message}
        </div>
      )}

      <TripProgress
        role={role}
        status={trip.status}
      />

      {role === "driver" ? (
        <DriverTripView
          trip={trip}
          passengerName={passengerName}
          passengerPhone={passengerPhone}
          estimatedPrice={formatCurrency(
            trip.estimated_price,
            locale
          )}
          statusLabel={t(
            statusLabelKeys[trip.status]
          )}
          nextStatus={
            driverAction?.status ?? null
          }
          actionLabel={
            driverAction
              ? t(driverAction.labelKey)
              : null
          }
          processing={processing}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          onAdvanceStatus={advanceStatus}
        />
      ) : (
        <PassengerTripView
          trip={trip}
          driverIdentity={driverIdentity}
          driverPhone={driverPhone}
          driverDistanceKm={driverDistanceKm}
          driverArrivalMinutes={
            driverArrivalMinutes
          }
          estimatedPrice={formatCurrency(
            trip.estimated_price,
            locale
          )}
          statusLabel={t(
            statusLabelKeys[trip.status]
          )}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
        />
      )}

      {trip.driver_id &&
        !isCompleted &&
        !isCancelled && (
          <div className="grid gap-6 xl:grid-cols-2">
            <TripPinCard
              pin={tripPin}
              visibleToPassenger={
                role === "passenger"
              }
            />

            <TripSafetyCard
              tripId={trip.id}
            />
          </div>
        )}

      {isCompleted && (
        <Card className="bg-yellow-400 text-black">
          <Star size={28} />

          <h2 className="mt-5 text-2xl font-black">
            {t("tripDetail.completed.title")}
          </h2>

          <p className="mt-2 text-sm font-medium leading-6 text-black/65">
            {t(
              "tripDetail.completed.description"
            )}
          </p>

          <div className="mt-6 flex gap-2">
            {[1, 2, 3, 4, 5].map(
              (star) => (
                <button
                  key={star}
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/10 transition hover:bg-black hover:text-yellow-400"
                >
                  <Star size={20} />
                </button>
              )
            )}
          </div>
        </Card>
      )}

      {isCancelled && (
        <Card className="border-red-200 bg-red-50">
          <Route
            size={27}
            className="text-red-600"
          />

          <h2 className="mt-5 text-2xl font-black text-red-800">
            {t("tripDetail.cancelled.title")}
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {t(
              "tripDetail.cancelled.description"
            )}
          </p>
        </Card>
      )}

      <span className="hidden">
        {locationConnected
          ? "GPS conectado"
          : "GPS desconectado"}
      </span>
    </section>
  );
}
    await loadTrip("driver");
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

  if (!trip || !role) {
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
            {message ||
              "No fue posible cargar la informaci├│n de este viaje."}
          </p>

          <Link
            href="/dashboard"
            className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </Link>
        </Card>
      </section>
    );
  }

  const driverAction =
    nextDriverAction[trip.status];

  const isCompleted =
    trip.status === "completed";

  const isCancelled =
    trip.status === "cancelled";

  const displayPrice =
    trip.final_price ??
    trip.estimated_price;

  const driverDistanceKm =
    driverLocation &&
    trip.origin_lat !== null &&
    trip.origin_lng !== null
      ? calculateDistanceKm(
          Number(driverLocation.latitude),
          Number(driverLocation.longitude),
          Number(trip.origin_lat),
          Number(trip.origin_lng)
        )
      : null;

  const driverArrivalMinutes =
    driverDistanceKm !== null
      ? calculateArrivalMinutes(
          driverDistanceKm
        )
      : null;

  const heroTitle = isCancelled
    ? t("tripDetail.hero.cancelled")
    : isCompleted
      ? t("tripDetail.hero.completed")
      : role === "driver"
        ? "Servicio activo"
        : t("tripDetail.hero.active");
return (
    <section className="space-y-8">
      <TripDetailHeader
        role={role}
        status={trip.status}
        requestedAt={formatDate(
          trip.requested_at,
          locale
        )}
        displayPrice={formatCurrency(
          displayPrice,
          locale
        )}
        statusLabel={t(
          statusLabelKeys[trip.status]
        )}
        title={heroTitle}
        description={t(
          statusDescriptionKeys[trip.status]
        )}
      />

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800">
          {message}
        </div>
      )}

      <TripProgress
        role={role}
        status={trip.status}
      />

      {role === "driver" ? (
        <DriverTripView
          trip={trip}
          passengerName={passengerName}
          passengerPhone={passengerPhone}
          estimatedPrice={formatCurrency(
            trip.estimated_price,
            locale
          )}
          statusLabel={t(
            statusLabelKeys[trip.status]
          )}
          nextStatus={
            driverAction?.status ?? null
          }
          actionLabel={
            driverAction
              ? t(driverAction.labelKey)
              : null
          }
          processing={processing}
          pinError={pinError}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          onAdvanceStatus={advanceStatus}
          onVerifyPin={verifyTripPin}
        />
      ) : (
        <PassengerTripView
          trip={trip}
          driverIdentity={driverIdentity}
          driverPhone={driverPhone}
          driverDistanceKm={driverDistanceKm}
          driverArrivalMinutes={
            driverArrivalMinutes
          }
          estimatedPrice={formatCurrency(
            trip.estimated_price,
            locale
          )}
          statusLabel={t(
            statusLabelKeys[trip.status]
          )}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
        />
      )}

      {trip.driver_id &&
        !isCompleted &&
        !isCancelled && (
          <div className="grid gap-6 xl:grid-cols-2">
            <TripPinCard
              pin={passengerTripPin}
              visibleToPassenger={
                role === "passenger"
              }
            />

            <TripSafetyCard
              tripId={trip.id}
            />
          </div>
        )}

      {isCompleted && (
        <Card className="bg-yellow-400 text-black">
          <Star size={28} />

          <h2 className="mt-5 text-2xl font-black">
            {t("tripDetail.completed.title")}
          </h2>

          <p className="mt-2 text-sm font-medium leading-6 text-black/65">
            {t(
              "tripDetail.completed.description"
            )}
          </p>

          <div className="mt-6 flex gap-2">
            {[1, 2, 3, 4, 5].map(
              (star) => (
                <button
                  key={star}
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/10 transition hover:bg-black hover:text-yellow-400"
                >
                  <Star size={20} />
                </button>
              )
            )}
          </div>
        </Card>
      )}

      {isCancelled && (
        <Card className="border-red-200 bg-red-50">
          <Route
            size={27}
            className="text-red-600"
          />

          <h2 className="mt-5 text-2xl font-black text-red-800">
            {t("tripDetail.cancelled.title")}
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {t(
              "tripDetail.cancelled.description"
            )}
          </p>
        </Card>
      )}

      <span className="hidden">
        {locationConnected
          ? "GPS conectado"
          : "GPS desconectado"}
      </span>
    </section>
  );
}




















