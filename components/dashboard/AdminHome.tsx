"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  Route,
  ShieldCheck,
  Siren,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import {
  isAdmin,
  type UserRole,
} from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type AdminHomeProps = {
  name: string;
  email: string;
};

type Driver = {
  id: string;
  status: string;
  online: boolean;
  verified: boolean;
};

type Passenger = {
  id: string;
  full_name: string | null;
  account_active: boolean | null;
};

type Trip = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  origin_address: string;
  destination_address: string;
  status: string;
  estimated_price: number | null;
  final_price: number | null;
  platform_commission: number | null;
  driver_earnings: number | null;
  payment_status: string | null;
  requested_at: string;
  completed_at: string | null;
  paid_at: string | null;
};

type DriverApplication = {
  id: string;
  status: string;
  created_at: string;
};

type Vehicle = {
  id: string;
  status: string;
  verified: boolean;
};

type SosAlert = {
  id: string;
  status: string;
  created_at: string;
};

type AdminData = {
  drivers: Driver[];
  passengers: Passenger[];
  trips: Trip[];
  payments: Trip[];
  applications: DriverApplication[];
  vehicles: Vehicle[];
  alerts: SosAlert[];
};

const EMPTY_DATA: AdminData = {
  drivers: [],
  passengers: [],
  trips: [],
  payments: [],
  applications: [],
  vehicles: [],
  alerts: [],
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
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

export function AdminHome({
  name,
  email,
}: AdminHomeProps) {
  const [data, setData] =
    useState<AdminData>(EMPTY_DATA);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadAdminDashboard = useCallback(
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
          "Tu sesión ya no está disponible."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [
        profileResult,
        driversResult,
        passengersResult,
        tripsResult,

        applicationsResult,
        vehiclesResult,
        alertsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single(),

        supabase
          .from("drivers")
          .select(
            "id, status, online, verified"
          ),

        supabase
          .from("profiles")
          .select(
            "id, full_name, account_active"
          )
          .eq("role", "passenger"),

        supabase
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
            platform_commission,
            driver_earnings,
            payment_status,
            requested_at,
            completed_at,
            paid_at
          `)
          .order("requested_at", {
            ascending: false,
          }),

        supabase
          .from("driver_applications")
          .select(
            "id, status, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("vehicles")
          .select(
            "id, status, verified"
          ),

        supabase
          .from("sos_alerts")
          .select(
            "id, status, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),
      ]);

      const currentRole =
        profileResult.data?.role as
          | UserRole
          | undefined;

      if (
        profileResult.error ||
        !isAdmin(currentRole)
      ) {
        setMessage(
          "No tienes permisos para consultar este panel."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const results = [
        driversResult,
        passengersResult,
        tripsResult,

        applicationsResult,
        vehiclesResult,
        alertsResult,
      ];

      const hasErrors = results.some(
        (result) => Boolean(result.error)
      );

      setData({
        drivers:
          (driversResult.data ?? []) as Driver[],
        passengers:
          (passengersResult.data ??
            []) as Passenger[],
        trips:
          (tripsResult.data ?? []) as Trip[],
        payments:
          (tripsResult.data ??
            []) as Trip[],
        applications:
          (applicationsResult.data ??
            []) as DriverApplication[],
        vehicles:
          (vehiclesResult.data ??
            []) as Vehicle[],
        alerts:
          (alertsResult.data ??
            []) as SosAlert[],
      });

      if (hasErrors) {
        setMessage(
          "Algunos módulos no pudieron actualizarse. El resto del panel continúa disponible."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    []
  );

  useEffect(() => {
    const initialTimer =
      window.setTimeout(() => {
        void loadAdminDashboard();
      }, 0);

    const channel = supabase
      .channel(
        `admin-home-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
        },
        () => {
          void loadAdminDashboard(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_applications",
        },
        () => {
          void loadAdminDashboard(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sos_alerts",
        },
        () => {
          void loadAdminDashboard(true);
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadAdminDashboard]);

  function formatMoney(value: number) {
    return new Intl.NumberFormat(
      "es-MX",
      {
        style: "currency",
        currency: "MXN",
      }
    ).format(Number(value ?? 0));
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value));
  }

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

  const activeDrivers =
    data.drivers.filter(
      (driver) =>
        driver.status === "active"
    ).length;

  const onlineDrivers =
    data.drivers.filter(
      (driver) => driver.online
    ).length;

  const verifiedDrivers =
    data.drivers.filter(
      (driver) => driver.verified
    ).length;

  const activePassengers =
    data.passengers.filter(
      (passenger) =>
        passenger.account_active !== false
    ).length;

  const activeTrips =
    data.trips.filter((trip) =>
      activeTripStatuses.includes(
        trip.status
      )
    );

  const completedTrips =
    data.trips.filter(
      (trip) =>
        trip.status === "completed"
    );

  const pendingApplications =
    data.applications.filter(
      (application) =>
        application.status === "pending"
    ).length;

  const pendingVehicles =
    data.vehicles.filter(
      (vehicle) =>
        vehicle.status === "pending"
    ).length;

  const activeAlerts =
    data.alerts.filter(
      (alert) =>
        alert.status === "active" ||
        alert.status === "acknowledged"
    ).length;

  const paidTrips =
    data.payments.filter(
      (trip) =>
        trip.payment_status === "paid"
    );

  const processedVolume =
    paidTrips.reduce(
      (total, trip) =>
        total +
        Number(trip.final_price ?? 0),
      0
    );

  const platformRevenue =
    paidTrips.reduce(
      (total, trip) =>
        total +
        Number(trip.platform_commission ?? 0),
      0
    );

  const driverRevenue =
    paidTrips.reduce(
      (total, trip) =>
        total +
        Number(trip.driver_earnings ?? 0),
      0
    );

  const today = new Date().toISOString().slice(0,10);

  const tripsToday =
    data.trips.filter(
      trip =>
        trip.requested_at?.startsWith(today)
    );



  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-9 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-9 lg:px-12 lg:py-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <ShieldCheck size={15} />
              Centro de operaciones
            </span>

            <p className="mt-6 text-sm font-semibold text-slate-400">
              Hola, {name}
            </p>

            <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Control total de AXI
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Supervisa viajes, conductores,
              pasajeros, pagos, vehículos y
              alertas de seguridad desde un solo
              panel.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/admin/trips"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
              >
                <Route size={19} />
                Ver operación
              </Link>

              <Link
                href="/dashboard/admin/driver-applications"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 font-black transition hover:bg-white/10"
              >
                Revisar solicitudes
                <ArrowRight size={19} />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Operación actual
                </p>

                <p className="mt-3 text-4xl font-black">
                  {activeTrips.length}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Viajes activos
                </p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <Activity size={27} />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">
                  {onlineDrivers}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Conductores en línea
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">
                  {activeAlerts}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Alertas abiertas
                </p>
              </div>
            </div>
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
            loadAdminDashboard(true)
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
            ? "Actualizando..."
            : "Actualizar panel"}
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Conductores"
          value={String(data.drivers.length)}
          description={`${activeDrivers} activos · ${onlineDrivers} en línea`}
          icon={CarFront}
          iconClass="bg-yellow-100 text-yellow-700"
        />

        <MetricCard
          label="Pasajeros"
          value={String(
            data.passengers.length
          )}
          description={`${activePassengers} cuentas activas`}
          icon={UsersRound}
          iconClass="bg-blue-100 text-blue-700"
        />

        <MetricCard
          label="Viajes activos"
          value={String(activeTrips.length)}
          description={`${completedTrips.length} completados recientes`}
          icon={Route}
          iconClass="bg-violet-100 text-violet-700"
        />

        <MetricCard
          label="Comisión AXI"
          value={formatMoney(
            platformRevenue
          )}
          description={`${formatMoney(
            processedVolume
          )} procesados`}
          icon={CircleDollarSign}
          iconClass="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Operación reciente
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Últimos viajes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Movimientos recientes registrados
                en la plataforma.
              </p>
            </div>

            <Link
              href="/dashboard/admin/trips"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-black transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
            >
              Ver todos
              <ArrowRight size={17} />
            </Link>
          </div>

          {data.trips.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center bg-slate-50 px-6 py-12">
              <div className="max-w-md text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                  <Route size={34} />
                </span>

                <h3 className="mt-6 text-2xl font-black">
                  No hay viajes registrados
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Los viajes solicitados aparecerán
                  aquí automáticamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:p-7">
              {data.trips.map((trip) => (
                <article
                  key={trip.id}
                  className="rounded-[1.6rem] border border-slate-200 p-5 transition hover:border-slate-400"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                          <Route size={20} />
                        </span>

                        <div className="min-w-0">
                          <h3 className="truncate font-black text-slate-950">
                            {trip.origin_address}
                          </h3>

                          <p className="mt-1 truncate text-sm text-slate-500">
                            hacia{" "}
                            {
                              trip.destination_address
                            }
                          </p>

                          <p className="mt-2 text-xs font-semibold text-slate-400">
                            {formatDate(
                              trip.requested_at
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-black",
                          trip.status ===
                            "completed" &&
                            "bg-emerald-100 text-emerald-700",
                          trip.status ===
                            "cancelled" &&
                            "bg-red-100 text-red-700",
                          activeTripStatuses.includes(
                            trip.status
                          ) &&
                            "bg-blue-100 text-blue-700"
                        )}
                      >
                        {tripStatusLabels[
                          trip.status
                        ] ?? trip.status}
                      </span>

                      <p className="min-w-28 text-right text-lg font-black text-slate-950">
                        {formatMoney(
                          Number(
                            trip.final_price ??
                              trip.estimated_price ??
                              0
                          )
                        )}
                      </p>

                      <Link
                        href={`/dashboard/trips/${trip.id}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
                      >
                        Ver viaje
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Pendientes
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Revisiones
                </h2>
              </div>

              <CheckCircle2
                size={25}
                className="text-yellow-600"
              />
            </div>

            <div className="mt-6 space-y-3">
              <StatusLink
                href="/dashboard/admin/driver-applications"
                label="Solicitudes"
                value={pendingApplications}
                icon={UserRound}
              />

              <StatusLink
                href="/dashboard/admin/vehicles"
                label="Vehículos"
                value={pendingVehicles}
                icon={CarFront}
              />

              <StatusLink
                href="/dashboard/admin/sos"
                label="Alertas SOS"
                value={activeAlerts}
                icon={Siren}
                danger={activeAlerts > 0}
              />
            </div>
          </Card>

          <Card className="bg-[#0B0F19] text-white">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <ShieldCheck size={23} />
              </span>

              <Badge className="bg-white/10 text-white">
                Administrador
              </Badge>
            </div>

            <h2 className="mt-6 text-2xl font-black">
              {name}
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              {email}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-black">
                Estado de la plataforma
              </p>

              <p className="mt-2 text-xs leading-6 text-slate-400">
                {activeAlerts > 0
                  ? `${activeAlerts} alertas requieren atención.`
                  : "No hay alertas críticas abiertas."}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Accesos rápidos
            </p>

            <h2 className="mt-1 text-xl font-black">
              Herramientas administrativas
            </h2>
          </div>

          <ShieldCheck
            size={26}
            className="text-emerald-600"
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickLink
            href="/dashboard/admin/drivers"
            label="Conductores"
            description={`${verifiedDrivers} verificados`}
            icon={CarFront}
          />

          <QuickLink
            href="/dashboard/admin/passengers"
            label="Pasajeros"
            description={`${data.passengers.length} registrados`}
            icon={UsersRound}
          />

          <QuickLink
            href="/dashboard/admin/payments"
            label="Pagos"
            description={`${data.payments.length} transacciones`}
            icon={CircleDollarSign}
          />

          <QuickLink
            href="/dashboard/admin/sos"
            label="Seguridad SOS"
            description={`${activeAlerts} alertas abiertas`}
            icon={
              activeAlerts > 0
                ? AlertTriangle
                : ShieldCheck
            }
          />
        </div>
      </Card>
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          iconClass
        )}
      >
        <Icon size={22} />
      </span>

      <p className="mt-6 text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-3 text-sm text-slate-400">
        {description}
      </p>
    </Card>
  );
}

function StatusLink({
  href,
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  href: string;
  label: string;
  value: number;
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          danger
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
        )}
      >
        <Icon size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-black text-slate-950">
          {label}
        </span>

        <span className="block text-xs text-slate-500">
          Pendientes de atención
        </span>
      </span>

      <span
        className={cn(
          "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-black",
          danger
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-700"
        )}
      >
        {value}
      </span>
    </Link>
  );
}

function QuickLink({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-100 p-5 transition hover:border-slate-950 hover:bg-slate-950"
    >
      <Icon
        size={22}
        className="text-slate-600 transition group-hover:text-yellow-400"
      />

      <p className="mt-5 font-black text-slate-950 transition group-hover:text-white">
        {label}
      </p>

      <p className="mt-1 text-xs text-slate-500 transition group-hover:text-slate-400">
        {description}
      </p>
    </Link>
  );
}
