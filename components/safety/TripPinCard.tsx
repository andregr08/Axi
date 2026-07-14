"use client";

import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

export function TripPinCard({
  pin,
  visibleToPassenger,
}: {
  pin: string | null;
  visibleToPassenger: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-blue-200 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <KeyRound size={25} />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            Código de seguridad
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            Confirma el viaje antes de iniciar
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            El pasajero debe compartir este código únicamente cuando
            esté dentro del taxi correcto.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.7rem] bg-slate-950 p-6 text-center text-white">
        {pin && visibleToPassenger ? (
          <>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              PIN del viaje
            </p>

            <p className="mt-3 text-5xl font-black tracking-[0.35em] text-yellow-400">
              {pin}
            </p>
          </>
        ) : (
          <>
            <LockKeyhole
              size={31}
              className="mx-auto text-yellow-400"
            />

            <p className="mt-4 font-black">
              PIN pendiente de conexión
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Gali conectará la generación y validación segura del código
              desde Supabase.
            </p>
          </>
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-blue-100 p-4">
        <ShieldCheck
          size={18}
          className="mt-0.5 shrink-0 text-blue-700"
        />

        <p className="text-xs leading-6 text-blue-800">
          El conductor no debe iniciar el recorrido hasta confirmar el
          código correcto.
        </p>
      </div>
    </section>
  );
}
