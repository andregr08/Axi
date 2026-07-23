"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CarFront,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import type {
  TripDetailStatus,
} from "@/components/trips/detail/TripDetailTypes";

type DriverActionCardProps = {
  tripId: string;
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
    "Solicita al pasajero su código de seguridad antes de iniciar.",
  in_progress:
    "Finaliza el servicio únicamente cuando llegues al destino.",
};

const cancellationReasons = [
  "El pasajero no responde",
  "No puedo llegar al punto de recogida",
  "Emergencia personal",
  "Problema con el vehículo",
  "Otro",
] as const;

export function DriverActionCard({
  tripId,
  currentStatus,
  nextStatus,
  actionLabel,
  processing,
  onAdvanceStatus,
}: DriverActionCardProps) {
  const [cancelModalOpen, setCancelModalOpen] =
    useState(false);

  const [pinModalOpen, setPinModalOpen] =
    useState(false);

  const [securityPin, setSecurityPin] =
    useState("");

  const [pinError, setPinError] =
    useState("");

  const [verifyingPin, setVerifyingPin] =
    useState(false);

  const [selectedReason, setSelectedReason] =
    useState("");

  const [otherReason, setOtherReason] =
    useState("");

  const [cancelling, setCancelling] =
    useState(false);

  const [cancelError, setCancelError] =
    useState("");

  function closeCancelModal() {
    if (cancelling) return;

    setCancelModalOpen(false);
    setSelectedReason("");
    setOtherReason("");
    setCancelError("");
  }

  function closePinModal() {
    if (verifyingPin) return;

    setPinModalOpen(false);
    setSecurityPin("");
    setPinError("");
  }

  function handlePrimaryAction() {
    if (!nextStatus) return;

    if (
      currentStatus === "driver_arrived" &&
      nextStatus === "in_progress"
    ) {
      setSecurityPin("");
      setPinError("");
      setPinModalOpen(true);
      return;
    }

    void onAdvanceStatus(nextStatus);
  }

  async function verifyPinAndStart() {
    if (!/^\d{4}$/.test(securityPin)) {
      setPinError(
        "Ingresa el código completo de 4 dígitos."
      );
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que el pasajero está dentro del vehículo y deseas iniciar el viaje?"
    );

    if (!confirmed) return;

    setVerifyingPin(true);
    setPinError("");

    const { error } = await supabase.rpc(
      "verify_trip_pin_and_start",
      {
        p_trip_id: tripId,
        p_security_pin: securityPin,
      }
    );

    if (error) {
      setPinError(error.message);
      setVerifyingPin(false);
      return;
    }

    setPinModalOpen(false);
    setVerifyingPin(false);

    window.alert(
      "PIN verificado. El viaje ha comenzado."
    );

    window.location.reload();
  }

  async function cancelTrip() {
    const finalReason =
      selectedReason === "Otro"
        ? otherReason.trim()
        : selectedReason.trim();

    if (!finalReason) {
      setCancelError(
        selectedReason === "Otro"
          ? "Escribe el motivo de la cancelación."
          : "Selecciona un motivo para continuar."
      );
      return;
    }

    setCancelling(true);
    setCancelError("");

    const { error } = await supabase.rpc(
      "driver_cancel_trip",
      {
        requested_trip_id: tripId,
        cancellation_reason_value: finalReason,
      }
    );

    if (error) {
      setCancelError(
        `No se pudo cancelar el viaje: ${error.message}`
      );
      setCancelling(false);
      return;
    }

    setCancelModalOpen(false);

    window.alert(
      "Cancelaste el servicio. AXI buscará otro conductor para el pasajero."
    );

    window.location.reload();
  }

  if (!nextStatus || !actionLabel) {
    return null;
  }

  const requiresPin =
    currentStatus === "driver_arrived" &&
    nextStatus === "in_progress";

  return (
    <>
      <Card className="bg-[#0B0F19] text-white">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            {requiresPin ? (
              <KeyRound size={25} />
            ) : (
              <CarFront size={25} />
            )}
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

        {requiresPin && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-yellow-400"
            />

            <p className="text-xs leading-5 text-yellow-100">
              El pasajero debe compartirte su PIN
              únicamente cuando esté dentro del vehículo
              correcto.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={
            processing ||
            cancelling ||
            verifyingPin
          }
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
              {requiresPin
                ? "Ingresar PIN e iniciar"
                : actionLabel}

              {requiresPin ? (
                <KeyRound size={19} />
              ) : (
                <ArrowRight size={19} />
              )}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setCancelError("");
            setCancelModalOpen(true);
          }}
          disabled={
            processing ||
            cancelling ||
            verifyingPin
          }
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/10 px-5 font-black text-red-300 transition hover:bg-red-500 hover:text-white disabled:pointer-events-none disabled:opacity-50"
        >
          Cancelar viaje
        </button>
      </Card>

      {pinModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closePinModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-pin-title"
            className="w-full max-w-md rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                  <KeyRound size={24} />
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-700">
                    Seguridad AXI
                  </p>

                  <h2
                    id="trip-pin-title"
                    className="mt-1 text-2xl font-black text-slate-950"
                  >
                    Ingresa el PIN
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closePinModal}
                disabled={verifyingPin}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-500">
              Pide al pasajero el código de cuatro
              dígitos que aparece en su pantalla.
            </p>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={4}
              value={securityPin}
              onChange={(event) => {
                const value =
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4);

                setSecurityPin(value);
                setPinError("");
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  securityPin.length === 4 &&
                  !verifyingPin
                ) {
                  void verifyPinAndStart();
                }
              }}
              aria-label="PIN de seguridad"
              placeholder="0000"
              className="mt-6 h-20 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-center text-4xl font-black tracking-[0.45em] text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-100"
            />

            <p className="mt-3 text-center text-xs font-semibold text-slate-400">
              {securityPin.length}/4 dígitos
            </p>

            {pinError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {pinError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closePinModal}
                disabled={verifyingPin}
                className="h-13 rounded-2xl bg-slate-100 px-4 font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                Regresar
              </button>

              <button
                type="button"
                onClick={() => {
                  void verifyPinAndStart();
                }}
                disabled={
                  verifyingPin ||
                  securityPin.length !== 4
                }
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-50"
              >
                {verifyingPin ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Verificando
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Iniciar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeCancelModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-trip-title"
            className="w-full max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <AlertTriangle size={24} />
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">
                    Cancelación
                  </p>

                  <h2
                    id="cancel-trip-title"
                    className="mt-1 text-2xl font-black text-slate-950"
                  >
                    ¿Por qué cancelas?
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCancelModal}
                disabled={cancelling}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-500">
              El pasajero será notificado y AXI
              buscará otro conductor. La cancelación
              puede generar una penalización.
            </p>

            <div className="mt-6 space-y-3">
              {cancellationReasons.map(
                (reason) => (
                  <label
                    key={reason}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 transition ${
                      selectedReason === reason
                        ? "border-red-500 bg-red-50"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancellation-reason"
                      value={reason}
                      checked={
                        selectedReason === reason
                      }
                      onChange={() => {
                        setSelectedReason(reason);
                        setCancelError("");
                      }}
                      className="h-4 w-4 accent-red-600"
                    />

                    <span className="text-sm font-bold text-slate-800">
                      {reason}
                    </span>
                  </label>
                )
              )}
            </div>

            {selectedReason === "Otro" && (
              <div className="mt-4">
                <label
                  htmlFor="other-cancellation-reason"
                  className="text-sm font-black text-slate-800"
                >
                  Describe el motivo
                </label>

                <textarea
                  id="other-cancellation-reason"
                  value={otherReason}
                  onChange={(event) => {
                    setOtherReason(
                      event.target.value
                    );
                    setCancelError("");
                  }}
                  maxLength={250}
                  rows={3}
                  placeholder="Escribe brevemente lo ocurrido..."
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />

                <p className="mt-1 text-right text-xs font-semibold text-slate-400">
                  {otherReason.length}/250
                </p>
              </div>
            )}

            {cancelError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {cancelError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={cancelling}
                className="h-13 rounded-2xl bg-slate-100 px-4 font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                Regresar
              </button>

              <button
                type="button"
                onClick={cancelTrip}
                disabled={cancelling}
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 font-black text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {cancelling ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Cancelando
                  </>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
