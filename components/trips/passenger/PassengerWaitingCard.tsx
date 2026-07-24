"use client";

import {
  CarFront,
  LoaderCircle,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/hooks/useLanguage";
import type {
  TripDetailStatus,
} from "@/components/trips/detail/TripDetailTypes";

type PassengerWaitingCardProps = {
  status: TripDetailStatus;
  driverAssigned: boolean;
};

export function PassengerWaitingCard({
  status,
  driverAssigned,
}: PassengerWaitingCardProps) {
  const { locale } = useLanguage();
  const english = locale === "en";

  if (
    driverAssigned ||
    !["requested", "searching"].includes(status)
  ) {
    return null;
  }

  return (
    <Card className="overflow-hidden bg-[#0B0F19] text-white">
      <div className="flex items-start gap-4">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black">
          <CarFront size={25} />

          <LoaderCircle
            size={18}
            className="absolute -right-2 -top-2 animate-spin rounded-full bg-white p-0.5 text-slate-950"
          />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
            {english
              ? "Searching for a driver"
              : "Buscando conductor"}
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {english
              ? "We're finding your AXI"
              : "Estamos encontrando tu AXI"}
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            {english
              ? "We are searching for available drivers near your pickup point. This screen will update automatically."
              : "Buscamos conductores disponibles cerca de tu punto de partida. Esta pantalla se actualizará automáticamente."}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <Search
          size={19}
          className="shrink-0 text-yellow-400"
        />

        <p className="text-sm font-semibold text-slate-300">
          {english
            ? "You don't need to refresh or leave this screen."
            : "No necesitas actualizar ni salir de esta pantalla."}
        </p>
      </div>
    </Card>
  );
}
