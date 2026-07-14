"use client";

import {
  BadgeCheck,
  CarFront,
  Hash,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";

export type DriverIdentity = {
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlates: string | null;
  verified: boolean;
};

export function DriverIdentityCard({
  driver,
}: {
  driver: DriverIdentity;
}) {
  const initial =
    driver.name.trim().charAt(0).toUpperCase() || "A";

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="bg-[#0B0F19] px-6 py-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
              Tu conductor AXI
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Verifica antes de abordar
            </h2>
          </div>

          <ShieldCheck
            size={27}
            className="text-yellow-400"
          />
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.6rem] bg-yellow-400 text-2xl font-black text-black">
            {driver.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driver.avatarUrl}
                alt={driver.name}
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-black text-slate-950">
                {driver.name}
              </h3>

              {driver.verified && (
                <BadgeCheck
                  size={20}
                  className="shrink-0 text-blue-600"
                  aria-label="Conductor verificado"
                />
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-600">
              <Star
                size={17}
                className="fill-yellow-400 text-yellow-400"
              />

              {driver.rating !== null
                ? driver.rating.toFixed(1)
                : "Sin calificación"}
            </div>

            <p className="mt-2 text-xs font-semibold text-emerald-700">
              {driver.verified
                ? "Identidad validada por AXI"
                : "Verificación pendiente"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[1.7rem] bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <CarFront size={23} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                Vehículo
              </p>

              <p className="mt-1 font-black">
                {[driver.vehicleBrand, driver.vehicleModel]
                  .filter(Boolean)
                  .join(" ") || "Vehículo pendiente"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <VehicleData
              label="Color"
              value={driver.vehicleColor || "Pendiente"}
              icon={<CarFront size={17} />}
            />

            <VehicleData
              label="Placas"
              value={driver.vehiclePlates || "Pendientes"}
              icon={<Hash size={17} />}
            />
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <UserRound
            size={18}
            className="mt-0.5 shrink-0 text-amber-700"
          />

          <p className="text-xs leading-6 text-amber-800">
            No abordes si la fotografía, el vehículo o las placas no
            coinciden con los datos mostrados en AXI.
          </p>
        </div>
      </div>
    </section>
  );
}

function VehicleData({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-yellow-400">
        {icon}
      </span>

      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}
