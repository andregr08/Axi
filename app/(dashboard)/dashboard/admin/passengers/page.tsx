"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Phone,
  Power,
  PowerOff,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type PassengerFilter =
  | "all"
  | "active"
  | "inactive"
  | "with-trips"
  | "without-trips";

type Passenger = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  rating: number;
  total_trips: number;
  account_active: boolean;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function AdminPassengersPage() {
  const router = useRouter();

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<PassengerFilter>("all");

  const loadPassengers = useCallback(
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

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, avatar_url, rating, total_trips, account_active, created_at"
        )
        .eq("role", "passenger")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        setMessage(
          `Error cargando pasajeros: ${error.message}`
        );
      } else {
        setPassengers((data ?? []) as Passenger[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPassengers();
  }, [loadPassengers]);

  async function updatePassengerStatus(
    passengerId: string,
    newActiveStatus: boolean
  ) {
    const action = newActiveStatus
      ? "activar"
      : "suspender";

    const confirmed = window.confirm(
      `¿Seguro que quieres ${action} esta cuenta?`
    );

    if (!confirmed) return;

    setProcessingId(passengerId);
    setMessage("");

    const { error } = await supabase.rpc(
      "update_passenger_status",
      {
        passenger_user_id: passengerId,
        new_active_status: newActiveStatus,
      }
    );

    if (error) {
      setMessage(
        `Error actualizando pasajero: ${error.message}`
      );
    } else {
      setMessage(
        newActiveStatus
          ? "Cuenta activada correctamente."
          : "Cuenta suspendida correctamente."
      );

      await loadPassengers(true);
    }

    setProcessingId(null);
  }

  const activeCount = passengers.filter(
    (passenger) => passenger.account_active
  ).length;

  const inactiveCount = passengers.filter(
    (passenger) => !passenger.account_active
  ).length;

  const totalTrips = passengers.reduce(
    (total, passenger) =>
      total + Number(passenger.total_trips ?? 0),
    0
  );

  const averageRating =
    passengers.length > 0
      ? passengers.reduce(
          (total, passenger) =>
            total + Number(passenger.rating ?? 5),
          0
        ) / passengers.length
      : 0;

  const filteredPassengers = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return passengers.filter((passenger) => {
      const name =
        passenger.full_name?.toLowerCase() ?? "";

      const phone =
        passenger.phone?.toLowerCase() ?? "";

      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        phone.includes(normalizedSearch);

      if (!matchesSearch) return false;

      if (filter === "all") return true;

      if (filter === "active") {
        return passenger.account_active;
      }

      if (filter === "inactive") {
        return !passenger.account_active;
      }

      if (filter === "with-trips") {
        return Number(passenger.total_trips ?? 0) > 0;
      }

      return Number(passenger.total_trips ?? 0) === 0;
    });
  }, [filter, passengers, search]);

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

        <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
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
              <UsersRound size={15} />
              Administración de usuarios
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Pasajeros AXI
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Consulta las cuentas registradas, revisa su
              actividad y administra el acceso de los
              pasajeros a la plataforma.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <UserRound
                  size={18}
                  className="text-yellow-400"
                />
                {passengers.length} registrados
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Route
                  size={18}
                  className="text-emerald-400"
                />
                {totalTrips} viajes acumulados
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadPassengers(true)}
            disabled={refreshing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              size={19}
              className={
                refreshing ? "animate-spin" : ""
              }
            />

            {refreshing
              ? "Actualizando..."
              : "Actualizar pasajeros"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.toLowerCase().includes("error")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pasajeros activos"
          value={activeCount}
          description="Cuentas con acceso"
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="Suspendidos"
          value={inactiveCount}
          description="Sin acceso a AXI"
          icon={ShieldAlert}
          iconClass="bg-red-100 text-red-700"
        />

        <StatCard
          label="Viajes acumulados"
          value={totalTrips}
          description="Actividad total"
          icon={Route}
          iconClass="bg-blue-100 text-blue-700"
        />

        <StatCard
          label="Calificación promedio"
          value={Number(
            averageRating.toFixed(1)
          )}
          description="Promedio de usuarios"
          icon={Star}
          iconClass="bg-yellow-100 text-yellow-700"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Usuarios
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Directorio de pasajeros
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
                  placeholder="Buscar nombre o teléfono..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-72"
                />
              </div>

              <div className="flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["inactive", "Suspendidos"],
                  ["with-trips", "Con viajes"],
                  ["without-trips", "Sin viajes"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(
                        value as PassengerFilter
                      )
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

        {filteredPassengers.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                <UsersRound size={34} />
              </span>

              <h3 className="mt-6 text-2xl font-black">
                No hay pasajeros
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                No encontramos usuarios que coincidan con la
                búsqueda o el filtro seleccionado.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5 md:grid-cols-2 2xl:grid-cols-3 sm:p-7">
            {filteredPassengers.map((passenger) => {
              const processing =
                processingId === passenger.id;

              return (
                <article
                  key={passenger.id}
                  className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className={cn(
                      "h-1.5",
                      passenger.account_active
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    )}
                  />

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-xl font-black text-yellow-400">
                          {passenger.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={passenger.avatar_url}
                              alt={
                                passenger.full_name ||
                                "Pasajero"
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            passenger.full_name
                              ?.charAt(0)
                              .toUpperCase() || "U"
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-slate-950">
                            {passenger.full_name ||
                              "Usuario sin nombre"}
                          </h3>

                          <p className="mt-1 truncate text-sm text-slate-500">
                            {passenger.phone ||
                              "Sin teléfono registrado"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          passenger.account_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {passenger.account_active ? (
                          <Power size={19} />
                        ) : (
                          <PowerOff size={19} />
                        )}
                      </span>
                    </div>

                    <div className="mt-5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
                          passenger.account_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {passenger.account_active ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <ShieldAlert size={14} />
                        )}

                        {passenger.account_active
                          ? "Cuenta activa"
                          : "Cuenta suspendida"}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <InfoBox
                        label="Calificación"
                        value={Number(
                          passenger.rating ?? 5
                        ).toFixed(1)}
                        icon={Star}
                        iconClass="text-yellow-600"
                      />

                      <InfoBox
                        label="Viajes"
                        value={String(
                          passenger.total_trips ?? 0
                        )}
                        icon={Route}
                        iconClass="text-blue-600"
                      />
                    </div>

                    <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
                      <InfoRow
                        icon={Phone}
                        label="Teléfono"
                        value={
                          passenger.phone ||
                          "No registrado"
                        }
                      />

                      <InfoRow
                        icon={CalendarDays}
                        label="Registro"
                        value={formatDate(
                          passenger.created_at
                        )}
                      />

                      <InfoRow
                        icon={Clock3}
                        label="Actividad"
                        value={
                          Number(
                            passenger.total_trips ?? 0
                          ) > 0
                            ? `${passenger.total_trips} viajes realizados`
                            : "Sin viajes registrados"
                        }
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updatePassengerStatus(
                          passenger.id,
                          !passenger.account_active
                        )
                      }
                      disabled={processing}
                      className={cn(
                        "mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition disabled:pointer-events-none disabled:opacity-50",
                        passenger.account_active
                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      )}
                    >
                      {processing ? (
                        <>
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                          Procesando...
                        </>
                      ) : passenger.account_active ? (
                        <>
                          <PowerOff size={17} />
                          Suspender cuenta
                        </>
                      ) : (
                        <>
                          <Power size={17} />
                          Activar cuenta
                        </>
                      )}
                    </button>
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
  icon: typeof Power;
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

function InfoBox({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: typeof Star;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon
        size={19}
        className={iconClass}
      />

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        size={16}
        className="mt-0.5 shrink-0 text-slate-400"
      />

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 break-words text-sm font-bold text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}
