"use client";

import {
  ArrowRight,
  CarFront,
  LoaderCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type {
  TripDetailStatus,
} from "@/components/trips/detail/TripDetailTypes";

type DriverActionCardProps = {
  currentStatus: TripDetailStatus;
  nextStatus: TripDetailStatus | null;
  actionLabel: string | null;
  processing: boolean;
  onAdvanceStatus: (
    nextStatus: TripDetailStatus
  ) => Promise<void>;
};

const statusDescriptions: Partial<
  Record<TripDetailStatus, string>
> = {
  accepted:
    "Confirma que vas en camino al punto de recogida.",
  driver_arriving:
    "Cuando estés en el punto indicado, marca que llegaste.",
  driver_arrived:
    "Confirma el código de seguridad antes de iniciar.",
  in_progress:
    "Finaliza el servicio únicamente cuando llegues al destino.",
};

export function DriverActionCard({
  currentStatus,
  nextStatus,
  actionLabel,
  processing,
  onAdvanceStatus,
}: DriverActionCardProps) {
  if (!nextStatus || !actionLabel) {
    return null;
  }

  return (
    <Card className="bg-[#0B0F19] text-white">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
          <CarFront size={25} />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
            Siguiente paso
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Control del servicio
          </h2>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-400">
        {statusDescriptions[currentStatus] ??
          "Actualiza el progreso del servicio."}
      </p>

      <button
        type="button"
        onClick={() => onAdvanceStatus(nextStatus)}
        disabled={processing}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-50"
      >
        {processing ? (
          <>
            <LoaderCircle
              size={19}
              className="animate-spin"
            />
            Actualizando
          </>
        ) : (
          <>
            {actionLabel}
            <ArrowRight size={19} />
          </>
        )}
      </button>
    </Card>
  );
}
