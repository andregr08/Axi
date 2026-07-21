"use client";

import { ShieldCheck } from "lucide-react";
import { SOSButton } from "@/components/safety/SOSButton";
import { Card } from "@/components/ui/Card";

type TripSafetyCardProps = {
  tripId: string;
};

export function TripSafetyCard({
  tripId,
}: TripSafetyCardProps) {
  return (
    <Card className="border-red-100 bg-[linear-gradient(135deg,#fff7f7,#ffffff)]">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
          <ShieldCheck size={25} />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
            Seguridad
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            Ayuda inmediata durante el viaje
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Usa el botón SOS únicamente si existe una emergencia
            o una situación que ponga en riesgo tu seguridad.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SOSButton tripId={tripId} />
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-slate-400">
        AXI registrará el viaje y enviará la alerta al equipo
        correspondiente.
      </p>
    </Card>
  );
}
