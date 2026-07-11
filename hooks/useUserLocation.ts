"use client";

import { useCallback, useEffect, useState } from "react";

export type UserCoordinates = {
  lat: number;
  lng: number;
};

type LocationState = {
  coordinates: UserCoordinates | null;
  loading: boolean;
  error: string | null;
};

const PUEBLA_CENTER: UserCoordinates = {
  lat: 19.0414,
  lng: -98.2063,
};

export function useUserLocation() {
  const [state, setState] = useState<LocationState>({
    coordinates: null,
    loading: true,
    error: null,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        coordinates: PUEBLA_CENTER,
        loading: false,
        error: "Este dispositivo no permite obtener la ubicación.",
      });
      return;
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          loading: false,
          error: null,
        });
      },
      () => {
        setState({
          coordinates: PUEBLA_CENTER,
          loading: false,
          error: "No se autorizó la ubicación. Mostrando Puebla.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return {
    ...state,
    requestLocation,
  };
}
