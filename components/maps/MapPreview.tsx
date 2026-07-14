"use client";

import {
  CarFront,
  LocateFixed,
  MapPinned,
  Navigation,
  Plus,
  Minus,
  Route,
} from "lucide-react";

const drivers = [
  { id: 1, left: "18%", top: "28%", active: true },
  { id: 2, left: "48%", top: "44%", active: true },
  { id: 3, left: "70%", top: "24%", active: false },
  { id: 4, left: "78%", top: "67%", active: true },
  { id: 5, left: "31%", top: "73%", active: true },
];

export function MapPreview() {
  return (
    <div className="relative h-[520px] overflow-hidden rounded-[2rem] border border-slate-200 bg-[#E9EDF0] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-[8%] top-0 h-full w-8 rotate-[18deg] bg-white/80" />
        <div className="absolute left-[35%] top-0 h-full w-5 -rotate-[12deg] bg-white/70" />
        <div className="absolute right-[18%] top-0 h-full w-7 rotate-[8deg] bg-white/80" />

        <div className="absolute left-0 top-[20%] h-6 w-full -rotate-[4deg] bg-white/80" />
        <div className="absolute left-0 top-[53%] h-5 w-full rotate-[7deg] bg-white/70" />
        <div className="absolute bottom-[15%] left-0 h-8 w-full -rotate-[2deg] bg-white/80" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.18),transparent_22%),radial-gradient(circle_at_80%_70%,rgba(15,23,42,0.10),transparent_25%)]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M140 390 C250 320, 280 210, 430 250 C570 290, 620 120, 820 165"
          fill="none"
          stroke="rgba(15,23,42,0.15)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        <path
          d="M140 390 C250 320, 280 210, 430 250 C570 290, 620 120, 820 165"
          fill="none"
          stroke="#FACC15"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="10 12"
        />
      </svg>

      <div className="absolute left-[12%] top-[70%]">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-yellow-400/50" />

          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-yellow-400 text-black shadow-xl">
            <MapPinned size={21} />
          </div>
        </div>
      </div>

      <div className="absolute left-[80%] top-[25%]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#0B0F19] text-yellow-400 shadow-xl">
          <Navigation size={21} />
        </div>
      </div>

      {drivers.map((driver) => (
        <div
          key={driver.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: driver.left,
            top: driver.top,
          }}
        >
          <div className="group relative">
            {driver.active && (
              <span className="absolute -right-1 -top-1 z-10 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            )}

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-[#0B0F19] text-yellow-400 shadow-lg transition duration-200 group-hover:-translate-y-1 group-hover:scale-110">
              <CarFront size={20} />
            </div>
          </div>
        </div>
      ))}

      <div className="absolute left-4 top-4 right-4 flex flex-col gap-3 sm:left-6 sm:right-auto sm:top-6">
        <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl backdrop-blur-xl sm:w-72">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <Route size={21} />
            </span>

            <div>
              <p className="font-black text-slate-950">Operación en vivo</p>
              <p className="text-xs text-slate-500">
                Puebla, México
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-100 p-3 text-center">
              <p className="text-xl font-black">5</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Conductores
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 p-3 text-center">
              <p className="text-xl font-black">0</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Viajes
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 p-3 text-center">
              <p className="text-xl font-black text-emerald-600">Online</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Sistema
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col gap-2 sm:right-6 sm:top-6">
        <button
          type="button"
          aria-label="Acercar mapa"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-slate-900 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <Plus size={20} />
        </button>

        <button
          type="button"
          aria-label="Alejar mapa"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-slate-900 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <Minus size={20} />
        </button>

        <button
          type="button"
          aria-label="Ubicación actual"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0F19] text-yellow-400 shadow-lg transition hover:scale-105"
        >
          <LocateFixed size={20} />
        </button>
      </div>

      <div className="absolute bottom-4 left-4 right-4 rounded-3xl border border-white/80 bg-white/92 p-4 shadow-xl backdrop-blur-xl sm:bottom-6 sm:left-6 sm:right-auto sm:w-[420px]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-950">
              Mapa en tiempo real
            </p>
            <p className="truncate text-sm text-slate-500">
              Preparado para Google Maps y ubicaciones en vivo
            </p>
          </div>

          <Navigation className="shrink-0 text-yellow-500" size={21} />
        </div>
      </div>
    </div>
  );
}
