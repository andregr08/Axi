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
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  nextInstruction: string | null;
  nextManeuver: string | null;
  nextStepDistanceText: string | null;
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
  navigationMode?: boolean;
  driverHeading?: number | null;
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

type NavigationRouteStep = {
  instruction: string | null;
  maneuver: string | null;
  distanceMeters: number;
  path: MapCoordinates[];
  end: MapCoordinates | null;
};

type NavigationRouteSnapshot = {
  distanceMeters: number;
  durationSeconds: number;
  path: MapCoordinates[];
  steps: NavigationRouteStep[];
};

function toMapCoordinates(
  value:
    | google.maps.LatLng
    | google.maps.LatLngLiteral
    | null
    | undefined
): MapCoordinates | null {
  if (!value) {
    return null;
  }

  const latitude =
    typeof value.lat === "function"
      ? value.lat()
      : Number(value.lat);

  const longitude =
    typeof value.lng === "function"
      ? value.lng()
      : Number(value.lng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    lat: latitude,
    lng: longitude,
  };
}

function calculateDistanceMeters(
  first: MapCoordinates,
  second: MapCoordinates
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDelta = toRadians(
    second.lat - first.lat
  );

  const longitudeDelta = toRadians(
    second.lng - first.lng
  );

  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.asin(Math.min(1, Math.sqrt(haversine)))
  );
}

function distanceToPathMeters(
  position: MapCoordinates,
  path: MapCoordinates[]
) {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let shortestDistance =
    Number.POSITIVE_INFINITY;

  const samplingStep = Math.max(
    1,
    Math.floor(path.length / 250)
  );

  for (
    let index = 0;
    index < path.length;
    index += samplingStep
  ) {
    shortestDistance = Math.min(
      shortestDistance,
      calculateDistanceMeters(
        position,
        path[index]
      )
    );
  }

  shortestDistance = Math.min(
    shortestDistance,
    calculateDistanceMeters(
      position,
      path[path.length - 1]
    )
  );

  return shortestDistance;
}

function cleanDirectionsInstruction(
  instruction: string | null | undefined
) {
  if (!instruction) {
    return null;
  }

  const documentResult = new DOMParser().
    parseFromString(instruction, "text/html");

  return (
    documentResult.body.textContent?.
      replace(/\s+/g, " ").
      trim() || null
  );
}

function formatRouteDistance(
  distanceMeters: number
) {
  const safeDistance = Math.max(
    0,
    distanceMeters
  );

  return safeDistance < 1000
    ? `${Math.round(safeDistance)} m`
    : `${(safeDistance / 1000).toFixed(1)} km`;
}

function formatRouteDuration(
  durationSeconds: number
) {
  const durationMinutes = Math.max(
    1,
    Math.ceil(
      Math.max(0, durationSeconds) / 60
    )
  );

  return durationMinutes < 60
    ? `${durationMinutes} min`
    : `${Math.floor(durationMinutes / 60)} h ${
        durationMinutes % 60
      } min`;
}

