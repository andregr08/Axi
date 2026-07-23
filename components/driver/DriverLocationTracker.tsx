"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, LocateFixed } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type DriverLocation = {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number;
};

type DriverLocationTrackerProps = {
  enabled: boolean;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_UPLOAD_INTERVAL_MS = 5_000;

export function DriverLocationTracker({
  enabled,
}: DriverLocationTrackerProps) {
  const [driverOnline, setDriverOnline] =
    useState(false);

  const [gpsError, setGpsError] =
    useState("");

  const watchId =
    useRef<number | null>(null);

  const heartbeatId =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const sessionRefreshId =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const latestLocation =
    useRef<DriverLocation | null>(null);

  const lastUploadAt =
    useRef(0);

  const uploadInProgress =
    useRef(false);

  const mounted =
    useRef(true);

  const uploadLocation = useCallback(
    async (
      location: DriverLocation,
      force = false
    ) => {
      const now = Date.now();

      if (
        !force &&
        now - lastUploadAt.current <
          MIN_UPLOAD_INTERVAL_MS
      ) {
        return;
      }

      if (uploadInProgress.current) {
        return;
      }

      uploadInProgress.current = true;

      try {
        let {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          const refreshResult =
            await supabase.auth.refreshSession();

          session =
            refreshResult.data.session;

          if (
            refreshResult.error ||
            !session
          ) {
            throw new Error(
              "Tu sesión terminó. Vuelve a iniciar sesión."
            );
          }
        }

        const { error } =
          await supabase.rpc(
            "update_driver_location",
            {
              latitude_value:
                location.latitude,
              longitude_value:
                location.longitude,
              speed_value:
                location.speed,
              heading_value:
                location.heading,
              accuracy_value:
                location.accuracy,
            }
          );

        if (error) {
          throw error;
        }

        lastUploadAt.current =
          Date.now();

        if (mounted.current) {
          setGpsError("");
        }
      } catch (error) {
        console.error(
          "[AXI GPS] Error enviando ubicación:",
          error
        );

        if (mounted.current) {
          setGpsError(
            error instanceof Error
              ? error.message
              : "No se pudo actualizar tu ubicación."
          );
        }
      } finally {
        uploadInProgress.current =
          false;
      }
    },
    []
  );

  const handlePosition =
    useCallback(
      (
        position: GeolocationPosition,
        force = false
      ) => {
        const location: DriverLocation = {
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
          speed:
            position.coords.speed,
          heading:
            position.coords.heading,
          accuracy:
            position.coords.accuracy,
        };

        latestLocation.current =
          location;

        void uploadLocation(
          location,
          force
        );
      },
      [uploadLocation]
    );

  const handleLocationError =
    useCallback(
      (
        error: GeolocationPositionError
      ) => {
        let message =
          "No se pudo obtener tu ubicación.";

        if (
          error.code ===
          GeolocationPositionError.PERMISSION_DENIED
        ) {
          message =
            "Permite el acceso a tu ubicación para seguir recibiendo viajes.";
        } else if (
          error.code ===
          GeolocationPositionError.POSITION_UNAVAILABLE
        ) {
          message =
            "Activa el GPS de tu dispositivo para seguir recibiendo viajes.";
        } else if (
          error.code ===
          GeolocationPositionError.TIMEOUT
        ) {
          message =
            "El GPS tardó demasiado. AXI volverá a intentarlo automáticamente.";
        }

        console.error(
          "[AXI GPS]",
          error.message
        );

        if (mounted.current) {
          setGpsError(message);
        }
      },
      []
    );

  const requestFreshLocation =
    useCallback(() => {
      if (
        !navigator.geolocation ||
        !driverOnline
      ) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) =>
          handlePosition(
            position,
            true
          ),
        handleLocationError,
        {
          enableHighAccuracy: false,
          timeout: 60_000,
          maximumAge: 30_000,
        }
      );
    }, [
      driverOnline,
      handleLocationError,
      handlePosition,
    ]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDriverOnline(false);
      return;
    }

    let channel:
      | ReturnType<
          typeof supabase.channel
        >
      | null = null;

    let cancelled = false;

    async function loadDriverState() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session || cancelled) {
        return;
      }

      const { data, error } =
        await supabase
          .from("drivers")
          .select("online")
          .eq(
            "id",
            session.user.id
          )
          .single();

      if (error) {
        console.error(
          "[AXI GPS] Error cargando estado:",
          error.message
        );
        return;
      }

      if (!cancelled) {
        setDriverOnline(
          Boolean(data.online)
        );
      }

      channel = supabase
        .channel(
          `global-driver-gps-${session.user.id}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
            filter: `id=eq.${session.user.id}`,
          },
          (payload) => {
            const driver =
              payload.new as {
                online?: boolean;
              };

            setDriverOnline(
              Boolean(driver.online)
            );
          }
        )
        .subscribe();
    }

    void loadDriverState();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(
          channel
        );
      }
    };
  }, [enabled]);

  useEffect(() => {
    function clearTracking() {
      if (
        watchId.current !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          watchId.current
        );

        watchId.current = null;
      }

      if (
        heartbeatId.current !== null
      ) {
        clearInterval(
          heartbeatId.current
        );

        heartbeatId.current = null;
      }

      if (
        sessionRefreshId.current !==
        null
      ) {
        clearInterval(
          sessionRefreshId.current
        );

        sessionRefreshId.current =
          null;
      }
    }

    if (
      !enabled ||
      !driverOnline
    ) {
      clearTracking();
      latestLocation.current = null;
      lastUploadAt.current = 0;
      setGpsError("");
      return clearTracking;
    }

    if (!navigator.geolocation) {
      setGpsError(
        "Este navegador no permite utilizar tu ubicación."
      );

      return clearTracking;
    }

    requestFreshLocation();

    watchId.current =
      navigator.geolocation.watchPosition(
        (position) =>
          handlePosition(position),
        handleLocationError,
        {
          enableHighAccuracy: false,
          timeout: 60_000,
          maximumAge: 30_000,
        }
      );

    heartbeatId.current =
      setInterval(() => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        if (
          latestLocation.current
        ) {
          void uploadLocation(
            latestLocation.current,
            true
          );
        } else {
          requestFreshLocation();
        }
      }, HEARTBEAT_INTERVAL_MS);

    sessionRefreshId.current =
      setInterval(() => {
        void supabase.auth
          .refreshSession()
          .then(({ error }) => {
            if (error) {
              console.error(
                "[AXI GPS] Error renovando sesión:",
                error.message
              );
            }
          });
      }, 10 * 60_000);

    function handleAppActive() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        requestFreshLocation();
      }
    }

    function handleConnectionRestored() {
      requestFreshLocation();
    }

    document.addEventListener(
      "visibilitychange",
      handleAppActive
    );

    window.addEventListener(
      "focus",
      handleAppActive
    );

    window.addEventListener(
      "pageshow",
      handleAppActive
    );

    window.addEventListener(
      "online",
      handleConnectionRestored
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleAppActive
      );

      window.removeEventListener(
        "focus",
        handleAppActive
      );

      window.removeEventListener(
        "pageshow",
        handleAppActive
      );

      window.removeEventListener(
        "online",
        handleConnectionRestored
      );

      clearTracking();
    };
  }, [
    driverOnline,
    enabled,
    handleLocationError,
    handlePosition,
    requestFreshLocation,
    uploadLocation,
  ]);

  if (
    !enabled ||
    !driverOnline
  ) {
    return null;
  }

  if (gpsError) {
    return (
      <div className="fixed bottom-24 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-4 shadow-xl lg:bottom-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-50 p-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div>
            <p className="font-semibold text-slate-950">
              Problema con tu ubicación
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {gpsError}
            </p>

            <button
              type="button"
              onClick={
                requestFreshLocation
              }
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              <LocateFixed className="h-4 w-4" />
              Reintentar GPS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
