"use client";

import {
  Check,
  Clock3,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import type {
  TripDetailRole,
  TripDetailStatus,
} from "@/components/trips/detail/TripDetailTypes";

type ProgressStep = {
  status: TripDetailStatus;
  passengerLabel: string;
  driverLabel: string;
};

const progressSteps: ProgressStep[] = [
  {
    status: "accepted",
    passengerLabel: "Conductor asignado",
    driverLabel: "Viaje aceptado",
  },
  {
    status: "driver_arriving",
    passengerLabel: "Conductor en camino",
    driverLabel: "En camino al pasajero",
  },
  {
    status: "driver_arrived",
    passengerLabel: "Conductor llegó",
    driverLabel: "Llegaste al origen",
  },
  {
    status: "in_progress",
    passengerLabel: "Viaje en curso",
    driverLabel: "En camino al destino",
  },
  {
    status: "completed",
    passengerLabel: "Viaje completado",
    driverLabel: "Viaje completado",
  },
];

type TripProgressProps = {
  role: TripDetailRole;
  status: TripDetailStatus;
};

export function TripProgress({
  role,
  status,
}: TripProgressProps) {
  if (status === "cancelled") {
    return null;
  }

  const statuses = progressSteps.map(
    (step) => step.status
  );

  const currentIndex = statuses.indexOf(status);
  const isCompleted = status === "completed";

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Seguimiento
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {role === "driver"
              ? "Progreso del servicio"
              : "Estado de tu viaje"}
          </h2>
        </div>

        <Clock3
          size={25}
          className="text-yellow-600"
        />
      </div>

      <div className="mt-8 grid grid-cols-5 gap-2">
        {progressSteps.map((step, index) => {
          const completed =
            currentIndex >= index ||
            isCompleted;

          const active =
            currentIndex === index &&
            !isCompleted;

          const label =
            role === "driver"
              ? step.driverLabel
              : step.passengerLabel;

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
                  active &&
                    "ring-4 ring-yellow-400/20"
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
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
