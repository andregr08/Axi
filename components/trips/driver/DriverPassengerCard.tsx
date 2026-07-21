"use client";

import Link from "next/link";
import {
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

type DriverPassengerCardProps = {
  tripId: string;
  passengerName: string;
  passengerPhone: string | null;
  originAddress: string;
};

export function DriverPassengerCard({
  tripId,
  passengerName,
  passengerPhone,
  originAddress,
}: DriverPassengerCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Recoger pasajero
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Información del servicio
          </h2>
        </div>

        <UserRound
          size={25}
          className="text-violet-600"
        />
      </div>

      <div className="mt-6 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <UserRound size={22} />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Pasajero
          </p>

          <p className="mt-1 truncate text-lg font-black text-slate-950">
            {passengerName}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-4 rounded-2xl border border-slate-200 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <MapPin size={20} />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Punto de recogida
          </p>

          <p className="mt-1 font-black leading-6 text-slate-950">
            {originAddress}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link
          href={`/dashboard/trips/${tripId}/chat`}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 font-black text-black transition hover:bg-yellow-300"
        >
          <MessageCircle size={18} />
          Chat
        </Link>

        {passengerPhone ? (
          <a
            href={`tel:${passengerPhone}`}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 font-black text-slate-950 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
          >
            <Phone size={18} />
            Llamar
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 font-black text-slate-400 opacity-60"
          >
            <Phone size={18} />
            Sin teléfono
          </button>
        )}

        <button
          type="button"
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 font-black text-slate-950 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <Navigation size={18} />
          Navegar
        </button>
      </div>
    </Card>
  );
}
