"use client";

import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  CarFront,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useUserLocation } from "@/hooks/useUserLocation";

export type MapCoordinates = {
  lat: number;
  lng: number;
};

export type RouteMetrics = {
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
};

type GoogleMapViewProps = {
  origin?: MapCoordinates | null;
  destination?: MapCoordinates | null;
  driverLocation?: MapCoordinates | null;

  /*
   * routeOrigin y routeDestination permiten
   * dibujar una ruta distinta a los marcadores
   * generales del viaje.
   */
  routeOrigin?: MapCoordinates | null;
  routeDestination?: MapCoordinates | null;
  routeLabel?: string;

  onRouteMetricsChange?: (
    metrics: RouteMetrics | null
  ) => void;

  showUserLocation?: boolean;
  showRoute?: boolean;
  heightClassName?: string;
  className?: string;
};

const PUEBLA_CENTER: MapCoordinates = {
  lat: 19.0414,
  lng: -98.2063,
};

function isValidCoordinate(
  value: MapCoordinates | null | undefined
): value is MapCoordinates {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng)
  );
}

function RouteRenderer({
  origin,
  destination,
  onMetricsChange,
}: {
  origin: MapCoordinates;
  destination: MapCoordinates;
  onMetricsChange?: (
    metrics: RouteMetrics | null
  ) => void;
}) {
  const map = useMap();
  const routesLibrary =
    useMapsLibrary("routes");

  useEffect(() => {
    if (!map || !routesLibrary) {
      return;
    }

    const directionsService =
      new routesLibrary.DirectionsService();

    const directionsRenderer =
      new routesLibrary.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#111827",
          strokeOpacity: 0.92,
          strokeWeight: 6,
        },
      });

    let cancelled = false;

    /*
     * Pequeño retraso para evitar varias llamadas
     * mientras Realtime está moviendo el marcador.
     */
    const timer = window.setTimeout(
      async () => {
        try {
          const result =
            await directionsService.route({
              origin,
              destination,
              travelMode:
                google.maps.TravelMode.DRIVING,
              provideRouteAlternatives: false,
            });

          if (cancelled) {
            return;
          }

          directionsRenderer.setDirections(
            result
          );

          const route =
            result.routes[0];

          if (!route) {
            onMetricsChange?.(null);
            return;
          }

          const totals = route.legs.reduce(
            (accumulator, leg) => {
              accumulator.distanceMeters +=
                leg.distance?.value ?? 0;

              accumulator.durationSeconds +=
                leg.duration?.value ?? 0;

              return accumulator;
            },
            {
              distanceMeters: 0,
              durationSeconds: 0,
            }
          );

          const distanceText =
            totals.distanceMeters < 1000
              ? `${Math.round(
                  totals.distanceMeters
                )} m`
              : `${(
                  totals.distanceMeters / 1000
                ).toFixed(1)} km`;

          const durationMinutes =
            Math.max(
              1,
              Math.ceil(
                totals.durationSeconds / 60
              )
            );

          const durationText =
            durationMinutes < 60
              ? `${durationMinutes} min`
              : `${Math.floor(
                  durationMinutes / 60
                )} h ${durationMinutes % 60} min`;

          onMetricsChange?.({
            distanceMeters:
              totals.distanceMeters,
            distanceText,
            durationSeconds:
              totals.durationSeconds,
            durationText,
          });
        } catch (error) {
          if (!cancelled) {
            console.error(
              "No fue posible calcular la ruta:",
              error
            );

            onMetricsChange?.(null);
          }
        }
      },
      750
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      directionsRenderer.setMap(null);
    };
  }, [
    destination.lat,
    destination.lng,
    map,
    onMetricsChange,
    origin.lat,
    origin.lng,
    routesLibrary,
  ]);

  return null;
}

