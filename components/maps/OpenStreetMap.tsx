"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Coordinates = {
  lat: number;
  lng: number;
};

type OpenStreetMapProps = {
  center: Coordinates;
};

const previewDrivers = [
  { id: "driver-1", lat: 19.0475, lng: -98.2002 },
  { id: "driver-2", lat: 19.0369, lng: -98.2118 },
  { id: "driver-3", lat: 19.0524, lng: -98.2187 },
];

function RecenterMap({
  center,
}: {
  center: Coordinates;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(
      [center.lat, center.lng],
      map.getZoom()
    );
  }, [center, map]);

  return null;
}

export default function OpenStreetMap({
  center,
}: OpenStreetMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      scrollWheelZoom
      zoomControl
      className="h-full w-full"
    >
      <RecenterMap center={center} />

      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <CircleMarker
        center={[center.lat, center.lng]}
        radius={10}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#facc15",
          fillOpacity: 1,
          weight: 4,
        }}
      >
        <Popup>Tu ubicación</Popup>
      </CircleMarker>

      {previewDrivers.map((driver) => (
        <CircleMarker
          key={driver.id}
          center={[driver.lat, driver.lng]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#0f172a",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>Conductor AXI cercano</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
