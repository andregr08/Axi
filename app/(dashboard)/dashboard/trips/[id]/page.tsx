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
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

type UserRole = "admin" | "driver" | "passenger";

type DriverLocation = {
  driver_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading: number | null;
  accuracy_meters: number | null;
  updated_at: string;
};

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

const statusLabelKeys: Record<TripStatus, string> = {
  requested: "tripDetail.status.requested",
  searching: "tripDetail.status.searching",
  accepted: "tripDetail.status.accepted",
  driver_arriving: "tripDetail.status.driverArriving",
  driver_arrived: "tripDetail.status.driverArrived",
  in_progress: "tripDetail.status.inProgress",
  completed: "tripDetail.status.completed",
  cancelled: "tripDetail.status.cancelled",
};

const statusDescriptionKeys: Record<TripStatus, string> = {
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
    TripStatus,
    {
      status: TripStatus;
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

const progressSteps: Array<{
  status: TripStatus;
  labelKey: string;
}> = [
  {
    status: "accepted",
    labelKey: "tripDetail.progress.accepted",
  },
  {
    status: "driver_arriving",
    labelKey: "tripDetail.progress.onTheWay",
  },
  {
    status: "driver_arrived",
    labelKey: "tripDetail.progress.arrived",
  },
  {
    status: "in_progress",
    labelKey: "tripDetail.progress.inProgress",
  },
  {
    status: "completed",
    labelKey: "tripDetail.progress.completed",
  },
];

function formatCurrency(
  value: number | null,
  locale: "es" | "en"
) {
  if (value === null) {
    return locale === "es" ? "Por calcular" : "Pending";
  }

  return new Intl.NumberFormat(
    locale === "es" ? "es-MX" : "en-US",
    {
      style: "currency",
      currency: "MXN",
    }
  ).format(value);
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
  const { t, locale } = useLanguage();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverIdentity, setDriverIdentity] =
    useState<DriverIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const [driverLocation, setDriverLocation] =
    useState<DriverLocation | null>(null);

  const [locationConnected, setLocationConnected] =
    useState(false);

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
        `${t("tripDetail.errors.loadTrip")}: ${
          error?.message ?? t("tripDetail.errors.notFound")
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
        passenger?.full_name || t("tripDetail.participants.unnamedPassenger")
      );

      const resolvedDriverName =
        loadedTrip.driver_id
          ? driver?.full_name || t("tripDetail.participants.unnamedDriver")
          : t("tripDetail.participants.unassigned");

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
        setMessage(t("tripDetail.errors.profile"));
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
    if (!trip?.driver_id) {
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
          data as DriverLocation
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
            if (
              payload.eventType === "DELETE"
            ) {
              setDriverLocation(null);
              return;
            }

            setDriverLocation(
              payload.new as DriverLocation
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

  async function advanceStatus(nextStatus: TripStatus) {
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
      setMessage(`${t("tripDetail.updateError")}: ${error.message}`);
    } else {
      setMessage(t("tripDetail.updateSuccess"));
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
            {t("tripDetail.notAvailable.title")}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            {message || t("tripDetail.notAvailable.description")}
          </p>

          <Link
            href="/dashboard/trips"
            className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <ArrowLeft size={18} />
            {t("tripDetail.backToTrips")}
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
          {t("tripDetail.backToTrips")}
        </Link>

        <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <CalendarDays size={16} />
          {formatDate(trip.requested_at, locale)}
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
              {t(statusLabelKeys[trip.status])}
            </Badge>

            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              {isCancelled
                ? t("tripDetail.hero.cancelled")
                : isCompleted
                  ? t("tripDetail.hero.completed")
                  : t("tripDetail.hero.active")}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {t(statusDescriptionKeys[trip.status])}
            </p>
          </div>

          <div className="min-w-64 rounded-3xl border border-white/10 bg-white/10 px-6 py-5 backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
              {t("tripDetail.price.title")}
            </p>

            <p className="mt-2 text-4xl font-black">
              {formatCurrency(displayPrice, locale)}
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
                {t("tripDetail.tracking.eyebrow")}
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {t("tripDetail.tracking.title")}
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
                    {t(step.labelKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
                <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    {locationConnected && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    )}

                    <span
                      className={cn(
                        "relative inline-flex h-3 w-3 rounded-full",
                        locationConnected
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      )}
                    />
                  </span>

                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {t("tripDetail.gps.eyebrow")}
                  </p>
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  {t("tripDetail.gps.title")}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {trip.driver_id
                    ? locationConnected
                      ? t("tripDetail.gps.receivingUpdates")
                      : t("tripDetail.gps.connecting")
                    : t("tripDetail.gps.noDriverAssigned")}
                </p>
              </div>

              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl",
                  driverLocation
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                <Navigation size={25} />
              </span>
            </div>

            {driverLocation ? (
              <>
                <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <LocationValue
                    label={t("tripDetail.gps.latitude")}
                    value={Number(
                      driverLocation.latitude
                    ).toFixed(6)}
                  />

                  <LocationValue
                    label={t("tripDetail.gps.longitude")}
                    value={Number(
                      driverLocation.longitude
                    ).toFixed(6)}
                  />

                  <LocationValue
                    label={t("tripDetail.gps.speed")}
                    value={
                      driverLocation.speed_kmh !== null
                        ? `${Math.round(
                            Number(driverLocation.speed_kmh)
                          )} km/h`
                        : t("tripDetail.gps.notMoving")
                    }
                  />

                  <LocationValue
                    label={t("tripDetail.gps.heading")}
                    value={
                      driverLocation.heading !== null
                        ? `${Math.round(
                            Number(driverLocation.heading)
                          )}\u00B0`
                        : t("tripDetail.gps.notAvailable")
                    }
                  />

                  <LocationValue
                    label={t("tripDetail.gps.accuracy")}
                    value={
                      driverLocation.accuracy_meters !== null
                        ? `${Math.round(
                            Number(
                              driverLocation.accuracy_meters
                            )
                          )} m`
                        : t("tripDetail.gps.notAvailable")
                    }
                  />

                  <LocationValue
                    label={t("tripDetail.gps.lastUpdate")}
                    value={new Intl.DateTimeFormat(
                      locale === "es" ? "es-MX" : "en-US",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }
                    ).format(
                      new Date(
                        driverLocation.updated_at
                      )
                    )}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {t("tripDetail.gps.sharingLocation")}
                </div>
              </>
            ) : (
              <div className="mt-7 flex min-h-48 items-center justify-center rounded-3xl bg-slate-50 px-6 text-center">
                <div>
                  <MapPin
                    size={34}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-4 font-black text-slate-700">
                    {t("tripDetail.gps.locationUnavailable")}
                  </p>

                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {t("tripDetail.gps.permissionRequired")}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <GoogleMapView />
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">
                {t("tripDetail.route.title")}
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
                    {t("tripDetail.route.pickup")}
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {trip.origin_address}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {t("tripDetail.route.destination")}
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
                  {t("tripDetail.route.estimated")}
                </p>

                <p className="mt-1 font-black">
                  {formatCurrency(trip.estimated_price, locale)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <Clock3 size={20} className="text-blue-600" />

                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t("tripDetail.route.status")}
                </p>

                <p className="mt-1 font-black">
                  {t(statusLabelKeys[trip.status])}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">
                {t("tripDetail.participants.title")}
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
                    {t("tripDetail.participants.passenger")}
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
                    {t("tripDetail.participants.driver")}
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
                    {t("tripDetail.safety.title")}
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {t("tripDetail.safety.immediateHelp")}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {t("tripDetail.safety.instructions")}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <SOSButton tripId={trip.id} />
              </div>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                {t("tripDetail.safety.alertInfo")}
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
                      {t("tripDetail.driverActions.eyebrow")}
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      {t("tripDetail.driverActions.title")}
                    </h2>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-400">
                  {t("tripDetail.driverActions.description")}
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
                    ? t("tripDetail.driverActions.updating")
                    : t(driverAction.labelKey)}

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
                      {t("tripDetail.participants.driver")} AXI
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      {t("tripDetail.searchingDriver.title")}
                    </h2>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-400">
                  {t("tripDetail.searchingDriver.description")}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-slate-500"
                  >
                    <Phone size={17} />
                    {t("tripDetail.searchingDriver.call")}
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-slate-500"
                  >
                    <ShieldCheck size={17} />
                    {t("tripDetail.searchingDriver.safety")}
                  </button>
                </div>
              </Card>
            )}

          {isCompleted && (
            <Card className="bg-yellow-400 text-black">
              <Star size={28} />

              <h2 className="mt-5 text-2xl font-black">
                {t("tripDetail.completed.title")}
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-black/65">
                {t("tripDetail.completed.description")}
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
                {t("tripDetail.cancelled.title")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {t("tripDetail.cancelled.description")}
              </p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

function LocationValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-2 break-words font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}