function FitMapBounds({
  origin,
  destination,
  driverLocation,
  userLocation,
  routeOrigin,
  routeDestination,
}: {
  origin?: MapCoordinates | null;
  destination?: MapCoordinates | null;
  driverLocation?: MapCoordinates | null;
  userLocation?: MapCoordinates | null;
  routeOrigin?: MapCoordinates | null;
  routeDestination?: MapCoordinates | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      return;
    }

    const preferredPositions = [
      routeOrigin,
      routeDestination,
    ].filter(isValidCoordinate);

    const positions =
      preferredPositions.length > 0
        ? preferredPositions
        : [
            origin,
            destination,
            driverLocation,
            userLocation,
          ].filter(isValidCoordinate);

    if (positions.length === 0) {
      return;
    }

    if (positions.length === 1) {
      map.panTo(positions[0]);
      map.setZoom(15);
      return;
    }

    const bounds =
      new google.maps.LatLngBounds();

    positions.forEach((position) => {
      bounds.extend(position);
    });

    map.fitBounds(bounds, 75);
  }, [
    destination,
    driverLocation,
    map,
    origin,
    routeDestination,
    routeOrigin,
    userLocation,
  ]);

  return null;
}

function LocationMarker({
  position,
  type,
  title,
}: {
  position: MapCoordinates;
  type:
    | "user"
    | "origin"
    | "destination"
    | "driver";
  title: string;
}) {
  const markerClasses = {
    user:
      "border-blue-500 bg-blue-600 text-white",
    origin:
      "border-emerald-500 bg-emerald-500 text-white",
    destination:
      "border-yellow-500 bg-yellow-400 text-black",
    driver:
      "border-slate-950 bg-slate-950 text-yellow-400",
  };

  const icon =
    type === "driver" ? (
      <CarFront size={19} />
    ) : type === "destination" ? (
      <Navigation size={18} />
    ) : type === "origin" ? (
      <MapPin size={18} />
    ) : (
      <LocateFixed size={18} />
    );

  return (
    <AdvancedMarker
      position={position}
      title={title}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border-4 border-white shadow-xl transition-transform duration-500 ${markerClasses[type]}`}
      >
        {icon}
      </div>
    </AdvancedMarker>
  );
}

function MapContent({
  origin,
  destination,
  driverLocation,
  userLocation,
  routeOrigin,
  routeDestination,
  showRoute,
  onRouteMetricsChange,
}: {
  origin?: MapCoordinates | null;
  destination?: MapCoordinates | null;
  driverLocation?: MapCoordinates | null;
  userLocation?: MapCoordinates | null;
  routeOrigin?: MapCoordinates | null;
  routeDestination?: MapCoordinates | null;
  showRoute: boolean;
  onRouteMetricsChange?: (
    metrics: RouteMetrics | null
  ) => void;
}) {
  const validOrigin =
    isValidCoordinate(origin)
      ? origin
      : null;

  const validDestination =
    isValidCoordinate(destination)
      ? destination
      : null;

  const validDriverLocation =
    isValidCoordinate(driverLocation)
      ? driverLocation
      : null;

  const validUserLocation =
    isValidCoordinate(userLocation)
      ? userLocation
      : null;

  const validRouteOrigin =
    isValidCoordinate(routeOrigin)
      ? routeOrigin
      : validOrigin;

  const validRouteDestination =
    isValidCoordinate(routeDestination)
      ? routeDestination
      : validDestination;

  return (
    <>
      <FitMapBounds
        origin={validOrigin}
        destination={validDestination}
        driverLocation={
          validDriverLocation
        }
        userLocation={validUserLocation}
        routeOrigin={validRouteOrigin}
        routeDestination={
          validRouteDestination
        }
      />

      {showRoute &&
        validRouteOrigin &&
        validRouteDestination && (
          <RouteRenderer
            origin={validRouteOrigin}
            destination={
              validRouteDestination
            }
            onMetricsChange={
              onRouteMetricsChange
            }
          />
        )}

      {validUserLocation && (
        <LocationMarker
          position={validUserLocation}
          type="user"
          title="Tu ubicación actual"
        />
      )}

      {validOrigin && (
        <LocationMarker
          position={validOrigin}
          type="origin"
          title="Punto de partida"
        />
      )}

      {validDestination && (
        <LocationMarker
          position={validDestination}
          type="destination"
          title="Destino"
        />
      )}

      {validDriverLocation && (
        <LocationMarker
          position={validDriverLocation}
          type="driver"
          title="Conductor AXI"
        />
      )}
    </>
  );
}

export function GoogleMapView({
  origin = null,
  destination = null,
  driverLocation = null,
  routeOrigin = null,
  routeDestination = null,
  routeLabel = "Ruta del viaje",
  onRouteMetricsChange,
  showUserLocation = true,
  showRoute = true,
  heightClassName = "h-[520px]",
  className = "",
}: GoogleMapViewProps) {
  const apiKey =
    process.env
      .NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const mapId =
    process.env
      .NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ||
    "DEMO_MAP_ID";

  const {
    coordinates,
    loading,
    error,
    requestLocation,
  } = useUserLocation();

  const [locationRequested, setLocationRequested] =
    useState(false);

  const userLocation = useMemo(
    () =>
      showUserLocation && coordinates
        ? {
            lat: coordinates.lat,
            lng: coordinates.lng,
          }
        : null,
    [
      coordinates,
      showUserLocation,
    ]
  );

  const center = useMemo(() => {
    if (isValidCoordinate(driverLocation)) {
      return driverLocation;
    }

    if (isValidCoordinate(origin)) {
      return origin;
    }

    if (isValidCoordinate(userLocation)) {
      return userLocation;
    }

    if (isValidCoordinate(destination)) {
      return destination;
    }

    return PUEBLA_CENTER;
  }, [
    destination,
    driverLocation,
    origin,
    userLocation,
  ]);

  function handleRequestLocation() {
    setLocationRequested(true);
    requestLocation();
  }

  if (!apiKey) {
    return (
      <div
        className={`relative flex ${heightClassName} items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.22),_transparent_30%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)] ${className}`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.55)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,0.55)_2px,transparent_2px)] bg-[size:55px_55px] opacity-60" />

        <div className="relative max-w-md px-6 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-[#0B0F19] text-yellow-400 shadow-2xl">
            <MapPin size={34} />
          </span>

          <h3 className="mt-6 text-2xl font-black text-slate-950">
            Google Maps no está configurado
          </h3>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Agrega la clave pública de Google
            Maps para mostrar ubicaciones y
            rutas reales.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800">
            <AlertTriangle size={15} />
            Falta la clave de Google Maps
          </div>
        </div>
      </div>
    );
  }

  const hasRoute =
    isValidCoordinate(
      routeOrigin ?? origin
    ) &&
    isValidCoordinate(
      routeDestination ?? destination
    );

  return (
    <div
      className={`relative ${heightClassName} overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.10)] ${className}`}
    >
      <APIProvider
        apiKey={apiKey}
        libraries={["places"]}
      >
        <Map
          defaultCenter={center}
          defaultZoom={14}
          mapId={mapId}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-full w-full"
        >
          <MapContent
            origin={origin}
            destination={destination}
            driverLocation={
              driverLocation
            }
            userLocation={userLocation}
            routeOrigin={routeOrigin}
            routeDestination={
              routeDestination
            }
            showRoute={showRoute}
            onRouteMetricsChange={
              onRouteMetricsChange
            }
          />
        </Map>
      </APIProvider>

      <div className="pointer-events-none absolute left-4 top-4 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl sm:left-6 sm:top-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            {hasRoute ? (
              <Route size={21} />
            ) : (
              <MapPin size={21} />
            )}
          </span>

          <div>
            <p className="font-black text-slate-950">
              {hasRoute
                ? routeLabel
                : "Mapa AXI"}
            </p>

            <p className="text-xs text-slate-500">
              {hasRoute
                ? "Seguimiento actualizado en vivo"
                : "Ubicación en tiempo real"}
            </p>
          </div>
        </div>
      </div>

      {showUserLocation && (
        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={loading}
          aria-label="Actualizar mi ubicación"
          className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B0F19] text-yellow-400 shadow-xl transition hover:scale-105 disabled:opacity-60"
        >
          <LocateFixed
            size={21}
            className={
              loading
                ? "animate-pulse"
                : ""
            }
          />
        </button>
      )}

      {error && locationRequested && (
        <div className="absolute bottom-5 left-5 max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-xs font-semibold text-slate-600 shadow-xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
