"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CarFront,
  CircleDollarSign,
  Clock3,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { RideActionPanel } from "@/components/trips/RideActionPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type PassengerStats = {
  completed_trips: number;
  cancelled_trips: number;
  trips_this_month: number;
  total_spent: number;
  spent_this_month: number;
  average_rating: number;
  rating_count: number;
};

type PassengerActivity = {
  trip_id: string;
  origin_address: string;
  destination_address: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  final_price: number;
  amount_due: number;
  payment_method: string | null;
  payment_status: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_rating: number | null;
  review_rating: number | null;
  review_comment: string | null;
};

type SavedPlace = {
  id: string;
  type: "home" | "work" | "favorite";
  label: string;
  address: string;
};

type PassengerHomeProps = {
  name: string;
  email: string;
};

const EMPTY_STATS: PassengerStats = {
  completed_trips: 0,
  cancelled_trips: 0,
  trips_this_month: 0,
  total_spent: 0,
  spent_this_month: 0,
  average_rating: 0,
  rating_count: 0,
};

const activeTripStatuses = [
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

const tripStatusLabels: Record<string, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "Viaje en curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Fecha pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PassengerHome({ name }: PassengerHomeProps) {
  const { locale } = useLanguage();
  const english = locale === "en";
  const [stats, setStats] =
    useState<PassengerStats>(EMPTY_STATS);

  const [activity, setActivity] =
    useState<PassengerActivity[]>([]);

  const [places, setPlaces] =
    useState<SavedPlace[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadPassengerDashboard = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage(
          english
            ? "Your session is no longer available."
            : "Tu sesión ya no está disponible."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [
        statsResult,
        activityResult,
        placesResult,
      ] = await Promise.all([
        supabase.rpc(
          "get_passenger_dashboard_stats"
        ),

        supabase.rpc(
          "get_passenger_activity_history",
          {
            result_limit: 5,
          }
        ),

        supabase
          .from("saved_places")
          .select(
            "id, type, label, address"
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(3),
      ]);

      const errors = [
        statsResult.error,
        activityResult.error,
        placesResult.error,
      ].filter(Boolean);

      if (statsResult.data) {
        const resolvedStats =
          Array.isArray(statsResult.data)
            ? statsResult.data[0]
            : statsResult.data;

        setStats({
          ...EMPTY_STATS,
          ...(resolvedStats as
            | Partial<PassengerStats>
            | null),
        });
      }

      if (activityResult.data) {
        setActivity(
          activityResult.data as PassengerActivity[]
        );
      }

      if (placesResult.data) {
        setPlaces(
          placesResult.data as SavedPlace[]
        );
      }

      if (errors.length > 0) {
        setMessage(
          english
            ? "Some information could not be refreshed, but you can continue using your dashboard."
            : "Algunos datos no pudieron actualizarse, pero puedes seguir utilizando tu panel."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [english]
  );

  useEffect(() => {
    const initialTimer =
      window.setTimeout(() => {
        void loadPassengerDashboard();
      }, 0);

    const channel = supabase
      .channel(
        `passenger-home-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
        },
        () => {
          void loadPassengerDashboard(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          void loadPassengerDashboard(true);
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadPassengerDashboard]);

  const activeTrips = useMemo(
    () =>
      activity.filter((item) =>
        activeTripStatuses.includes(
          item.status
        )
      ),
    [activity]
  );


  const latestTrip =
    activeTrips[0] ??
    activity[0] ??
    null;

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-80 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-10 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative max-w-5xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
            <Navigation size={15} />
            {english ? "Smart mobility" : "Movilidad inteligente"}
          </span>

          <p className="mt-6 text-sm font-semibold text-slate-400">
            {english ? "Hello" : "Hola"}, {name}
          </p>

          <h1 className={english ? "mt-2 whitespace-nowrap text-[clamp(1.1rem,4.6vw,1.35rem)] font-black tracking-tight sm:text-5xl lg:text-6xl" : "mt-2 whitespace-nowrap text-[clamp(1.7rem,8vw,2.25rem)] font-black tracking-tight sm:text-5xl lg:text-6xl"}>
            {english ? "Where are we going today?" : "¿A dónde vamos hoy?"}
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            {english ? "Request a fast, safe and reliable ride with AXI." : "Solicita un viaje rápido, seguro y confiable desde AXI."}
          </p>

          <div className="mt-8">
            <Link
              href="/dashboard/trips/new"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black transition hover:bg-yellow-300 sm:w-auto"
            >
              <CarFront size={19} />
              {english ? "Request a ride" : "Solicitar viaje"}
              <ArrowRight size={19} />
            </Link>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            loadPassengerDashboard(true)
          }
          disabled={refreshing}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-slate-950 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          {refreshing
            ? english
              ? "Refreshing..."
              : "Actualizando..."
            : english
              ? "Refresh dashboard"
              : "Actualizar panel"}
        </button>
      </div>


      <section>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {english ? "Ride request" : "Solicitud de viaje"}
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {english ? "Find your next destination" : "Encuentra tu próximo destino"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {english ? "Check the map and start a new ride request." : "Consulta el mapa y comienza una nueva solicitud."}
            </p>
          </div>

          <Badge variant="success">
            {english ? "System available" : "Sistema disponible"}
          </Badge>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.75fr]">
          <GoogleMapView />
          <RideActionPanel role="passenger" />
        </div>
      </section>

    </section>
  );
}