function RouteRenderer({
  origin,
  destination,
  currentLocation,
  navigationMode,
  onMetricsChange,
}: {
  origin: MapCoordinates;
  destination: MapCoordinates;
  currentLocation?: MapCoordinates | null;
  navigationMode: boolean;
  onMetricsChange?: (
    metrics: RouteMetrics | null
  ) => void;
}) {
  const map = useMap();
  const routesLibrary =
    useMapsLibrary("routes");

  const polylinesRef =
    useRef<google.maps.Polyline[]>([]);

  const routeSnapshotRef =
    useRef<NavigationRouteSnapshot | null>(
      null
    );

  const lastRouteRequestRef = useRef<{
    origin: MapCoordinates;
    destination: MapCoordinates;
    requestedAt: number;
  } | null>(null);

  const requestSequenceRef = useRef(0);

  const emitNavigationMetrics = useCallback(
    (
      position:
        | MapCoordinates
        | null
        | undefined
    ) => {
      const snapshot =
        routeSnapshotRef.current;

      if (!snapshot) {
        return;
      }

      let activeStepIndex = 0;

      if (
        isValidCoordinate(position) &&
        snapshot.steps.length > 0
      ) {
        let nearestDistance =
          Number.POSITIVE_INFINITY;

        snapshot.steps.forEach(
          (step, index) => {
            const stepDistance =
              distanceToPathMeters(
                position,
                step.path
              );

            if (
              stepDistance <
              nearestDistance
            ) {
              nearestDistance =
                stepDistance;

              activeStepIndex = index;
            }
          }
        );

        const selectedStep =
          snapshot.steps[activeStepIndex];

        if (
          selectedStep?.end &&
          activeStepIndex <
            snapshot.steps.length - 1 &&
          calculateDistanceMeters(
            position,
            selectedStep.end
          ) <= 25
        ) {
          activeStepIndex += 1;
        }
      }

      const activeStep =
        snapshot.steps[activeStepIndex] ??
        null;

      let remainingDistance =
        snapshot.distanceMeters;

      if (
        activeStep &&
        isValidCoordinate(position)
      ) {
        const currentStepRemaining =
          activeStep.end
            ? calculateDistanceMeters(
                position,
                activeStep.end
              )
            : activeStep.distanceMeters;

        const followingStepsDistance =
          snapshot.steps
            .slice(activeStepIndex + 1)
            .reduce(
              (total, step) =>
                total +
                step.distanceMeters,
              0
            );

        remainingDistance = Math.min(
          snapshot.distanceMeters,
          Math.max(
            0,
            currentStepRemaining +
              followingStepsDistance
          )
        );
      }

      const remainingRatio =
        snapshot.distanceMeters > 0
          ? Math.min(
              1,
              remainingDistance /
                snapshot.distanceMeters
            )
          : 1;

      const remainingDurationSeconds =
        Math.max(
          0,
          Math.round(
            snapshot.durationSeconds *
              remainingRatio
          )
        );

      const distanceToNextStep =
        activeStep?.end &&
        isValidCoordinate(position)
          ? calculateDistanceMeters(
              position,
              activeStep.end
            )
          : activeStep?.distanceMeters ??
            null;

      onMetricsChange?.({
        distanceMeters:
          remainingDistance,
        distanceText:
          formatRouteDistance(
            remainingDistance
          ),
        durationSeconds:
          remainingDurationSeconds,
        durationText:
          formatRouteDuration(
            remainingDurationSeconds
          ),
        nextInstruction:
          activeStep?.instruction ?? null,
        nextManeuver:
          activeStep?.maneuver ?? null,
        nextStepDistanceText:
          distanceToNextStep === null
            ? null
            : formatRouteDistance(
                distanceToNextStep
              ),
      });
    },
    [onMetricsChange]
  );

  useEffect(() => {
    emitNavigationMetrics(
      currentLocation ?? origin
    );
  }, [
    currentLocation?.lat,
    currentLocation?.lng,
    emitNavigationMetrics,
    origin.lat,
    origin.lng,
  ]);

  useEffect(() => {
    if (!map || !routesLibrary) {
      return;
    }

    const requestOrigin =
      isValidCoordinate(currentLocation)
        ? currentLocation
        : origin;

    const previousRequest =
      lastRouteRequestRef.current;

    const now = Date.now();

    const destinationChanged =
      previousRequest
        ? calculateDistanceMeters(
            destination,
            previousRequest.destination
          ) > 5
        : true;

    const movedSinceLastRequest =
      previousRequest
        ? calculateDistanceMeters(
            requestOrigin,
            previousRequest.origin
          )
        : Number.POSITIVE_INFINITY;

    const existingPath =
      routeSnapshotRef.current?.path ?? [];

    const distanceOutsideRoute =
      existingPath.length > 0
        ? distanceToPathMeters(
            requestOrigin,
            existingPath
          )
        : 0;

    const requestExpired =
      previousRequest
        ? now -
            previousRequest.requestedAt >=
          12000
        : true;

    const shouldRecalculate =
      !previousRequest ||
      destinationChanged ||
      movedSinceLastRequest >= 45 ||
      distanceOutsideRoute >= 35 ||
      requestExpired;

    if (!shouldRecalculate) {
      return;
    }

    lastRouteRequestRef.current = {
      origin: requestOrigin,
      destination,
      requestedAt: now,
    };

    requestSequenceRef.current += 1;
    const requestSequence =
      requestSequenceRef.current;

    void (async () => {
      try {
        const response =
          await routesLibrary.Route.computeRoutes({
            origin: requestOrigin,
            destination,
            travelMode: "DRIVING",
            routingPreference:
              "TRAFFIC_AWARE_OPTIMAL",
            trafficModel: "bestguess",
            language: "es-MX",
            region: "MX",
            extraComputations: [
              "TRAFFIC_ON_POLYLINE",
            ],
            fields: [
              "path",
              "distanceMeters",
              "durationMillis",
              "staticDurationMillis",
              "localizedValues",
              "legs",
              "speedPaths",
              "routeLabels",
            ],
          });

        if (
          requestSequence !==
          requestSequenceRef.current
        ) {
          return;
        }

        const route =
          response.routes?.[0];

        if (!route) {
          onMetricsChange?.(null);
          return;
        }

        const routePath = (
          route.path ?? []
        )
          .map((point) =>
            toMapCoordinates(point)
          )
          .filter(
            (
              point
            ): point is MapCoordinates =>
              point !== null
          );

        const steps: NavigationRouteStep[] =
          [];

        for (
          const leg of route.legs ?? []
        ) {
          for (
            const step of leg.steps ?? []
          ) {
            const stepPath = (
              step.path ?? []
            )
              .map((point) =>
                toMapCoordinates(point)
              )
              .filter(
                (
                  point
                ): point is MapCoordinates =>
                  point !== null
              );

            steps.push({
              instruction:
                cleanDirectionsInstruction(
                  step.instructions
                ),
              maneuver: step.maneuver
                ? String(step.maneuver)
                : null,
              distanceMeters:
                step.distanceMeters ?? 0,
              path: stepPath,
              end:
                stepPath[
                  stepPath.length - 1
                ] ?? null,
            });
          }
        }

        const distanceMeters =
          route.distanceMeters ??
          (route.legs ?? []).reduce(
            (total, leg) =>
              total +
              (leg.distanceMeters ?? 0),
            0
          );

        const durationSeconds =
          Math.max(
            0,
            Math.round(
              (route.durationMillis ?? 0) /
                1000
            )
          );

        routeSnapshotRef.current = {
          distanceMeters,
          durationSeconds,
          path: routePath,
          steps,
        };

        polylinesRef.current.forEach(
          (polyline) => {
            polyline.setMap(null);
          }
        );

        const newPolylines =
          route.createPolylines();

        newPolylines.forEach(
          (polyline) => {
            polyline.setMap(map);

            polyline.setOptions({
              strokeOpacity: 0.95,
              strokeWeight: 7,
              zIndex: 5,
            });
          }
        );

        polylinesRef.current =
          newPolylines;

        emitNavigationMetrics(
          currentLocation ??
            requestOrigin
        );
      } catch (error) {
        if (
          requestSequence !==
          requestSequenceRef.current
        ) {
          return;
        }

        console.error(
          "No fue posible calcular la navegación de Google:",
          error
        );

        lastRouteRequestRef.current =
          null;

        onMetricsChange?.(null);
      }
    })();
  }, [
    currentLocation?.lat,
    currentLocation?.lng,
    destination.lat,
    destination.lng,
    emitNavigationMetrics,
    map,
    navigationMode,
    onMetricsChange,
    origin.lat,
    origin.lng,
    routesLibrary,
  ]);

  useEffect(() => {
    return () => {
      requestSequenceRef.current += 1;

      polylinesRef.current.forEach(
        (polyline) => {
          polyline.setMap(null);
        }
      );

      polylinesRef.current = [];
    };
  }, []);

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

function FollowDriverCamera({
  active,
  driverLocation,
  heading,
}: {
  active: boolean;
  driverLocation?: MapCoordinates | null;
  heading?: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !map ||
      !active ||
      !isValidCoordinate(driverLocation)
    ) {
      return;
    }

    map.moveCamera({
      center: driverLocation,
      zoom: 17,
      heading:
        typeof heading === "number" &&
        Number.isFinite(heading)
          ? heading
          : map.getHeading() ?? 0,
      tilt: 45,
    });
  }, [
    active,
    driverLocation?.lat,
    driverLocation?.lng,
    heading,
    map,
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
  navigationMode,
  driverHeading,
  onRouteMetricsChange,
}: {
  origin?: MapCoordinates | null;
  destination?: MapCoordinates | null;
  driverLocation?: MapCoordinates | null;
  userLocation?: MapCoordinates | null;
  routeOrigin?: MapCoordinates | null;
  routeDestination?: MapCoordinates | null;
  showRoute: boolean;
  navigationMode: boolean;
  driverHeading?: number | null;
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
      {!navigationMode && (
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
      )}

      <FollowDriverCamera
        active={navigationMode}
        driverLocation={validDriverLocation}
        heading={driverHeading}
      />

      {showRoute &&
        validRouteOrigin &&
        validRouteDestination && (
          <RouteRenderer
            origin={validRouteOrigin}
            destination={validRouteDestination}
            currentLocation={validDriverLocation}
            navigationMode={navigationMode}
            onMetricsChange={onRouteMetricsChange}
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
  navigationMode = false,
  driverHeading = null,
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

  const [routeMetrics, setRouteMetrics] =
    useState<RouteMetrics | null>(null);

  const handleRouteMetricsChange = useCallback(
    (metrics: RouteMetrics | null) => {
      setRouteMetrics(metrics);
      onRouteMetricsChange?.(metrics);
    },
    [onRouteMetricsChange]
  );

  // AXI TURN-BY-TURN VOICE
  const spokenInstructionRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (!navigationMode) {
      spokenInstructionRef.current = null;

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }

      return;
    }

    const instruction =
      routeMetrics?.nextInstruction;

    if (
      !instruction ||
      spokenInstructionRef.current ===
        instruction ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    spokenInstructionRef.current =
      instruction;

    const spokenDistance =
      routeMetrics?.
        nextStepDistanceText;

    const utterance =
      new SpeechSynthesisUtterance(
        spokenDistance
          ? `${spokenDistance}. ${instruction}`
          : instruction
      );

    utterance.lang = "es-MX";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(
      utterance
    );
  }, [
    navigationMode,
    routeMetrics?.nextInstruction,
    routeMetrics?.nextStepDistanceText,
  ]);
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
        language="es"
        region="MX"
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
            navigationMode={navigationMode}
            driverHeading={driverHeading}
            onRouteMetricsChange={
              handleRouteMetricsChange
            }
          />
        </Map>
      </APIProvider>

      {navigationMode && (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 rounded-3xl border border-white/70 bg-[#0B0F19]/95 p-4 text-white shadow-2xl backdrop-blur-xl sm:left-6 sm:right-auto sm:min-w-[340px] sm:top-6">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <Navigation size={23} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
                Navegación AXI
              </p>

              <p className="mt-1 break-words text-base font-black leading-5">
                {routeMetrics?.nextInstruction ??
                  routeLabel}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-300">
                <span>
                  {routeMetrics?.nextStepDistanceText ??
                    "Calculando indicación"}
                </span>

                <span>
                  {routeMetrics?.distanceText ??
                    "Calculando distancia"}
                </span>

                <span>
                  {routeMetrics?.durationText ??
                    "Calculando llegada"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`pointer-events-none absolute left-4 top-4 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl sm:left-6 sm:top-6 ${navigationMode ? "hidden" : ""}`}>
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
