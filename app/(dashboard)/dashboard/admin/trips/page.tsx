"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Search,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type TripStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type TripFilter =
  | "all"
  | "active"
  | "completed"
  | "cancelled"
  | TripStatus;

type Trip = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  origin_address: string;
  destination_address: string;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
};

type ProfileName = {
  id: string;
  full_name: string | null;
};

const statusLabels: Record<TripStatus, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value ?? 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isActiveTrip(status: TripStatus) {
  return !["completed", "cancelled"].includes(status);
}

export default function AdminTripsPage() {
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TripFilter>("all");

  const loadTrips = useCallback(
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
        router.replace("/login");
        return;
      }

      const { data: currentProfile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

      if (
        profileError ||
        !isAdmin(currentProfile?.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      const { data: tripsData, error: tripsError } =
        await supabase
          .from("trips")
          .select(`
            id,
            passenger_id,
            driver_id,
            origin_address,
            destination_address,
            status,
            estimated_price,
            final_price,
            requested_at
          `)
          .order("requested_at", {
            ascending: false,
          });

      if (tripsError) {
        setMessage(
          `Error cargando viajes: ${tripsError.message}`
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const loadedTrips = (tripsData ?? []) as Trip[];
      setTrips(loadedTrips);

      const userIds = Array.from(
        new Set(
          loadedTrips.flatMap((trip) =>
            trip.driver_id
              ? [trip.passenger_id, trip.driver_id]
              : [trip.passenger_id]
          )
        )
      );

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } =
          await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);

        if (profilesError) {
          setMessage(
            `Viajes cargados, pero no fue posible cargar algunos nombres: ${profilesError.message}`
          );
        } else {
          const nameMap = (
            (profilesData ?? []) as ProfileName[]
          ).reduce(
            (result, profile) => {
              result[profile.id] =
                profile.full_name || "Usuario sin nombre";

              return result;
            },
            {} as Record<string, string>
          );

          setNames(nameMap);
        }
      } else {
        setNames({});
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTrips();
  }, [loadTrips]);

  const activeCount = trips.filter((trip) =>
    isActiveTrip(trip.status)
  ).length;

  const completedCount = trips.filter(
    (trip) => trip.status === "completed"
  ).length;

  const cancelledCount = trips.filter(
    (trip) => trip.status === "cancelled"
  ).length;

  const totalRevenue = trips.reduce(
    (total, trip) =>
      total +
      Number(
        trip.final_price ??
          (trip.status === "completed"
            ? trip.estimated_price
            : 0) ??
          0
      ),
    0
  );

  const filteredTrips = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return trips.filter((trip) => {
      const passengerName =
        names[trip.passenger_id]?.toLowerCase() ?? "";

      const driverName = trip.driver_id
        ? names[trip.driver_id]?.toLowerCase() ?? ""
        : "";

      const matchesSearch =
        !normalizedSearch ||
        trip.origin_address
          .toLowerCase()
          .includes(normalizedSearch) ||
        trip.destination_address
          .toLowerCase()
          .includes(normalizedSearch) ||
        passengerName.includes(normalizedSearch) ||
        driverName.includes(normalizedSearch) ||
        trip.id.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;

      if (filter === "all") return true;

      if (filter === "active") {
        return isActiveTrip(trip.status);
      }

      if (filter === "completed") {
        return trip.status === "completed";
      }

      if (filter === "cancelled") {
        return trip.status === "cancelled";
      }

      return trip.status === filter;
    });
  }, [filter, names, search, trips]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="h-[560px] animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <Route size={15} />
              Centro de operaciones
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Viajes de AXI
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Supervisa todos los viajes, consulta pasajeros,
              conductores, rutas, precios y estados desde un
              solo panel.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Activity
                  size={18}
                  className="text-yellow-400"
                />
                {trips.length} viajes registrados
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <CarFront
                  size={18}
                  className="text-emerald-400"
                />
                {activeCount} activos
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadTrips(true)}
            disabled={refreshing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              size={19}
              className={refreshing ? "animate-spin" : ""}
            />

            {refreshing
              ? "Actualizando..."
              : "Actualizar viajes"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.toLowerCase().includes("error") ||
              message.toLowerCase().includes("no fue posible")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Viajes activos"
          value={activeCount}
          description="En proceso actualmente"
          icon={Activity}
          iconClass="bg-blue-100 text-blue-700"
        />

        <StatCard
          label="Completados"
          value={completedCount}
          description="Recorridos finalizados"
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="Cancelados"
          value={cancelledCount}
          description="Solicitudes canceladas"
          icon={XCircle}
          iconClass="bg-red-100 text-red-700"
        />

        <RevenueCard value={totalRevenue} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Historial operativo
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Todos los viajes
              </h2>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar ruta, usuario o viaje..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-80"
                />
              </div>

              <div className="flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["requested", "Solicitados"],
                  ["searching", "Buscando"],
                  ["in_progress", "En curso"],
                  ["completed", "Completados"],
                  ["cancelled", "Cancelados"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(value as TripFilter)
                    }
                    className={cn(
                      "whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition",
                      filter === value
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-950"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                <Route size={34} />
              </span>

              <h3 className="mt-6 text-2xl font-black">
                No hay viajes
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                No encontramos viajes que coincidan con la
                búsqueda o el filtro seleccionado.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTrips.map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                passengerName={
                  names[trip.passenger_id] ||
                  "Pasajero sin identificar"
                }
                driverName={
                  trip.driver_id
                    ? names[trip.driver_id] ||
                      "Conductor sin identificar"
                    : "Sin asignar"
                }
              />
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function TripRow({
  trip,
  passengerName,
  driverName,
}: {
  trip: Trip;
  passengerName: string;
  driverName: string;
}) {
  const price =
    trip.final_price ?? trip.estimated_price;

  return (
    <article className="p-5 transition hover:bg-slate-50/70 sm:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <TripStatusBadge status={trip.status} />

            <span className="text-xs font-semibold text-slate-400">
              #{trip.id.slice(0, 8)}
            </span>
          </div>

          <div className="mt-5 flex gap-4">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <MapPin size={20} />
              </span>

              <span className="my-2 h-10 border-l-2 border-dashed border-slate-300" />

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <Navigation size={20} />
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Origen
                </p>

                <p className="mt-1 font-black leading-6 text-slate-950">
                  {trip.origin_address}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Destino
                </p>

                <p className="mt-1 font-black leading-6 text-slate-950">
                  {trip.destination_address}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
          <InfoBox
            label="Pasajero"
            value={passengerName}
            icon={UserRound}
          />

          <InfoBox
            label="Conductor"
            value={driverName}
            icon={CarFront}
          />

          <InfoBox
            label="Solicitado"
            value={formatDate(trip.requested_at)}
            icon={CalendarDays}
          />
        </div>

        <div className="flex min-w-44 flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5 xl:flex-col xl:items-end xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
          <div className="xl:text-right">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
              Precio
            </p>

            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatCurrency(price)}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {trip.final_price !== null
                ? "Precio final"
                : "Precio estimado"}
            </p>
          </div>

          <Link
            href={`/dashboard/trips/${trip.id}`}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Ver detalle
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function TripStatusBadge({
  status,
}: {
  status: TripStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
        status === "completed" &&
          "bg-emerald-100 text-emerald-700",
        status === "cancelled" &&
          "bg-red-100 text-red-700",
        ["requested", "searching"].includes(status) &&
          "bg-amber-100 text-amber-800",
        [
          "accepted",
          "driver_arriving",
          "driver_arrived",
          "in_progress",
        ].includes(status) &&
          "bg-blue-100 text-blue-700"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "completed" && "bg-emerald-500",
          status === "cancelled" && "bg-red-500",
          ["requested", "searching"].includes(status) &&
            "bg-amber-500",
          [
            "accepted",
            "driver_arriving",
            "driver_arrived",
            "in_progress",
          ].includes(status) && "bg-blue-500"
        )}
      />

      {statusLabels[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            iconClass
          )}
        >
          <Icon size={23} />
        </span>

        <p className="text-4xl font-black">
          {value}
        </p>
      </div>

      <p className="mt-5 font-black">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </Card>
  );
}

function RevenueCard({
  value,
}: {
  value: number;
}) {
  return (
    <Card className="bg-[#0B0F19] text-white">
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
          <CircleDollarSign size={23} />
        </span>
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-400">
        Ingresos registrados
      </p>

      <p className="mt-2 text-3xl font-black">
        {formatCurrency(value)}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Basado en viajes completados
      </p>
    </Card>
  );
}

function InfoBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon
        size={18}
        className="text-slate-400"
      />

      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 line-clamp-2 text-sm font-black leading-5 text-slate-700">
        {value}
      </p>
    </div>
  );
}
