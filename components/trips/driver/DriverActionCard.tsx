"use client";

import {
  ArrowRight,
  CarFront,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type {
  TripDetailStatus,
} from "@/components/trips/detail/TripDetailTypes";

type DriverActionCardProps = {
  currentStatus: TripDetailStatus;
  nextStatus: TripDetailStatus | null;
  actionLabel: string | null;
  processing: boolean;
  pinError?: string;
  onAdvanceStatus: (
    nextStatus: TripDetailStatus
  ) => Promise<void>;
  onVerifyPin: (
    pin: string
  ) => Promise<void>;
};

const statusDescriptions: Partial<
  Record<TripDetailStatus, string>
> = {
  accepted:
    "Inicia la ruta hacia el punto de recogida.",
  driver_arriving:
    "La llegada se detectará automáticamente con tu ubicación.",
  driver_arrived:
    "Solicita al pasajero su PIN de 4 dígitos.",
  in_progress:
    "Finaliza el servicio únicamente cuando llegues al destino.",
};

export function DriverActionCard({
  currentStatus,
  nextStatus,
  actionLabel,
  processing,
  pinError,
  onAdvanceStatus,
  onVerifyPin,
}: DriverActionCardProps) {
  const [pin, setPin] = useState("");

  function handlePinChange(
    value: string
  ) {
    setPin(
      value.replace(/\D/g, "").slice(0, 4)
    );
  }

  async function handleVerifyPin() {
    if (pin.length !== 4 || processing) {
      return;
    }

    await onVerifyPin(pin);
  }

  if (currentStatus === "driver_arrived") {
    return (
      <Card className="bg-[#0B0F19] text-white">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            <ShieldCheck size={25} />
          </span>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
              Verificación de seguridad
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Introduce el PIN
            </h2>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-400">
          Solicita al pasajero el código de 4 dígitos.
          Al validarlo, el viaje iniciará automáticamente.
        </p>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(event) =>
            handlePinChange(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleVerifyPin();
            }
          }}
          placeholder="0000"
          aria-label="PIN del viaje"
          disabled={processing}
          className="mt-6 h-16 w-full rounded-2xl border border-slate-700 bg-slate-900 px-5 text-center text-3xl font-black tracking-[0.5em] text-white outline-none transition focus:border-yellow-400 disabled:opacity-50"
        />

        {pinError && (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
            {pinError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleVerifyPin()}
          disabled={
            processing ||
            pin.length !== 4
          }
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-50"
        >
          {processing ? (
            <>
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
              Verificando PIN
            </>
          ) : (
            <>
              Confirmar PIN
              <ArrowRight size={19} />
            </>
          )}
        </button>
      </Card>
    );
  }

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
        onClick={() =>
          onAdvanceStatus(nextStatus)
        }
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
