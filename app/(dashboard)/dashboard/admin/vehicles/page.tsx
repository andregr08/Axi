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
  Palette,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  UsersRound,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type VehicleStatus =
  | "pending"
  | "active"
  | "maintenance"
  | "suspended";

type VehicleFilter =
  | "all"
  | VehicleStatus
  | "verified"
  | "unverified";

type DriverProfile = {
  full_name: string | null;
};

type Vehicle = {
  id: string;
  driver_id: string;
  brand: string;
  model: string;
  vehicle_year: number | null;
  color: string | null;
  plates: string;
  capacity: number;
  status: VehicleStatus;
  verified: boolean;
  created_at: string;
  profiles: DriverProfile | null;
};

const statusLabels: Record<VehicleStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  maintenance: "Mantenimiento",
  suspended: "Suspendido",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function AdminVehiclesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<VehicleFilter>("all");

  const loadVehicles = useCallback(
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

      const { data: vehicleRows, error: vehiclesError } =
        await supabase
          .from("vehicles")
          .select(`
            id,
            driver_id,
            brand,
            model,
            vehicle_year,
            color,
            plates,
            capacity,
            status,
            verified,
            created_at
          `)
          .order("created_at", {
            ascending: false,
          });

      if (vehiclesError) {
        setMessage(
          `Error cargando vehículos: ${vehiclesError.message}`
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const driverIds = Array.from(
        new Set(
          (vehicleRows ?? []).map(
            (vehicle) => vehicle.driver_id
          )
        )
      );

      let profilesById = new Map<
        string,
        DriverProfile
      >();

      if (driverIds.length > 0) {
        const { data: profileRows, error: profilesError } =
          await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", driverIds);

        if (profilesError) {
          setMessage(
            `Vehículos cargados, pero no fue posible cargar algunos conductores: ${profilesError.message}`
          );
        } else {
          profilesById = new Map(
            (profileRows ?? []).map((profile) => [
              profile.id,
              {
                full_name: profile.full_name,
              },
            ])
          );
        }
      }

      const mergedVehicles = (vehicleRows ?? []).map(
        (vehicle) => ({
          ...vehicle,
          profiles:
            profilesById.get(vehicle.driver_id) ?? null,
        })
      );

      setVehicles(mergedVehicles as Vehicle[]);
      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVehicles();
  }, [loadVehicles]);

  async function reviewVehicle(
    vehicleId: string,
    newStatus: VehicleStatus
  ) {
    const confirmed = window.confirm(
      `¿Confirmas cambiar el estado del vehículo a ${statusLabels[
        newStatus
      ].toLowerCase()}?`
    );

    if (!confirmed) return;

    setProcessingId(vehicleId);
    setMessage("");

    const { error } = await supabase.rpc(
      "review_vehicle",
      {
        vehicle_id: vehicleId,
        new_status: newStatus,
      }
    );

    if (error) {
      setMessage(
        `Error actualizando vehículo: ${error.message}`
      );
    } else {
      setMessage(
        `Vehículo actualizado a ${statusLabels[
          newStatus
        ].toLowerCase()}.`
      );

      await loadVehicles(true);
    }

    setProcessingId(null);
  }

  function getDriverName(vehicle: Vehicle) {
    return (
      vehicle.profiles?.full_name ||
      "Conductor sin nombre"
    );
  }

  const pendingCount = vehicles.filter(
    (vehicle) => vehicle.status === "pending"
  ).length;

  const activeCount = vehicles.filter(
    (vehicle) => vehicle.status === "active"
  ).length;

  const maintenanceCount = vehicles.filter(
    (vehicle) => vehicle.status === "maintenance"
  ).length;

  const suspendedCount = vehicles.filter(
    (vehicle) => vehicle.status === "suspended"
  ).length;

  const verifiedCount = vehicles.filter(
    (vehicle) => vehicle.verified
  ).length;

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return vehicles.filter((vehicle) => {
      const driverName = getDriverName(vehicle)
        .toLowerCase();

      const vehicleName =
        `${vehicle.brand} ${vehicle.model}`.toLowerCase();

      const plates = vehicle.plates.toLowerCase();

      const color =
        vehicle.color?.toLowerCase() ?? "";

      const matchesSearch =
        !normalizedSearch ||
        vehicleName.includes(normalizedSearch) ||
        plates.includes(normalizedSearch) ||
        driverName.includes(normalizedSearch) ||
        color.includes(normalizedSearch);

      if (!matchesSearch) return false;

      if (filter === "all") return true;

      if (filter === "verified") {
        return vehicle.verified;
      }

      if (filter === "unverified") {
        return !vehicle.verified;
      }

      return vehicle.status === filter;
    });
  }, [filter, search, vehicles]);

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
              <CarFront size={15} />
              Administración de unidades
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Vehículos AXI
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Revisa las unidades registradas, valida sus
              datos y administra su disponibilidad dentro de
              la plataforma.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <CarFront
                  size={18}
                  className="text-yellow-400"
                />
                {vehicles.length} unidades
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <BadgeCheck
                  size={18}
                  className="text-emerald-400"
                />
                {verifiedCount} verificadas
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadVehicles(true)}
            disabled={refreshing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              size={19}
              className={refreshing ? "animate-spin" : ""}
            />

            {refreshing
              ? "Actualizando..."
              : "Actualizar vehículos"}
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
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Activos"
          value={activeCount}
          description="Unidades autorizadas"
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="Pendientes"
          value={pendingCount}
          description="Esperando revisión"
          icon={Clock3}
          iconClass="bg-amber-100 text-amber-800"
        />

        <StatCard
          label="Mantenimiento"
          value={maintenanceCount}
          description="Temporalmente fuera"
          icon={Wrench}
          iconClass="bg-blue-100 text-blue-700"
        />

        <StatCard
          label="Suspendidos"
          value={suspendedCount}
          description="Sin autorización"
          icon={ShieldAlert}
          iconClass="bg-red-100 text-red-700"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Flota registrada
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Directorio de vehículos
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
                  placeholder="Buscar placas, vehículo o conductor..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-80"
                />
              </div>

              <div className="flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["pending", "Pendientes"],
                  ["maintenance", "Mantenimiento"],
                  ["suspended", "Suspendidos"],
                  ["verified", "Verificados"],
                  ["unverified", "Sin verificar"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(value as VehicleFilter)
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

        {filteredVehicles.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                <CarFront size={34} />
              </span>

              <h3 className="mt-6 text-2xl font-black">
                No hay vehículos
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                No encontramos unidades que coincidan con la
                búsqueda o el filtro seleccionado.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5 md:grid-cols-2 2xl:grid-cols-3 sm:p-7">
            {filteredVehicles.map((vehicle) => {
              const processing =
                processingId === vehicle.id;

              return (
                <article
                  key={vehicle.id}
                  className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className={cn(
                      "h-1.5",
                      vehicle.status === "active" &&
                        "bg-emerald-500",
                      vehicle.status === "pending" &&
                        "bg-amber-400",
                      vehicle.status === "maintenance" &&
                        "bg-blue-500",
                      vehicle.status === "suspended" &&
                        "bg-red-500"
                    )}
                  />

                  <div className="relative flex min-h-48 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.22),_transparent_35%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)]">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] bg-[size:34px_34px]" />

                    <span className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                      <CarFront size={44} />
                    </span>

                    <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-slate-950 shadow-lg backdrop-blur">
                      {vehicle.plates}
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-black text-slate-950">
                          {vehicle.brand} {vehicle.model}
                        </h3>

                        <p className="mt-1 truncate text-sm text-slate-500">
                          {getDriverName(vehicle)}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          vehicle.verified
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        )}
                        title={
                          vehicle.verified
                            ? "Vehículo verificado"
                            : "Sin verificar"
                        }
                      >
                        {vehicle.verified ? (
                          <BadgeCheck size={20} />
                        ) : (
                          <ShieldAlert size={20} />
                        )}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <VehicleStatusBadge
                        status={vehicle.status}
                      />

                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black",
                          vehicle.verified
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {vehicle.verified
                          ? "Verificado"
                          : "Sin verificar"}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <InfoBox
                        label="Año"
                        value={
                          vehicle.vehicle_year
                            ? String(vehicle.vehicle_year)
                            : "N/D"
                        }
                        icon={CalendarDays}
                        iconClass="text-blue-600"
                      />

                      <InfoBox
                        label="Capacidad"
                        value={`${vehicle.capacity} personas`}
                        icon={UsersRound}
                        iconClass="text-violet-600"
                      />
                    </div>

                    <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
                      <InfoRow
                        icon={UserRound}
                        label="Conductor"
                        value={getDriverName(vehicle)}
                      />

                      <InfoRow
                        icon={CarFront}
                        label="Placas"
                        value={vehicle.plates}
                      />

                      <InfoRow
                        icon={Palette}
                        label="Color"
                        value={
                          vehicle.color ||
                          "No registrado"
                        }
                      />

                      <InfoRow
                        icon={Clock3}
                        label="Registro"
                        value={formatDate(
                          vehicle.created_at
                        )}
                      />
                    </div>

                    <div className="mt-6">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Estado administrativo
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <StatusButton
                          label="Aprobar"
                          onClick={() =>
                            reviewVehicle(
                              vehicle.id,
                              "active"
                            )
                          }
                          disabled={
                            processing ||
                            vehicle.status === "active"
                          }
                          className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        />

                        <StatusButton
                          label="Mantenimiento"
                          onClick={() =>
                            reviewVehicle(
                              vehicle.id,
                              "maintenance"
                            )
                          }
                          disabled={
                            processing ||
                            vehicle.status ===
                              "maintenance"
                          }
                          className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                        />

                        <StatusButton
                          label="Pendiente"
                          onClick={() =>
                            reviewVehicle(
                              vehicle.id,
                              "pending"
                            )
                          }
                          disabled={
                            processing ||
                            vehicle.status === "pending"
                          }
                          className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                        />

                        <StatusButton
                          label="Suspender"
                          onClick={() =>
                            reviewVehicle(
                              vehicle.id,
                              "suspended"
                            )
                          }
                          disabled={
                            processing ||
                            vehicle.status ===
                              "suspended"
                          }
                          className="bg-red-100 text-red-700 hover:bg-red-200"
                        />
                      </div>

                      {processing && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                          <LoaderCircle
                            size={15}
                            className="animate-spin"
                          />
                          Actualizando vehículo...
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

function VehicleStatusBadge({
  status,
}: {
  status: VehicleStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
        status === "active" &&
          "bg-emerald-100 text-emerald-700",
        status === "pending" &&
          "bg-amber-100 text-amber-800",
        status === "maintenance" &&
          "bg-blue-100 text-blue-700",
        status === "suspended" &&
          "bg-red-100 text-red-700"
      )}
    >
      {status === "active" && (
        <CheckCircle2 size={14} />
      )}

      {status === "pending" && <Clock3 size={14} />}

      {status === "maintenance" && (
        <Wrench size={14} />
      )}

      {status === "suspended" && (
        <XCircle size={14} />
      )}

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
  icon: LucideIcon;
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

      <p className="mt-1 text-lg font-black text-slate-950">
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
  icon: LucideIcon;
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
