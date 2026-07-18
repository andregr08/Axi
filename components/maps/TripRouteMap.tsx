"use client";

import dynamic from "next/dynamic";

export type RouteCoordinates = {
  latitude: number;
  longitude: number;
};

export type RoutePoint = {
  lat: number;
  lng: number;
};

type TripRouteMapProps = {
  origin: RouteCoordinates;
  destination: RouteCoordinates;
  routePoints: RoutePoint[];
};

const TripRouteLeafletMap = dynamic(
  () => import("@/components/maps/TripRouteLeafletMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <p className="text-sm font-bold text-slate-500">
          Cargando ruta...
        </p>
      </div>
    ),
  }
);

export function TripRouteMap({
  origin,
  destination,
  routePoints,
}: TripRouteMapProps) {
  return (
    <div className="h-[360px] overflow-hidden rounded-[1.7rem] border border-slate-200 bg-slate-100">
      <TripRouteLeafletMap
        origin={origin}
        destination={destination}
        routePoints={routePoints}
      />
    </div>
  );
}
