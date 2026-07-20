"use client";

import { useLanguage } from "@/hooks/useLanguage";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CarFront,
  Clock3,
  LoaderCircle,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type SharedTripStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type SharedTrip = {
  trip_id: string;
  status: SharedTripStatus;
  origin_address: string;
  destination_address: string;
  driver_name: string | null;
  driver_rating: number | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plates: string | null;
  vehicle_economic_number: string | null;
  eta_minutes: number | null;
  current_lat: number | null;
  current_lng: number | null;
  updated_at: string | null;
};

const statusLabels: Record<SharedTripStatus, string> = {
  requested: "Viaje solicitado",
  searching: "Buscando conductor",
  accepted: "Conductor asignado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor en el punto de origen",
  in_progress: "Viaje en curso",
  completed: "Viaje completado",
  cancelled: "Viaje cancelado",
};

const activeStatuses: SharedTripStatus[] = [
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

export function PublicTripTracker({
  token,
}: {
  token: string;
}) {
  const { t } = useLanguage();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const loadSharedTrip = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const { data, error } = await supabase.rpc(
        "get_shared_trip_by_token",
        {
          share_token: token,
        }
      );

      if (error) {
        setTrip(null);

        if (
          error.message
            .toLowerCase()
            .includes("could not find the function")
        ) {
          setMessage(
            "El seguimiento seguro estÃ¡ preparado, pero todavÃ­a falta conectar el servicio en Supabase."
          );
        } else {
          setMessage(
            "Este enlace no existe, expirÃ³ o ya no estÃ¡ disponible."
          );
        }

        setLoading(false);
        setRefreshing(false);
        return;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      if (!result) {
        setTrip(null);
        setMessage(
          "Este enlace no existe, expirÃ³ o ya no estÃ¡ disponible."
        );
      } else {
        setTrip(result as SharedTrip);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [token]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSharedTrip();

    const interval = window.setInterval(() => {
      void loadSharedTrip(true);
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadSharedTrip]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
            <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F6F8] px-4 py-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-amber-100 text-amber-700">
            <AlertTriangle size={34} />
          </span>

          <h1 className="mt-6 text-3xl font-black text-slate-950">
            Seguimiento no disponible
          </h1>

          <p className="mt-4 text-sm leading-7 text-slate-500">
            {message}
          </p>

          <button
            type="button"
            onClick={() => loadSharedTrip()}
            className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <RefreshCw size={18} />
            Intentar nuevamente
          </button>

          <p className="mt-6 text-xs leading-5 text-slate-400">
            AXI protege la informaciÃ³n de pasajeros y conductores mediante
            enlaces temporales.
          </p>
        </div>
      </main>
    );
  }

  const active = activeStatuses.includes(trip.status);

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-9 sm:py-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                <ShieldCheck size={15} />
                Seguimiento protegido
              </span>

              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
                {statusLabels[trip.status]}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Esta pÃ¡gina permite consultar el avance del viaje sin mostrar
                informaciÃ³n privada innecesaria.
              </p>
            </div>

            <div className="rounded-[1.7rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Tiempo estimado
              </p>

              <div className="mt-3 flex items-center gap-3">
                <Clock3 size={25} className="text-yellow-400" />

                <p className="text-3xl font-black">
                  {trip.eta_minutes !== null
                    ? `${trip.eta_minutes} min`
                    : "Calculando"}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                {refreshing ? (
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      active
                        ? "bg-emerald-400"
                        : "bg-slate-500"
                    )}
                  />
                )}

                {refreshing
                  ? "Actualizando..."
                  : active
                    ? "Seguimiento activo"
                    : "Seguimiento finalizado"}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.22),_transparent_30%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)] shadow-lg">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.55)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,0.55)_2px,transparent_2px)] bg-[size:55px_55px] opacity-60" />

            <div className="relative max-w-md px-6 text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl">
                <Navigation size={35} />
              </span>

              <h2 className="mt-6 text-2xl font-black text-slate-950">
                Ubicación del viaje
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                El mapa mostrarÃ¡ la posiciÃ³n del taxi y la ruta cuando Gali
                conecte Google Maps y el historial de ubicaciones.
              </p>

              {trip.current_lat !== null &&
                trip.current_lng !== null && (
                  <p className="mt-5 rounded-2xl bg-white/90 px-4 py-3 text-xs font-bold text-slate-600 shadow">
                    Última ubicación recibida correctamente
                  </p>
                )}
            </div>

            <button
              type="button"
              onClick={() => loadSharedTrip(true)}
              disabled={refreshing}
              className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400 shadow-xl disabled:opacity-50"
              aria-label={t("publicTripTracker.refreshTracking")}
            >
              <RefreshCw
                size={20}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </section>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">
                  Recorrido
                </h2>

                <Route size={24} className="text-slate-400" />
              </div>

              <div className="mt-6 space-y-5">
                <LocationRow
                  label={t("publicTripTracker.origin")}
                  value={trip.origin_address}
                  type="origin"
                />

                <LocationRow
                  label={t("publicTripTracker.destination")}
                  value={trip.destination_address}
                  type="destination"
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">
                  Conductor y taxi
                </h2>

                <BadgeCheck
                  size={24}
                  className="text-emerald-600"
                />
              </div>

              {trip.driver_name ? (
                <div className="mt-6 space-y-4">
                  <InfoRow
                    icon={UserRound}
                    label={t("publicTripTracker.driver")}
                    value={trip.driver_name}
                  />

                  <InfoRow
                    icon={CarFront}
                    label={t("publicTripTracker.vehicle")}
                    value={
                      [trip.vehicle_brand, trip.vehicle_model]
                        .filter(Boolean)
                        .join(" ") || t("publicTripTracker.pending")
                    }
                  />

                  <InfoRow
                    icon={MapPin}
                    label={t("publicTripTracker.colorAndPlates")}
                    value={
                      [
                        trip.vehicle_color,
                        trip.vehicle_plates,
                      ]
                        .filter(Boolean)
                        .join(" · ") || t("publicTripTracker.pending")
                    }
                  />

                  {trip.vehicle_economic_number && (
                    <InfoRow
                      icon={ShieldCheck}
                      label={t("publicTripTracker.economicNumber")}
                      value={trip.vehicle_economic_number}
                    />
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-center">
                  <CarFront
                    size={27}
                    className="mx-auto text-slate-400"
                  />

                  <p className="mt-3 text-sm font-black text-slate-700">
                    Conductor pendiente
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Los datos aparecerán cuando un taxista acepte el viaje.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <ShieldCheck
            size={24}
            className="mx-auto text-emerald-600"
          />

          <p className="mt-3 text-sm font-black text-slate-800">
            Enlace temporal protegido por AXI
          </p>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            {t("publicTripTracker.linkExpiration")}
          </p>
        </section>
      </div>
    </main>
  );
}

function LocationRow({
  label,
  value,
  type,
}: {
  label: string;
  value: string;
  type: "origin" | "destination";
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={cn(
          "mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-white shadow",
          type === "origin"
            ? "bg-emerald-500"
            : "bg-yellow-400"
        )}
      />

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-black leading-6 text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
        <Icon size={18} />
      </span>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-black text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}
