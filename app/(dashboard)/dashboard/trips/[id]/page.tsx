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
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  CircleDollarSign,
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  Star,
  TimerReset,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  GoogleMapView,
  type MapCoordinates,
  type RouteMetrics,
} from "@/components/maps/GoogleMap";
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
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
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
  const [driverIdentity, setDriverIdentity] =
    useState<DriverIdentity | null>(null);

  const [driverLocation, setDriverLocation] =
    useState<MapCoordinates | null>(null);

  const [routeMetrics, setRouteMetrics] =
    useState<RouteMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [dispatchRound, setDispatchRound] = useState(1);
  const [dispatchRadius, setDispatchRadius] = useState(3);
  const dispatchProcessingRef = useRef(false);

  const tripLocationWatchId =
    useRef<number | null>(null);

  const lastTripLocationUpdate =
    useRef(0);

  const [message, setMessage] = useState("");
  const [tripPin, setTripPin] =
    useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [verifyingPin, setVerifyingPin] =
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
        .select("id, full_name, avatar_url, rating")
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

      const resolvedDriverName =
        loadedTrip.driver_id
          ? driver?.full_name || "Conductor sin nombre"
          : "Sin asignar";

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

    if (loadedTrip.driver_id) {
      const {
        data: locationData,
        error: locationError,
      } = await supabase
        .from("driver_locations")
        .select(
          "latitude, longitude, updated_at"
        )
        .eq(
          "driver_id",
          loadedTrip.driver_id
        )
        .maybeSingle();

      if (
        !locationError &&
        locationData?.latitude !== null &&
        locationData?.latitude !== undefined &&
        locationData?.longitude !== null &&
        locationData?.longitude !== undefined
      ) {
        setDriverLocation({
          lat: Number(
            locationData.latitude
          ),
          lng: Number(
            locationData.longitude
          ),
        });
      } else {
        setDriverLocation(null);
      }
    } else {
      setDriverLocation(null);
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

  useEffect(() => {
    async function loadSecurityPin() {
      const passengerCanSeePin =
        role === "passenger" &&
        Boolean(trip?.driver_id) &&
        trip !== null &&
        [
          "accepted",
          "driver_arriving",
          "driver_arrived",
        ].includes(trip.status);

      if (!passengerCanSeePin || !trip) {
        setTripPin(null);
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_trip_security_pin",
        {
          p_trip_id: trip.id,
        }
      );

      if (error) {
        console.error(
          "Error cargando PIN del viaje:",
          error.message
        );
        setTripPin(null);
        return;
      }

      setTripPin(
        typeof data === "string"
          ? data
          : null
      );
    }

    void loadSecurityPin();
  }, [
    role,
    trip?.id,
    trip?.driver_id,
    trip?.status,
  ]);

  useEffect(() => {
    const driverId = trip?.driver_id;

    if (!driverId) {
      setDriverLocation(null);
      return;
    }

    const channel = supabase
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
          const location =
            payload.new as {
              driver_id?: string;
              latitude?: number | null;
              longitude?: number | null;
              updated_at?: string;
            };

          if (
            location.latitude !== null &&
            location.latitude !== undefined &&
            location.longitude !== null &&
            location.longitude !== undefined
          ) {
            setDriverLocation({
              lat: Number(location.latitude),
              lng: Number(location.longitude),
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [trip?.driver_id]);


  useEffect(() => {
    const activeStatuses: TripStatus[] = [
      "accepted",
      "driver_arriving",
      "driver_arrived",
      "in_progress",
    ];

    const shouldTrack =
      role === "driver" &&
      trip?.driver_id !== null &&
      activeStatuses.includes(
        trip?.status as TripStatus
      );

    if (
      !shouldTrack ||
      !navigator.geolocation
    ) {
      if (
        tripLocationWatchId.current !== null
      ) {
        navigator.geolocation.clearWatch(
          tripLocationWatchId.current
        );

        tripLocationWatchId.current = null;
      }

      return;
    }

    tripLocationWatchId.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const now = Date.now();

          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });

          if (
            now -
              lastTripLocationUpdate.current <
            5000
          ) {
            return;
          }

          lastTripLocationUpdate.current = now;

          void supabase
            .rpc(
              "update_driver_location",
              {
                latitude_value:
                  position.coords.latitude,
                longitude_value:
                  position.coords.longitude,
                speed_value:
                  position.coords.speed,
                heading_value:
                  position.coords.heading,
                accuracy_value:
                  position.coords.accuracy,
              }
            )
            .then(({ error }) => {
              if (error) {
                console.error(
                  "Error actualizando GPS del viaje:",
                  error.message
                );
              }
            });
        },
        (error) => {
          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            setMessage(
              "Debes permitir el acceso al GPS para compartir tu ubicación durante el viaje."
            );
          } else {
            console.error(
              "Error obteniendo GPS del viaje:",
              error.message
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 3000,
        }
      );

    return () => {
      if (
        tripLocationWatchId.current !== null
      ) {
        navigator.geolocation.clearWatch(
          tripLocationWatchId.current
        );

        tripLocationWatchId.current = null;
      }
    };
  }, [
    role,
    trip?.driver_id,
    trip?.status,
  ]);

  useEffect(() => {
    const searching =
      trip?.status === "requested" ||
      trip?.status === "searching";

    if (!searching) {
      setSearchSeconds(0);
      return;
    }

    const requestedAt = trip?.requested_at
      ? new Date(trip.requested_at).getTime()
      : Date.now();

    const updateElapsedTime = () => {
      const elapsed = Math.max(
        0,
        Math.floor(
          (Date.now() - requestedAt) / 1000
        )
      );

      setSearchSeconds(elapsed);
    };

    updateElapsedTime();

    const timer = window.setInterval(
      updateElapsedTime,
      1000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [trip?.requested_at, trip?.status]);

  useEffect(() => {
    const searching =
      trip?.status === "requested" ||
      trip?.status === "searching";

    if (
      !trip ||
      !searching ||
      role !== "passenger"
    ) {
      return;
    }

    const tripId = trip.id;
    let cancelled = false;

    async function processDispatchRound() {
      if (
        cancelled ||
        dispatchProcessingRef.current
      ) {
        return;
      }

      dispatchProcessingRef.current = true;

      const {
        data,
        error,
      } = await supabase.rpc(
        "process_trip_dispatch",
        {
          requested_trip_id: tripId,
        }
      );

      dispatchProcessingRef.current = false;

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Error procesando despacho:",
          error
        );
        return;
      }

      const result = data as {
        status?: string;
        round?: number;
        radius_km?: number;
        notified_drivers?: number;
      } | null;

      if (
        typeof result?.round === "number"
      ) {
        setDispatchRound(result.round);
      }

      if (
        typeof result?.radius_km === "number"
      ) {
        setDispatchRadius(
          Number(result.radius_km)
        );
      }

      if (result?.status === "completed") {
        await loadTrip();
      }
    }

    void processDispatchRound();

    const dispatchTimer = window.setInterval(
      () => {
        void processDispatchRound();
      },
      8000
    );

    return () => {
      cancelled = true;
      window.clearInterval(dispatchTimer);
    };
  }, [
    loadTrip,
    role,
    trip,
  ]);

  async function cancelCurrentTrip() {
    if (!trip) return;

    const estimatedFee =
      trip.status === "driver_arrived"
        ? 40
        : ["accepted", "driver_arriving"].includes(trip.status)
          ? 20
          : 0;

    const feeMessage =
      estimatedFee > 0
        ? ` Se aplicará una penalización estimada de ${formatCurrency(
            estimatedFee
          )}.`
        : " No se aplicará penalización.";

    const confirmed = window.confirm(
      `¿Seguro que quieres cancelar este viaje?${feeMessage}`
    );

    if (!confirmed) return;

    const cancellationReason = window.prompt(
      "Indica brevemente el motivo de la cancelación:",
      "Ya no necesito el viaje"
    );

    if (cancellationReason === null) return;

    const normalizedReason = cancellationReason.trim();

    if (normalizedReason.length < 5) {
      setMessage(
        "El motivo de cancelación debe tener al menos 5 caracteres."
      );
      return;
    }

    setCancelling(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "passenger_cancel_trip",
      {
        requested_trip_id: trip.id,
        cancellation_reason_value: normalizedReason,
      }
    );

    if (error) {
      setMessage(
        `No fue posible cancelar el viaje: ${error.message}`
      );
      setCancelling(false);
      return;
    }

    const cancellationFee = Number(data ?? 0);

    setMessage(
      cancellationFee > 0
        ? `Viaje cancelado correctamente. Penalización aplicada: ${formatCurrency(
            cancellationFee
          )}.`
        : "El viaje fue cancelado correctamente sin penalización."
    );

    setCancelling(false);
    await loadTrip();
  }

  function openExternalNavigation(
    provider: "google" | "apple",
    target: {
      latitude: number | null;
      longitude: number | null;
      address: string;
    }
  ) {
    const destination =
      target.latitude !== null &&
      target.longitude !== null
        ? `${target.latitude},${target.longitude}`
        : target.address;

    const encodedDestination =
      encodeURIComponent(destination);

    const url =
      provider === "google"
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`
        : `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function activateTripSos() {
    if (!trip) {
      throw new Error("No se encontró el viaje activo.");
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (navigator.geolocation) {
      try {
        const position =
          await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0,
                }
              );
            }
          );

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        latitude = null;
        longitude = null;
      }
    }

    const { error } = await supabase.rpc(
      "activate_sos",
      {
        related_trip_id: trip.id,
        latitude_value: latitude,
        longitude_value: longitude,
        message_value:
          "Alerta activada durante un viaje desde el botón SOS.",
      }
    );

    if (error) {
      throw new Error(
        `No fue posible activar SOS: ${error.message}`
      );
    }

    setMessage(
      latitude !== null && longitude !== null
        ? "Alerta SOS activada. AXI recibió tu ubicación actual."
        : "Alerta SOS activada. No fue posible incluir tu ubicación."
    );
  }

  async function cancelDriverAndReassignTrip() {
    if (!trip) return;

    const confirmed = window.confirm(
      "¿Seguro que quieres cancelar este viaje? AXI buscará automáticamente otro conductor para el pasajero."
    );

    if (!confirmed) return;

    const cancellationReason = window.prompt(
      "Indica brevemente el motivo de la cancelación:",
      "No puedo continuar con el viaje"
    );

    if (cancellationReason === null) return;

    setCancelling(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "cancel_driver_and_reassign_trip",
      {
        requested_trip_id: trip.id,
        cancellation_reason_value:
          cancellationReason.trim() ||
          "Cancelado por el conductor",
      }
    );

    if (error) {
      setMessage(
        `No fue posible cancelar y reasignar el viaje: ${error.message}`
      );
      setCancelling(false);
      return;
    }

    const result = data as {
      status?: string;
      dispatch?: {
        notified_drivers?: number;
      };
    } | null;

    const notifiedDrivers =
      result?.dispatch?.notified_drivers ?? 0;

    setMessage(
      notifiedDrivers > 0
        ? `Viaje cancelado. AXI notificó a ${notifiedDrivers} conductor${
            notifiedDrivers === 1 ? "" : "es"
          } cercano${notifiedDrivers === 1 ? "" : "s"}.`
        : "Viaje cancelado. AXI ya está buscando otro conductor para el pasajero."
    );

    setCancelling(false);
    await loadTrip();
    router.push("/dashboard/driver/available-trips");
  }

  async function verifyPinAndStartTrip() {
    if (!trip) return;

    const normalizedPin =
      pinInput.replace(/\D/g, "").slice(0, 4);

    if (normalizedPin.length !== 4) {
      setMessage(
        "Ingresa los 4 dígitos del PIN del pasajero."
      );
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que el pasajero está dentro del vehículo y deseas iniciar el viaje?"
    );

    if (!confirmed) return;

    setVerifyingPin(true);
    setProcessing(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "verify_trip_pin_and_start",
      {
        p_trip_id: trip.id,
        p_security_pin: normalizedPin,
      }
    );

    if (error) {
      setMessage(
        `No fue posible iniciar el viaje: ${error.message}`
      );
      setVerifyingPin(false);
      setProcessing(false);
      return;
    }

    setPinInput("");
    setMessage(
      "PIN correcto. El viaje comenzó correctamente."
    );

    await loadTrip();

    setVerifyingPin(false);
    setProcessing(false);
  }

  async function advanceStatus(nextStatus: TripStatus) {
    if (!trip) return;

    if (nextStatus === "in_progress") {
      await verifyPinAndStartTrip();
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas la acción "${statusLabels[nextStatus]}"?`
    );

    if (!confirmed) return;

    setProcessing(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "advance_trip_status",
      {
        p_trip_id: trip.id,
        p_next_status: nextStatus,
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
  const isSearching =
    trip.status === "requested" ||
    trip.status === "searching";

  const searchMinutes = Math.floor(searchSeconds / 60);
  const searchRemainingSeconds = searchSeconds % 60;

  const searchTimeLabel =
    `${searchMinutes.toString().padStart(2, "0")}:` +
    `${searchRemainingSeconds.toString().padStart(2, "0")}`;

  const navigationToOrigin =
    trip.status === "accepted" ||
    trip.status === "driver_arriving" ||
    trip.status === "driver_arrived";

  const navigationToDestination =
    trip.status === "in_progress";

  const navigationTarget = navigationToOrigin
    ? {
        latitude: trip.origin_lat,
        longitude: trip.origin_lng,
        address: trip.origin_address,
        label: "Ir por el pasajero",
        description:
          "Abre la navegación hacia el punto de recogida.",
      }
    : navigationToDestination
      ? {
          latitude: trip.destination_lat,
          longitude: trip.destination_lng,
          address: trip.destination_address,
          label: "Ir al destino",
          description:
            "Abre la navegación hacia el destino final.",
        }
      : null;

  const displayPrice =
    trip.final_price ?? trip.estimated_price;

  const originCoordinates:
    MapCoordinates | null =
    trip.origin_lat !== null &&
    trip.origin_lng !== null
      ? {
          lat: Number(trip.origin_lat),
          lng: Number(trip.origin_lng),
        }
      : null;

  const destinationCoordinates:
    MapCoordinates | null =
    trip.destination_lat !== null &&
    trip.destination_lng !== null
      ? {
          lat: Number(
            trip.destination_lat
          ),
          lng: Number(
            trip.destination_lng
          ),
        }
      : null;

  const trackingToOrigin =
    trip.status === "accepted" ||
    trip.status === "driver_arriving" ||
    trip.status === "driver_arrived";

  const trackingToDestination =
    trip.status === "in_progress";

  const activeRouteOrigin =
    (trackingToOrigin ||
      trackingToDestination) &&
    driverLocation
      ? driverLocation
      : originCoordinates;

  const activeRouteDestination =
    trackingToOrigin
      ? originCoordinates
      : destinationCoordinates;

  const activeRouteLabel =
    trackingToOrigin
      ? "Conductor hacia el pasajero"
      : trackingToDestination
        ? "Camino al destino"
        : "Ruta del viaje";

  const trackingDescription =
    trackingToOrigin
      ? "El conductor se dirige al punto de recogida."
      : trackingToDestination
        ? "El vehículo avanza hacia el destino final."
        : isCompleted
          ? "Recorrido final del viaje."
          : "Ruta programada del viaje.";

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

      {isSearching && (
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.1)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden bg-[#0B0F19] p-8">
              <div className="absolute h-72 w-72 animate-ping rounded-full border border-yellow-400/20" />
              <div className="absolute h-56 w-56 animate-pulse rounded-full border border-yellow-400/30" />
              <div className="absolute h-40 w-40 rounded-full border border-yellow-400/40" />

              <div className="absolute left-[18%] top-[22%] flex h-11 w-11 animate-bounce items-center justify-center rounded-2xl bg-white text-slate-950 shadow-xl">
                <CarFront size={20} />
              </div>

              <div className="absolute bottom-[20%] right-[16%] flex h-11 w-11 animate-pulse items-center justify-center rounded-2xl bg-white text-slate-950 shadow-xl">
                <CarFront size={20} />
              </div>

              <div className="absolute right-[22%] top-[18%] flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-slate-950 shadow-xl">
                <CarFront size={18} />
              </div>

              <div className="relative z-10 text-center">
                <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-yellow-400 text-black shadow-[0_0_60px_rgba(250,204,21,0.45)]">
                  <Radio size={38} className="animate-pulse" />
                </span>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                  Red AXI activa
                </p>

                <h2 className="mt-2 text-3xl font-black text-white">
                  Buscando taxista
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Revisando conductores disponibles cerca de ti.
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                    Solicitud enviada
                  </p>

                  <h2 className="mt-2 text-3xl font-black text-slate-950">
                    Encontraremos tu taxi
                  </h2>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-white">
                  <TimerReset size={21} className="text-yellow-400" />

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Tiempo buscando
                    </p>

                    <p className="mt-1 text-xl font-black">
                      {searchTimeLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <SearchStep
                  completed
                  title="Solicitud recibida"
                  description="AXI registró correctamente tu viaje."
                />

                <SearchStep
                  completed={searchSeconds >= 3}
                  title="Buscando conductores cercanos"
                  description="Estamos consultando taxistas disponibles."
                />

                <SearchStep
                  completed={dispatchRound >= 2}
                  active={dispatchRound >= 2}
                  title="Ampliando zona de búsqueda"
                  description={`Ronda ${dispatchRound}: buscando conductores en un radio de ${dispatchRadius} km.`}
                />
              </div>

              <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <RefreshCw
                    size={18}
                    className="mt-0.5 shrink-0 animate-spin text-blue-600"
                  />

                  <p className="text-xs leading-6 text-blue-800">
                    No cierres esta pantalla. La información se actualizará
                    automáticamente cuando un conductor acepte.
                  </p>
                </div>
              </div>

              {role === "passenger" && (
                <button
                  type="button"
                  onClick={cancelCurrentTrip}
                  disabled={cancelling}
                  className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle size={19} />

                  {cancelling
                    ? "Cancelando solicitud..."
                    : "Cancelar solicitud"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {!isCancelled && !isSearching && (
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

      {!isSearching && (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="relative min-w-0">
            <GoogleMapView
              origin={originCoordinates}
              destination={
                destinationCoordinates
              }
              driverLocation={
                driverLocation
              }
              routeOrigin={
                activeRouteOrigin
              }
              routeDestination={
                activeRouteDestination
              }
              routeLabel={
                activeRouteLabel
              }
              onRouteMetricsChange={
                setRouteMetrics
              }
              showUserLocation={false}
              showRoute
              heightClassName="h-[680px]"
            />

            {trip.driver_id &&
              driverIdentity &&
              !isCancelled && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 sm:inset-x-5 sm:bottom-5">
                  <div className="pointer-events-auto overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_25px_80px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
                    <div className="h-1.5 bg-yellow-400" />

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          {driverIdentity.avatarUrl ? (
                            <img
                              src={
                                driverIdentity.avatarUrl
                              }
                              alt={
                                driverIdentity.name
                              }
                              className="h-16 w-16 rounded-2xl object-cover shadow-lg"
                            />
                          ) : (
                            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-yellow-400 shadow-lg">
                              {driverIdentity.name
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}

                          {driverLocation && (
                            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-emerald-500">
                              <span className="h-2 w-2 rounded-full bg-white" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-700">
                                Tu conductor
                              </p>

                              <h2 className="mt-1 truncate text-xl font-black text-slate-950">
                                {driverIdentity.name}
                              </h2>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                                {driverIdentity.rating !==
                                  null && (
                                  <span className="inline-flex items-center gap-1 text-slate-700">
                                    <Star
                                      size={14}
                                      className="fill-yellow-400 text-yellow-400"
                                    />
                                    {driverIdentity.rating.toFixed(
                                      1
                                    )}
                                  </span>
                                )}

                                {driverIdentity.verified && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700">
                                    <ShieldCheck
                                      size={14}
                                    />
                                    Verificado
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 rounded-2xl bg-slate-950 px-3 py-2 text-right text-white shadow-lg">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Llegada
                              </p>

                              <p className="mt-0.5 text-sm font-black text-yellow-400">
                                {routeMetrics?.durationText ??
                                  "Calculando"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                              <CarFront size={19} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-slate-950">
                                {[
                                  driverIdentity.vehicleColor,
                                  driverIdentity.vehicleBrand,
                                  driverIdentity.vehicleModel,
                                ]
                                  .filter(Boolean)
                                  .join(" ") ||
                                  "Vehículo AXI"}
                              </p>

                              <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {driverIdentity.vehiclePlates
                                  ? `Placas ${driverIdentity.vehiclePlates}`
                                  : "Placas por confirmar"}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Distancia
                              </p>

                              <p className="mt-0.5 text-sm font-black text-slate-950">
                                {routeMetrics?.distanceText ??
                                  "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <Link
                          href={`/dashboard/trips/${trip.id}/chat`}
                          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-3 text-sm font-black text-black transition hover:bg-yellow-300"
                        >
                          <MessageCircle size={18} />
                          <span className="hidden sm:inline">
                            Chat
                          </span>
                        </Link>

                        <button
                          type="button"
                          disabled
                          title="La llamada protegida se habilitará al integrar el proveedor telefónico."
                          className="flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-sm font-black text-slate-400"
                        >
                          <Phone size={18} />
                          <span className="hidden sm:inline">
                            Llamar
                          </span>
                        </button>

                        <a
                          href="#trip-security-pin"
                          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800"
                        >
                          <ShieldCheck size={18} />
                          <span className="hidden sm:inline">
                            PIN
                          </span>
                        </a>
                      </div>

                      {role === "passenger" &&
                        [
                          "accepted",
                          "driver_arriving",
                          "driver_arrived",
                        ].includes(
                          trip.status
                        ) && (
                          <button
                            type="button"
                            onClick={
                              cancelCurrentTrip
                            }
                            disabled={cancelling}
                            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
                          >
                            <XCircle size={16} />

                            {cancelling
                              ? "Cancelando..."
                              : "Cancelar viaje"}
                          </button>
                        )}

                      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                        <span className="relative flex h-2.5 w-2.5">
                          {driverLocation && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          )}

                          <span
                            className={cn(
                              "relative inline-flex h-2.5 w-2.5 rounded-full",
                              driverLocation
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            )}
                          />
                        </span>

                        {driverLocation
                          ? "Ubicación del conductor actualizándose en vivo"
                          : "Esperando ubicación del conductor"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>

        <div className="space-y-6">
          {!isCancelled && (
            <Card className="overflow-hidden border-yellow-200 bg-[linear-gradient(135deg,#fffbeb,#ffffff)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      {(trackingToOrigin ||
                        trackingToDestination) && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      )}

                      <span
                        className={cn(
                          "relative inline-flex h-3 w-3 rounded-full",
                          trackingToOrigin ||
                            trackingToDestination
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                        )}
                      />
                    </span>

                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-700">
                      Seguimiento en vivo
                    </p>
                  </div>

                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    {activeRouteLabel}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {trackingDescription}
                  </p>
                </div>

                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
                  <Navigation size={22} />
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm">
                  <Route
                    size={20}
                    className="text-blue-600"
                  />

                  <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Distancia restante
                  </p>

                  <p className="mt-1 text-xl font-black text-slate-950">
                    {routeMetrics?.distanceText ??
                      "Calculando..."}
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm">
                  <Clock3
                    size={20}
                    className="text-emerald-600"
                  />

                  <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Tiempo estimado
                  </p>

                  <p className="mt-1 text-xl font-black text-slate-950">
                    {routeMetrics?.durationText ??
                      "Calculando..."}
                  </p>
                </div>
              </div>

              {!driverLocation &&
                !isCompleted && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold leading-5 text-amber-800">
                      Esperando la ubicación actual del conductor para calcular el recorrido en vivo.
                    </p>
                  </div>
                )}
            </Card>
          )}

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

          {driverIdentity &&
            !isCompleted &&
            !isCancelled && (
              <DriverIdentityCard driver={driverIdentity} />
            )}

          {trip.driver_id &&
            !isCompleted &&
            !isCancelled && (
              <div id="trip-security-pin">
                <TripPinCard
                  pin={tripPin}
                  visibleToPassenger={
                    role === "passenger"
                  }
                />
              </div>
            )}

          {trip.driver_id &&
            !isCompleted &&
            !isCancelled && (
              <Card className="overflow-hidden border-slate-200">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
                    <MessageCircle size={25} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                      Comunicación del viaje
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      Coordina de forma segura
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Envía mensajes o fotografías sin compartir tu número
                      personal.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    href={`/dashboard/trips/${trip.id}/chat`}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300"
                  >
                    <MessageCircle size={19} />
                    Abrir chat
                  </Link>

                  <Link
                    href={`/dashboard/trips/${trip.id}/report`}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <ShieldCheck size={19} />
                    Reportar incidente
                  </Link>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs leading-6 text-slate-500">
                    El chat permanece disponible durante el viaje y registra
                    los mensajes para seguridad de ambas partes.
                  </p>
                </div>
              </Card>
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
                    Seguridad durante el viaje
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Ayuda inmediata
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Mantén presionado el botón SOS únicamente si existe una
                    situación de riesgo o emergencia.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <SOSButton
                  tripId={trip.id}
                  onActivate={activateTripSos}
                />
              </div>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                AXI registrará la alerta, el viaje y tu ubicación cuando
                el navegador permita obtenerla. Para una emergencia inmediata,
                también puedes llamar al 911.
              </p>
            </Card>
          )}


          {role === "passenger" &&
            [
              "accepted",
              "driver_arriving",
              "driver_arrived",
            ].includes(trip.status) && (
              <Card className="border-red-100 bg-red-50">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                    <XCircle size={23} />
                  </span>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
                      Cancelación
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      ¿Ya no necesitas el viaje?
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {trip.status === "driver_arrived"
                        ? "El conductor ya llegó. La cancelación puede generar una penalización de $40 MXN."
                        : "Ya existe un conductor asignado. La cancelación puede generar una penalización de $20 MXN."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cancelCurrentTrip}
                  disabled={cancelling}
                  className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 font-black text-red-700 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
                >
                  <XCircle size={19} />

                  {cancelling
                    ? "Cancelando viaje..."
                    : "Cancelar viaje"}
                </button>
              </Card>
            )}

          {role === "driver" &&
            navigationTarget &&
            !isCompleted &&
            !isCancelled && (
              <Card className="overflow-hidden border-blue-100 bg-[linear-gradient(135deg,#eff6ff,#ffffff)]">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                    <Navigation size={26} />
                  </span>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                      Navegación del conductor
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      {navigationTarget.label}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {navigationTarget.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <MapPin
                      size={19}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Dirección
                      </p>

                      <p className="mt-1 text-sm font-black leading-6 text-slate-800">
                        {navigationTarget.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      openExternalNavigation(
                        "google",
                        navigationTarget
                      )
                    }
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800"
                  >
                    <Navigation size={19} />
                    Abrir Google Maps
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openExternalNavigation(
                        "apple",
                        navigationTarget
                      )
                    }
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <Route size={19} />
                    Abrir Apple Maps
                  </button>
                </div>

                <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                  La aplicación de mapas utilizará tu ubicación actual
                  para iniciar la ruta.
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

                {trip.status ===
                  "driver_arrived" && (
                  <div className="mt-6">
                    <label
                      htmlFor="trip-security-pin-input"
                      className="text-xs font-black uppercase tracking-[0.18em] text-slate-400"
                    >
                      PIN del pasajero
                    </label>

                    <input
                      id="trip-security-pin-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      value={pinInput}
                      onChange={(event) =>
                        setPinInput(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4)
                        )
                      }
                      placeholder="0000"
                      className="mt-3 h-16 w-full rounded-2xl border border-white/10 bg-white/10 px-5 text-center text-3xl font-black tracking-[0.5em] text-yellow-400 outline-none transition placeholder:text-slate-600 focus:border-yellow-400"
                    />

                    <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                      Solicita al pasajero el código de
                      4 dígitos antes de iniciar.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    advanceStatus(driverAction.status)
                  }
                  disabled={
                    processing ||
                    cancelling ||
                    (
                      trip.status ===
                        "driver_arrived" &&
                      pinInput.length !== 4
                    )
                  }
                  className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-50"
                >
                  {verifyingPin
                    ? "Verificando PIN..."
                    : processing
                      ? "Actualizando..."
                      : driverAction.label}

                  {!processing && <ArrowRight size={19} />}
                </button>

                {[
                  "accepted",
                  "driver_arriving",
                  "driver_arrived",
                ].includes(trip.status) && (
                  <button
                    type="button"
                    onClick={cancelDriverAndReassignTrip}
                    disabled={processing || cancelling}
                    className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 font-black text-red-300 transition hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-200 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <XCircle size={19} />

                    {cancelling
                      ? "Cancelando y reasignando..."
                      : "Cancelar viaje"}
                  </button>
                )}
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
                El recorrido terminó correctamente. Comparte tu opinión para
                ayudar a mejorar la comunidad AXI.
              </p>

              <Link
                href={`/dashboard/trips/${trip.id}/review`}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 font-black text-yellow-400 transition hover:bg-slate-900"
              >
                <Star size={20} />
                Calificar viaje
              </Link>

              {role === "passenger" && (
                <Link
                  href={`/dashboard/trips/${trip.id}/payment`}
                  className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-black/15 bg-black/10 px-5 font-black text-black transition hover:bg-black/15"
                >
                  Revisar pago y propina
                </Link>
              )}
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
      )}
    </section>
  );
}

function SearchStep({
  completed,
  active = false,
  title,
  description,
}: {
  completed: boolean;
  active?: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          completed
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-200 text-slate-400",
          active && "animate-pulse bg-yellow-100 text-yellow-700"
        )}
      >
        {completed ? (
          <Check size={17} />
        ) : (
          <Radio size={17} />
        )}
      </span>

      <div>
        <p className="text-sm font-black text-slate-800">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
