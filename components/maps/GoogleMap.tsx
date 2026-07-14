"use client";

import {
  APIProvider,
  Map,
  Marker,
} from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  CarFront,
  LocateFixed,
  MapPin,
} from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

const PUEBLA_CENTER = {
  lat: 19.0414,
  lng: -98.2063,
};

const previewDrivers = [
  { id: "driver-1", lat: 19.0475, lng: -98.2002 },
  { id: "driver-2", lat: 19.0369, lng: -98.2118 },
  { id: "driver-3", lat: 19.0524, lng: -98.2187 },
];

export function GoogleMapView() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { coordinates, loading, error, requestLocation } =
    useUserLocation();

  const center = coordinates ?? PUEBLA_CENTER;

  if (!apiKey) {
    return (
      <div className="relative flex h-[520px] items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.22),_transparent_30%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.55)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,0.55)_2px,transparent_2px)] bg-[size:55px_55px] opacity-60" />

        <div className="relative max-w-md px-6 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-[#0B0F19] text-yellow-400 shadow-2xl">
            <MapPin size={34} />
          </span>

          <h3 className="mt-6 text-2xl font-black text-slate-950">
            Google Maps está preparado
          </h3>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Falta agregar la clave pública de Google Maps para mostrar el
            mapa real. Gali podrá configurarla en Vercel al integrar el
            proyecto.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800">
            <AlertTriangle size={15} />
            Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[520px] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={14}
          center={center}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-full w-full"
        >
          <Marker
            position={center}
            title="Tu ubicación"
          />

          {previewDrivers.map((driver) => (
            <Marker
              key={driver.id}
              position={{
                lat: driver.lat,
                lng: driver.lng,
              }}
              title="Conductor AXI"
            />
          ))}
        </Map>
      </APIProvider>

      <div className="pointer-events-none absolute left-4 top-4 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl sm:left-6 sm:top-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            <CarFront size={21} />
          </span>

          <div>
            <p className="font-black text-slate-950">
              Conductores cercanos
            </p>
            <p className="text-xs text-slate-500">
              Vista preliminar de AXI
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={requestLocation}
        disabled={loading}
        aria-label="Actualizar mi ubicación"
        className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B0F19] text-yellow-400 shadow-xl transition hover:scale-105 disabled:opacity-60"
      >
        <LocateFixed
          size={21}
          className={loading ? "animate-pulse" : ""}
        />
      </button>

      {error && (
        <div className="absolute bottom-5 left-5 max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-xs font-semibold text-slate-600 shadow-xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
