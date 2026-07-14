"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  LoaderCircle,
  PhoneCall,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";

type SOSButtonProps = {
  tripId?: string;
  compact?: boolean;
  className?: string;
  onActivate?: () => void | Promise<void>;
};

const HOLD_DURATION = 2000;

export function SOSButton({
  tripId,
  compact = false,
  className,
  onActivate,
}: SOSButtonProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const startedAtRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  function cancelAnimation() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(
        animationFrameRef.current
      );

      animationFrameRef.current = null;
    }
  }

  function resetHold() {
    cancelAnimation();
    startedAtRef.current = null;
    setHolding(false);
    setProgress(0);
  }

  function updateProgress() {
    if (startedAtRef.current === null) return;

    const elapsed =
      performance.now() - startedAtRef.current;

    const nextProgress = Math.min(
      100,
      (elapsed / HOLD_DURATION) * 100
    );

    setProgress(nextProgress);

    if (nextProgress >= 100) {
      resetHold();
      setConfirmOpen(true);
      return;
    }

    animationFrameRef.current =
      window.requestAnimationFrame(updateProgress);
  }

  function startHold() {
    if (activating || activated) return;

    cancelAnimation();
    startedAtRef.current = performance.now();
    setHolding(true);
    setProgress(0);

    animationFrameRef.current =
      window.requestAnimationFrame(updateProgress);
  }

  async function activateEmergency() {
    setActivating(true);
    setErrorMessage("");

    try {
      await onActivate?.();

      setActivated(true);
      setConfirmOpen(false);

      if ("vibrate" in navigator) {
        navigator.vibrate([250, 120, 250]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible activar la alerta SOS."
      );
    } finally {
      setActivating(false);
    }
  }

  function callEmergencyServices() {
    window.location.href = "tel:911";
  }

  useEffect(() => {
    return () => {
      cancelAnimation();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Mantén presionado para activar SOS"
        onPointerDown={startHold}
        onPointerUp={resetHold}
        onPointerCancel={resetHold}
        onPointerLeave={resetHold}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            resetHold();
          }
        }}
        disabled={activating}
        className={cn(
          "relative isolate overflow-hidden rounded-2xl border font-black transition disabled:pointer-events-none disabled:opacity-60",
          compact
            ? "flex h-12 items-center justify-center gap-2 border-red-200 bg-red-50 px-4 text-sm text-red-700 hover:bg-red-100"
            : "flex min-h-16 w-full items-center justify-center gap-3 border-red-200 bg-red-600 px-6 text-white shadow-lg shadow-red-600/20 hover:bg-red-700",
          activated &&
            "border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-600",
          className
        )}
      >
        <span
          className="absolute inset-y-0 left-0 -z-10 bg-red-900/30 transition-none"
          style={{
            width: `${progress}%`,
          }}
        />

        {activated ? (
          <ShieldAlert size={compact ? 18 : 23} />
        ) : (
          <Siren
            size={compact ? 18 : 23}
            className={holding ? "animate-pulse" : ""}
          />
        )}

        <span>
          {activated
            ? "Alerta SOS activada"
            : holding
              ? "Sigue presionando..."
              : compact
                ? "SOS"
                : "Mantén presionado para SOS"}
        </span>
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-dialog-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-red-600 px-6 py-8 text-white sm:px-8">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                aria-label="Cerrar"
                className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition hover:bg-white/25"
              >
                <X size={20} />
              </button>

              <span className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white text-red-600 shadow-xl">
                <Siren size={31} />
              </span>

              <h2
                id="sos-dialog-title"
                className="mt-6 text-3xl font-black"
              >
                ¿Necesitas ayuda?
              </h2>

              <p className="mt-3 max-w-md text-sm leading-7 text-red-50">
                Al activar la alerta, AXI preparará el
                registro del viaje, la hora y tu ubicación
                para enviarlos al centro de seguridad.
              </p>
            </div>

            <div className="space-y-4 p-6 sm:p-8">
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={activateEmergency}
                disabled={activating}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 font-black text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {activating ? (
                  <>
                    <LoaderCircle
                      size={20}
                      className="animate-spin"
                    />
                    Activando alerta...
                  </>
                ) : (
                  <>
                    <ShieldAlert size={20} />
                    Activar alerta SOS
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={callEmergencyServices}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800"
              >
                <PhoneCall size={20} />
                Llamar al 911
              </button>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <p className="text-center text-xs leading-5 text-slate-400">
                AXI no sustituye a los servicios oficiales de
                emergencia.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
