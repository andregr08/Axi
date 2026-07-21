"use client";

import Link from "next/link";
import {
  CarFront,
  CircleDollarSign,
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Route,
} from "lucide-react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import {
  DriverIdentityCard,
  type DriverIdentity,
} from "@/components/safety/DriverIdentityCard";
import { ShareTripCard } from "@/components/trips/ShareTripCard";
import { PassengerWaitingCard } from "@/components/trips/passenger/PassengerWaitingCard";
import { Card } from "@/components/ui/Card";
import type {
  TripDetailData,
} from "@/components/trips/detail/TripDetailTypes";

type PassengerTripViewProps = {
  trip: TripDetailData;
  driverIdentity: DriverIdentity | null;
  driverPhone: string | null;
  driverDistanceKm: number | null;
  driverArrivalMinutes: number | null;
  estimatedPrice: string;
  statusLabel: string;
  isCompleted: boolean;
  isCancelled: boolean;
};

export function PassengerTripView({
  trip,
  driverIdentity,
  driverPhone,
  driverDistanceKm,
  driverArrivalMinutes,
  estimatedPrice,
  statusLabel,
  isCompleted,
  isCancelled,
}: PassengerTripViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
      <div className="space-y-6">
        <PassengerWaitingCard
          status={trip.status}
          driverAssigned={Boolean(trip.driver_id)}
        />

        {!isCancelled && (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-6 py-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Seguimiento en vivo
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Ubicación de tu conductor
              </h2>
            </div>

            <GoogleMapView />
          </Card>
        )}

        {driverIdentity &&
          ["accepted", "driver_arriving", "driver_arrived", "in_progress"].includes(
            trip.status
          ) && (
            <Card>
              <DriverIdentityCard
                driver={driverIdentity}
              />

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Distancia
                  </p>

                  <p className="mt-2 text-lg font-black">
                    {driverDistanceKm !== null
                      ? `${driverDistanceKm.toFixed(1)} km`
                      : "Calculando"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Llegada estimada
                  </p>

                  <p className="mt-2 text-lg font-black">
                    {driverArrivalMinutes !== null
                      ? `${driverArrivalMinutes} min`
                      : "Calculando"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href={`/dashboard/trips/${trip.id}/chat`}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-yellow-400 font-black text-black transition hover:bg-yellow-300"
                >
                  <MessageCircle size={18} />
                  Chat
                </Link>

                {driverPhone ? (
                  <a
                    href={`tel:${driverPhone}`}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 font-black transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                  >
                    <Phone size={18} />
                    Llamar
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 font-black text-slate-400 opacity-60"
                  >
                    <Phone size={18} />
                    Sin teléfono
                  </button>
                )}
              </div>
            </Card>
          )}
      </div>

      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">
              Tu ruta
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
                  Origen
                </p>

                <p className="mt-2 font-black">
                  {trip.origin_address}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Destino
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
                Estimado
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

        {!isCompleted && !isCancelled && (
          <ShareTripCard tripId={trip.id} />
        )}

        {!trip.driver_id &&
          !isCompleted &&
          !isCancelled && (
            <Card className="bg-[#0B0F19] text-white">
              <CarFront
                size={27}
                className="text-yellow-400"
              />

              <h2 className="mt-5 text-xl font-black">
                Todavía no hay conductor asignado
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Te avisaremos en cuanto un conductor acepte
                el viaje.
              </p>
            </Card>
          )}
      </div>
    </div>
  );
}
