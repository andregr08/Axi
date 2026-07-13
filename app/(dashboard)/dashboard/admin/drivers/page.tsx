"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  IdCard,
  Phone,
  Power,
  PowerOff,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type DriverStatus =
  | "pending"
  | "active"
  | "suspended"
  | "rejected";

type DriverFilter =
  | "all"
  | DriverStatus
  | "online"
  | "offline";

type Driver = {
  id: string;
  license_number: string | null;
  license_expiration: string | null;
  status: DriverStatus;
  verified: boolean;
  online: boolean;
  created_at: string;
  profiles:
    | {
        full_name: string | null;
        phone: string | null;
        rating: number;
        total_trips: number;
        account_active: boolean;
      }
    | {
        full_name: string | null;
        phone: string | null;
        rating: number;
        total_trips: number;
        account_active: boolean;
      }[]
    | null;
};

const statusLabels: Record<DriverStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  suspended: "Suspendido",
  rejected: "Rechazado",
};

function formatDate(value: string | null) {
  if (!value) return "No registrado";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function AdminDriversPage() {
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<DriverFilter>("all");

  const loadDrivers = useCallback(
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      const { data: driverRows, error: driversError } =
        await supabase
          .from("drivers")
          .select(`
            id,
            license_number,
            license_expiration,
            status,
            verified,
            online,
            created_at
          `)
          .order("created_at", {
            ascending: false,
          });

      if (driversError) {
        setMessage(
          `Error cargando conductores: ${driversError.message}`
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const driverIds = (driverRows ?? []).map(
        (driver) => driver.id
      );

      let profilesById = new Map<
        string,
        {
          full_name: string | null;
          phone: string | null;
          rating: number;
          total_trips: number;
          account_active: boolean;
        }
      >();

      if (driverIds.length > 0) {
        const { data: profileRows, error: profilesError } =
          await supabase
            .from("profiles")
            .select(`
              id,
              full_name,
              phone,
              rating,
              total_trips,
              account_active
            `)
            .in("id", driverIds);

        if (profilesError) {
          setMessage(
            `Error cargando perfiles: ${profilesError.message}`
          );
        } else {
          profilesById = new Map(
            (profileRows ?? []).map((profile) => [
              profile.id,
              {
                full_name: profile.full_name,
                phone: profile.phone,
                rating: profile.rating,
                total_trips: profile.total_trips,
                account_active: profile.account_active,
              },
            ])
          );
        }
      }

      const mergedDrivers = (driverRows ?? []).map(
        (driver) => ({
          ...driver,
          profiles: profilesById.get(driver.id) ?? null,
        })
      );

      setDrivers(mergedDrivers as Driver[]);

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDrivers();
  }, [loadDrivers]);

  async function updateStatus(
    driverId: string,
    newStatus: DriverStatus
  ) {
    const confirmed = window.confirm(
      `¿Confirmas cambiar el estado del conductor a ${statusLabels[
        newStatus
      ].toLowerCase()}?`
    );

    if (!confirmed) return;

    setProcessingId(driverId);
    setMessage("");

    const { error } = await supabase.rpc(
      "update_driver_status",
      {
        driver_user_id: driverId,
        new_status: newStatus,
      }
    );

    if (error) {
      setMessage(
        `Error actualizando conductor: ${error.message}`
      );
    } else {
      setMessage(
        `Conductor actualizado a ${statusLabels[
          newStatus
        ].toLowerCase()}.`
      );

      await loadDrivers(true);
    }

    setProcessingId(null);
  }

  function getProfile(driver: Driver) {
    return Array.isArray(driver.profiles)
      ? driver.profiles[0]
      : driver.profiles;
  }

  const activeCount = drivers.filter(
    (driver) => driver.status === "active"
  ).length;

  const suspendedCount = drivers.filter(
    (driver) => driver.status === "suspended"
  ).length;

  const onlineCount = drivers.filter(
    (driver) => driver.online
  ).length;

  const verifiedCount = drivers.filter(
    (driver) => driver.verified
  ).length;

  const filteredDrivers = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return drivers.filter((driver) => {
      const profile = Array.isArray(driver.profiles)
        ? driver.profiles[0]
        : driver.profiles;

      const name =
        profile?.full_name?.toLowerCase() ?? "";

      const license =
        driver.license_number?.toLowerCase() ?? "";

      const phone =
        profile?.phone?.toLowerCase() ?? "";

      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        license.includes(normalizedSearch) ||
        phone.includes(normalizedSearch);

      if (!matchesSearch) return false;

      if (filter === "all") return true;
      if (filter === "online") return driver.online;
      if (filter === "offline") return !driver.online;

      return driver.status === filter;
    });
  }, [drivers, filter, search]);

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
              <ShieldCheck size={15} />
              Administración de flota
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Conductores AXI
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Consulta la actividad de los conductores,
              supervisa su disponibilidad y administra el
              estado de sus cuentas.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <UsersRound
                  size={18}
                  className="text-yellow-400"
                />
                {drivers.length} registrados
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Power
                  size={18}
                  className="text-emerald-400"
                />
                {onlineCount} en línea
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadDrivers(true)}
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
              : "Actualizar conductores"}
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
          label="Conductores activos"
          value={activeCount}
          description="Cuentas autorizadas"
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="En línea"
          value={onlineCount}
          description="Disponibles ahora"
          icon={Power}
          iconClass="bg-blue-100 text-blue-700"
        />

        <StatCard
          label="Verificados"
          value={verifiedCount}
          description="Identidad validada"
          icon={BadgeCheck}
          iconClass="bg-yellow-100 text-yellow-700"
        />

        <StatCard
          label="Suspendidos"
          value={suspendedCount}
          description="Sin acceso operativo"
          icon={ShieldAlert}
          iconClass="bg-red-100 text-red-700"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Operación
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Directorio de conductores
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
                  placeholder="Buscar nombre, licencia o teléfono..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-80"
                />
              </div>

              <div className="flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["online", "En línea"],
                  ["offline", "Desconectados"],
                  ["suspended", "Suspendidos"],
                  ["pending", "Pendientes"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(value as DriverFilter)
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

        {filteredDrivers.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                <CarFront size={34} />
              </span>

              <h3 className="mt-6 text-2xl font-black">
                No hay conductores
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                No encontramos conductores que coincidan con
                la búsqueda o el filtro seleccionado.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5 md:grid-cols-2 2xl:grid-cols-3 sm:p-7">
            {filteredDrivers.map((driver) => {
              const profile = getProfile(driver);
              const processing =
                processingId === driver.id;

              return (
                <article
                  key={driver.id}
                  className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className={cn(
                      "h-1.5",
                      driver.status === "active" &&
                        "bg-emerald-500",
                      driver.status === "pending" &&
                        "bg-amber-400",
                      driver.status === "suspended" &&
                        "bg-red-500",
                      driver.status === "rejected" &&
                        "bg-slate-500"
                    )}
                  />

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
                          <UserRound size={25} />
                        </span>

                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-slate-950">
                            {profile?.full_name ||
                              "Conductor sin nombre"}
                          </h3>

                          <p className="mt-1 truncate text-sm text-slate-500">
                            {profile?.phone ||
                              "Sin teléfono registrado"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          driver.online
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        )}
                        title={
                          driver.online
                            ? "En línea"
                            : "Fuera de línea"
                        }
                      >
                        {driver.online ? (
                          <Power size={19} />
                        ) : (
                          <PowerOff size={19} />
                        )}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <DriverStatusBadge
                        status={driver.status}
                      />

                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black",
                          driver.verified
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {driver.verified ? (
                          <BadgeCheck size={14} />
                        ) : (
                          <ShieldAlert size={14} />
                        )}

                        {driver.verified
                          ? "Verificado"
                          : "Sin verificar"}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black",
                          profile?.account_active !== false
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        Cuenta{" "}
                        {profile?.account_active !== false
                          ? "activa"
                          : "inactiva"}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <InfoBox
                        label="Calificación"
                        value={Number(
                          profile?.rating ?? 5
                        ).toFixed(1)}
                        icon={Star}
                        iconClass="text-yellow-600"
                      />

                      <InfoBox
                        label="Viajes"
                        value={String(
                          profile?.total_trips ?? 0
                        )}
                        icon={Route}
                        iconClass="text-blue-600"
                      />
                    </div>

                    <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
                      <InfoRow
                        icon={IdCard}
                        label="Licencia"
                        value={
                          driver.license_number ||
                          "No registrada"
                        }
                      />

                      <InfoRow
                        icon={CalendarDays}
                        label="Vencimiento"
                        value={formatDate(
                          driver.license_expiration
                        )}
                      />

                      <InfoRow
                        icon={Phone}
                        label="Teléfono"
                        value={
                          profile?.phone ||
                          "No registrado"
                        }
                      />

                      <InfoRow
                        icon={Clock3}
                        label="Registro"
                        value={formatDate(
                          driver.created_at
                        )}
                      />
                    </div>

                    <div className="mt-6">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Estado administrativo
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <StatusButton
                          label="Activar"
                          onClick={() =>
                            updateStatus(
                              driver.id,
                              "active"
                            )
                          }
                          disabled={
                            processing ||
                            driver.status === "active"
                          }
                          className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        />

                        <StatusButton
                          label="Suspender"
                          onClick={() =>
                            updateStatus(
                              driver.id,
                              "suspended"
                            )
                          }
                          disabled={
                            processing ||
                            driver.status ===
                              "suspended"
                          }
                          className="bg-red-100 text-red-700 hover:bg-red-200"
                        />

                        <StatusButton
                          label="Pendiente"
                          onClick={() =>
                            updateStatus(
                              driver.id,
                              "pending"
                            )
                          }
                          disabled={
                            processing ||
                            driver.status === "pending"
                          }
                          className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                        />

                        <StatusButton
                          label="Rechazar"
                          onClick={() =>
                            updateStatus(
                              driver.id,
                              "rejected"
                            )
                          }
                          disabled={
                            processing ||
                            driver.status ===
                              "rejected"
                          }
                          className="bg-slate-200 text-slate-700 hover:bg-slate-300"
                        />
                      </div>

                      {processing && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                          <LoaderCircle
                            size={15}
                            className="animate-spin"
                          />
                          Actualizando conductor...
                        </div>
                      )}
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

function DriverStatusBadge({
  status,
}: {
  status: DriverStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black",
        status === "active" &&
          "bg-emerald-100 text-emerald-700",
        status === "pending" &&
          "bg-amber-100 text-amber-800",
        status === "suspended" &&
          "bg-red-100 text-red-700",
        status === "rejected" &&
          "bg-slate-200 text-slate-700"
      )}
    >
      {statusLabels[status]}
    </span>
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

function StatusButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-11 rounded-xl px-3 text-xs font-black transition disabled:pointer-events-none disabled:opacity-35",
        className
      )}
    >
      {label}
    </button>
  );
}
