"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CircleDollarSign,
  Clock3,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { DriverActionCard } from "@/components/trips/driver/DriverActionCard";
import { DriverPassengerCard } from "@/components/trips/driver/DriverPassengerCard";
import { Card } from "@/components/ui/Card";
import type {
  TripDetailData,
  TripDetailStatus,
  TripDriverLocation,
} from "@/components/trips/detail/TripDetailTypes";

type DriverTripViewProps = {
  trip: TripDetailData;
  driverLocation: TripDriverLocation | null;
  passengerName: string;
  passengerPhone: string | null;
  estimatedPrice: string;
  statusLabel: string;
  nextStatus: TripDetailStatus | null;
  actionLabel: string | null;
  processing: boolean;
  pinError?: string;
  isCompleted: boolean;
  isCancelled: boolean;
  onAdvanceStatus: (
    nextStatus: TripDetailStatus
  ) => Promise<void>;
  onVerifyPin: (
    pin: string
  ) => Promise<void>;
};

export function DriverTripView({
  trip,
  driverLocation,
  passengerName,
  passengerPhone,
  estimatedPrice,
  statusLabel,
  nextStatus,
  actionLabel,
  processing,
  pinError,
  isCompleted,
  isCancelled,
  onAdvanceStatus,
  onVerifyPin,
}: DriverTripViewProps) {
  const navigationMapRef =
    useRef<HTMLDivElement>(null);

  const [
    navigationActive,
    setNavigationActive,
  ] = useState(
    trip.status === "in_progress"
  );

  function handleNavigateToPassenger() {
    setNavigationActive(true);

    navigationMapRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    if (trip.status === "in_progress") {
      setNavigationActive(true);
    }

    if (isCompleted || isCancelled) {
      setNavigationActive(false);
    }
  }, [
    isCancelled,
    isCompleted,
    trip.status,
  ]);

  const originCoordinates =
    trip.origin_lat !== null &&
    trip.origin_lng !== null
      ? {
          lat: Number(trip.origin_lat),
          lng: Number(trip.origin_lng),
        }
      : null;

  const destinationCoordinates =
    trip.destination_lat !== null &&
    trip.destination_lng !== null
      ? {
          lat: Number(trip.destination_lat),
          lng: Number(trip.destination_lng),
        }
      : null;

  const driverCoordinates = driverLocation
    ? {
        lat: Number(driverLocation.latitude),
        lng: Number(driverLocation.longitude),
      }
    : null;

  const navigatingToDestination =
    trip.status === "in_progress" ||
    trip.status === "completed";

  const routeOrigin = isCompleted
    ? originCoordinates
    : driverCoordinates;

  const routeDestination = navigatingToDestination
    ? destinationCoordinates
    : originCoordinates;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="xl:col-span-2">
        <DriverActionCard
          currentStatus={trip.status}
          nextStatus={nextStatus}
          actionLabel={actionLabel}
          processing={processing}
          pinError={pinError}
          onNavigateToPassenger={
            handleNavigateToPassenger
          }
          onAdvanceStatus={onAdvanceStatus}
          onVerifyPin={onVerifyPin}
        />
      </div>

      <div className="space-y-6">
        {!isCancelled && (
          <div
            ref={navigationMapRef}
            className="scroll-mt-6"
          >
            <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-6 py-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Navegación del conductor
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {trip.status === "in_progress"
                  ? "Ruta hacia el destino"
                  : "Ruta hacia el pasajero"}
              </h2>
            </div>

            <GoogleMapView
              origin={originCoordinates}
              destination={destinationCoordinates}
              driverLocation={driverCoordinates}
              routeOrigin={routeOrigin}
              routeDestination={routeDestination}
              routeLabel={
                navigatingToDestination
                  ? "Ruta hacia el destino"
                  : "Ruta hacia el pasajero"
              }
              navigationMode={navigationActive}
              driverHeading={
                driverLocation?.heading ?? null
              }
              showUserLocation={false}
            />
            </Card>
          </div>
        )}

        {!isCompleted && !isCancelled && (
          <DriverPassengerCard
            tripId={trip.id}
            passengerName={passengerName}
            passengerPhone={passengerPhone}
            originAddress={trip.origin_address}
          />
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">
              Servicio
            </h2>

            <Route
              size={25}
              className="text-yellow-600"
            />
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
                  Recoger en
                </p>

                <p className="mt-2 font-black">
                  {trip.origin_address}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Llevar a
                </p>

                <p className="mt-2 font-black">
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

              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">
                Valor
              </p>

              <p className="mt-1 font-black">
                {estimatedPrice}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <Clock3
                size={20}
                className="text-blue-600"
              />

              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">
                Estado
              </p>

              <p className="mt-1 font-black">
                {statusLabel}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
