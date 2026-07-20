"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleX,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  Route,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";

type TripStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type Trip = {
  id: string;
  origin_address: string;
  destination_address: string;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
};

type TripFilter = "all" | "active" | "completed" | "cancelled";

const statusName: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const activeStatuses: TripStatus[] = [
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

function formatCurrency(value: number | null) {
  if (value === null) return "Por calcular";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusVariant(
  status: TripStatus
): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";

  if (
    status === "requested" ||
    status === "searching" ||
    status === "accepted"
  ) {
    return "warning";
  }

  return "default";
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TripFilter>("all");
  const [search, setSearch] = useState("");

  async function loadTrips() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("trips")
      .select(
        "id, origin_address, destination_address, status, estimated_price, final_price, requested_at"
      )
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error cargando viajes:", error.message);
    } else {
      setTrips((data ?? []) as Trip[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTrips();
  }, []);

  async function cancelTrip(tripId: string) {
    const selectedTrip = trips.find(
      (trip) => trip.id === tripId
    );

    if (!selectedTrip) {
      window.alert("No se encontró el viaje.");
      return;
    }

    const estimatedFee =
      selectedTrip.status === "driver_arrived"
        ? 40
        : ["accepted", "driver_arriving"].includes(
              selectedTrip.status
            )
          ? 20
          : 0;

    const feeMessage =
      estimatedFee > 0
        ? ` Se aplicará una penalización estimada de ${formatCurrency(
            estimatedFee
          )}.`
        : " No se aplicará penalización.";

    const confirmed = window.confirm(
      `¿Seguro que quieres cancelar este viaje?${feeMessage}`
    );

    if (!confirmed) return;

    const cancellationReason = window.prompt(
      "Indica brevemente el motivo de la cancelación:",
      "Ya no necesito el viaje"
    );

    if (cancellationReason === null) return;

    const normalizedReason = cancellationReason.trim();

    if (normalizedReason.length < 5) {
      window.alert(
        "El motivo debe tener al menos 5 caracteres."
      );
      return;
    }

    setCancellingId(tripId);

    const { data, error } = await supabase.rpc(
      "passenger_cancel_trip",
      {
        requested_trip_id: tripId,
        cancellation_reason_value: normalizedReason,
      }
    );

    if (error) {
      window.alert(
        `Error al cancelar: ${error.message}`
      );
    } else {
      const cancellationFee = Number(data ?? 0);

      window.alert(
        cancellationFee > 0
          ? `Viaje cancelado. Penalización aplicada: ${formatCurrency(
              cancellationFee
            )}.`
          : "Viaje cancelado correctamente sin penalización."
      );

      await loadTrips();
    }

    setCancellingId(null);
  }

  const activeTrips = trips.filter((trip) =>
    activeStatuses.includes(trip.status)
  );

  const completedTrips = trips.filter(
    (trip) => trip.status === "completed"
  );

  const cancelledTrips = trips.filter(
    (trip) => trip.status === "cancelled"
  );

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.origin_address.toLowerCase().includes(search.toLowerCase()) ||
      trip.destination_address.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "active") {
      return activeStatuses.includes(trip.status);
    }

    if (filter === "completed") {
      return trip.status === "completed";
    }

    if (filter === "cancelled") {
      return trip.status === "cancelled";
    }

    return true;
  });

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-56 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-3xl bg-slate-200"
            />
          ))}
        </div>

        <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:px-9 sm:py-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
              <Route size={15} />
              Historial de movilidad
            </span>

            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              Mis viajes
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Consulta tus viajes activos, revisa tu historial y administra
              solicitudes desde un solo lugar.
            </p>
          </div>

          <Link
            href="/dashboard/trips/new"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:-translate-y-0.5 hover:bg-yellow-300"
          >
            <Plus size={20} />
            Solicitar viaje
          </Link>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="group transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Clock3 size={23} />
            </span>

            <Badge>Ahora</Badge>
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-500">
            Viajes activos
          </p>

          <p className="mt-1 text-4xl font-black tracking-tight">
            {activeTrips.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Solicitudes o viajes en curso
          </p>
        </Card>

        <Card className="group transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={23} />
            </span>

            <Badge variant="success">Finalizados</Badge>
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-500">
            Viajes completados
          </p>

          <p className="mt-1 text-4xl font-black tracking-tight">
            {completedTrips.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Viajes realizados correctamente
          </p>
        </Card>

        <Card className="group transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <CircleX size={23} />
            </span>

            <Badge variant="danger">Cancelados</Badge>
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-500">
            Viajes cancelados
          </p>

          <p className="mt-1 text-4xl font-black tracking-tight">
            {cancelledTrips.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Solicitudes que no continuaron
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Actividad
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Historial de viajes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Información guardada en tu cuenta AXI.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar dirección..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-64"
                />
              </div>

              <div className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["completed", "Completados"],
                  ["cancelled", "Cancelados"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value as TripFilter)}
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition ${
                      filter === value
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-950"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                <Navigation size={34} />
              </span>

              <h3 className="mt-6 text-2xl font-black text-slate-950">
                {search || filter !== "all"
                  ? "No encontramos resultados"
                  : "Todavía no tienes viajes"}
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                {search || filter !== "all"
                  ? "Prueba con otra búsqueda o selecciona un filtro diferente."
                  : "Solicita tu primer viaje y consulta aquí toda la información de tu recorrido."}
              </p>

              {!search && filter === "all" && (
                <Link
                  href="/dashboard/trips/new"
                  className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:-translate-y-0.5 hover:bg-yellow-300"
                >
                  Solicitar mi primer viaje
                  <ArrowRight size={18} />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTrips.map((trip) => {
              const canCancel = [
                "requested",
                "searching",
                "accepted",
              ].includes(trip.status);

              const price =
                trip.final_price !== null
                  ? trip.final_price
                  : trip.estimated_price;

              return (
                <article
                  key={trip.id}
                  className="group p-5 transition hover:bg-slate-50 sm:p-7"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="relative flex w-11 shrink-0 flex-col items-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <MapPin size={20} />
                        </span>

                        <span className="my-1 h-8 w-px border-l-2 border-dashed border-slate-300" />

                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                          <Navigation size={20} />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant={getStatusVariant(trip.status)}>
                            {statusName[trip.status]}
                          </Badge>

                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <CalendarDays size={14} />
                            {formatDate(trip.requested_at)}
                          </span>
                        </div>

                        <div className="mt-5 space-y-5">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Origen
                            </p>
                            <p className="mt-1 truncate font-black text-slate-950">
                              {trip.origin_address}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Destino
                            </p>
                            <p className="mt-1 truncate font-black text-slate-950">
                              {trip.destination_address}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-5 xl:w-64 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Precio
                        </p>

                        <p className="mt-1 text-xl font-black text-slate-950">
                          {formatCurrency(price)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/dashboard/trips/${trip.id}`}
                          className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-xs font-black text-white transition hover:bg-slate-800"
                        >
                          Ver detalle
                        </Link>

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => cancelTrip(trip.id)}
                            disabled={cancellingId === trip.id}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
                          >
                            {cancellingId === trip.id
                              ? "Cancelando..."
                              : "Cancelar"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
