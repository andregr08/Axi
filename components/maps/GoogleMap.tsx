"use client";

import dynamic from "next/dynamic";
import {
  CarFront,
  LocateFixed,
} from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

const OpenStreetMap = dynamic(
  () => import("@/components/maps/OpenStreetMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <p className="text-sm font-bold text-slate-500">
          Cargando mapa...
        </p>
      </div>
    ),
  }
);

const PUEBLA_CENTER = {
  lat: 19.0414,
  lng: -98.2063,
};

export function GoogleMapView() {
  const {
    coordinates,
    loading,
    error,
    requestLocation,
  } = useUserLocation();

  const center = coordinates ?? PUEBLA_CENTER;

  return (
    <div className="relative h-[520px] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
      <OpenStreetMap center={center} />

      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-3xl border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl sm:left-6 sm:top-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            <CarFront size={21} />
          </span>

          <div>
            <p className="font-black text-slate-950">
              Conductores cercanos
            </p>
            <p className="text-xs text-slate-500">
              Mapa OpenStreetMap
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={requestLocation}
        disabled={loading}
        aria-label="Actualizar mi ubicación"
        className="absolute bottom-5 right-5 z-[500] flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B0F19] text-yellow-400 shadow-xl transition hover:scale-105 disabled:opacity-60"
      >
        <LocateFixed
          size={21}
          className={loading ? "animate-pulse" : ""}
        />
      </button>

      {error && (
        <div className="absolute bottom-5 left-5 z-[500] max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-xs font-semibold text-slate-600 shadow-xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
