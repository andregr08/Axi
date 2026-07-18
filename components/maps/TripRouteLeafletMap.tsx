"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type {
  RouteCoordinates,
  RoutePoint,
} from "@/components/maps/TripRouteMap";
import "leaflet/dist/leaflet.css";

type TripRouteLeafletMapProps = {
  origin: RouteCoordinates;
  destination: RouteCoordinates;
  routePoints: RoutePoint[];
};

function FitRoute({
  origin,
  destination,
  routePoints,
}: TripRouteLeafletMapProps) {
  const map = useMap();

  useEffect(() => {
    const points =
      routePoints.length > 0
        ? routePoints.map(
            (point) =>
              [point.lat, point.lng] as [
                number,
                number
              ]
          )
        : [
            [
              origin.latitude,
              origin.longitude,
            ] as [number, number],
            [
              destination.latitude,
              destination.longitude,
            ] as [number, number],
          ];

    map.fitBounds(points, {
      padding: [45, 45],
      maxZoom: 16,
    });
  }, [
    map,
    origin,
    destination,
    routePoints,
  ]);

  return null;
}

export default function TripRouteLeafletMap({
  origin,
  destination,
  routePoints,
}: TripRouteLeafletMapProps) {
  const polylinePoints = routePoints.map(
    (point) =>
      [point.lat, point.lng] as [
        number,
        number
      ]
  );

  return (
    <MapContainer
      center={[
        origin.latitude,
        origin.longitude,
      ]}
      zoom={14}
      scrollWheelZoom
      className="h-full w-full"
    >
      <FitRoute
        origin={origin}
        destination={destination}
        routePoints={routePoints}
      />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {polylinePoints.length > 1 && (
        <Polyline
          positions={polylinePoints}
          pathOptions={{
            color: "#0f172a",
            weight: 6,
            opacity: 0.9,
          }}
        />
      )}

      <CircleMarker
        center={[
          origin.latitude,
          origin.longitude,
        ]}
        radius={10}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 4,
        }}
      >
        <Popup>Punto de partida</Popup>
      </CircleMarker>

      <CircleMarker
        center={[
          destination.latitude,
          destination.longitude,
        ]}
        radius={10}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#facc15",
          fillOpacity: 1,
          weight: 4,
        }}
      >
        <Popup>Destino</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
