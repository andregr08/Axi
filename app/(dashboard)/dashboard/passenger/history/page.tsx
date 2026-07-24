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
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  MapPin,
  Navigation,
  ReceiptText,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  UserRound,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isPassenger } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

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

type PassengerToolTab =
  | "summary"
  | "trips"
  | "payments"
  | "pending"
  | "ratings";

type HistoryFilter =
  | "all"
  | "completed"
  | "cancelled"
  | "active"
  | "payment_pending";

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

const paymentStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mercado_pago: "Mercado Pago",
};

const activeTripStatuses = [
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

const passengerToolTabs: Array<{
  value: PassengerToolTab;
  label: string;
  description: string;
}> = [
  {
    value: "summary",
    label: "Resumen",
    description: "Vista general de tu actividad",
  },
  {
    value: "trips",
    label: "Viajes",
    description: "Todos tus recorridos",
  },
  {
    value: "payments",
    label: "Pagos",
    description: "Pagos realizados y recibos",
  },
  {
    value: "pending",
    label: "Pendientes",
    description: "Pagos que requieren atención",
  },
  {
    value: "ratings",
    label: "Calificaciones",
    description: "Opiniones y viajes por calificar",
  },
];

const filters: Array<{
  value: HistoryFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "Todos",
  },
  {
    value: "active",
    label: "Activos",
  },
  {
    value: "completed",
    label: "Completados",
  },
  {
    value: "payment_pending",
    label: "Pago pendiente",
  },
  {
    value: "cancelled",
    label: "Cancelados",
  },
];

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getTripStatusClasses(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (status === "cancelled") {
    return "border-red-200 bg-red-100 text-red-700";
  }

  if (
    status === "in_progress" ||
    status === "driver_arrived" ||
    status === "driver_arriving"
  ) {
    return "border-blue-200 bg-blue-100 text-blue-700";
  }

  return "border-amber-200 bg-amber-100 text-amber-800";
}

function getPaymentStatusClasses(status: string) {
  if (status === "paid") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (
    status === "failed" ||
    status === "cancelled"
  ) {
    return "bg-red-100 text-red-700";
  }

  if (status === "refunded") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-800";
}

export default function PassengerHistoryPage() {
  const router = useRouter();

  const [activity, setActivity] =
    useState<PassengerActivity[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");  const [activeTab, setActiveTab] =
    useState<PassengerToolTab>("summary");



  const [filter, setFilter] =
    useState<HistoryFilter>("all");

  const [message, setMessage] =
    useState("");

  const loadHistory = useCallback(
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

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (
        profileError ||
        !isPassenger(profile?.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_passenger_activity_history",
        {
          result_limit: 100,
        }
      );

      if (error) {
        setMessage(
          `Error cargando historial: ${error.message}`
        );
      } else {
        setActivity(
          (data ?? []) as PassengerActivity[]
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [loadHistory]);

  const completedTrips = useMemo(
    () =>
      activity.filter(
        (item) =>
          item.status === "completed"
      ),
    [activity]
  );

  const cancelledTrips = useMemo(
    () =>
      activity.filter(
        (item) =>
          item.status === "cancelled"
      ),
    [activity]
  );

  const activeTrips = useMemo(
    () =>
      activity.filter((item) =>
        activeTripStatuses.includes(
          item.status
        )
      ),
    [activity]
  );

  const pendingPayments = useMemo(
    () =>
      activity.filter(
        (item) =>
          item.status === "completed" &&
          item.payment_status !== "paid"
      ),
    [activity]
  );

  const totalSpent = useMemo(
    () =>
      completedTrips.reduce(
        (total, item) =>
          total +
          Number(
            item.amount_due ??
              item.final_price ??
              0
          ),
        0
      ),
    [completedTrips]
  );

  const reviewedTrips = useMemo(
    () =>
      activity.filter(
        (item) =>
          item.review_rating !== null
      ).length,
    [activity]
  );

  const filteredActivity = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return activity.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.origin_address
          .toLowerCase()
          .includes(normalizedSearch) ||
        item.destination_address
          .toLowerCase()
          .includes(normalizedSearch) ||
        (
          item.driver_name ?? ""
        )
          .toLowerCase()
          .includes(normalizedSearch) ||
        (
          tripStatusLabels[item.status] ??
          item.status
        )
          .toLowerCase()
          .includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter === "active") {
        return activeTripStatuses.includes(
          item.status
        );
      }

      if (
        filter === "payment_pending"
      ) {
        return (
          item.status === "completed" &&
          item.payment_status !== "paid"
        );
      }

      return item.status === filter;
    });
  }, [activity, filter, search]);

  const visibleActivity = useMemo(() => {
    if (activeTab === "summary") {
      return activity.slice(0, 3);
    }

    if (activeTab === "trips") {
      return filteredActivity;
    }

    if (activeTab === "payments") {
      return completedTrips;
    }

    if (activeTab === "pending") {
      return pendingPayments;
    }

    return activity.filter(
      (item) =>
        item.status === "completed" &&
        item.driver_id !== null
    );
  }, [
    activeTab,
    activity,
    completedTrips,
    filteredActivity,
    pendingPayments,
  ]);
  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-[2rem] bg-slate-200"
              />
            )
          )}
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
              <Sparkles size={15} />
              Centro del pasajero
            </span>

            <h1 className="mt-6 whitespace-nowrap text-[1.45rem] font-black leading-tight tracking-tight sm:text-5xl">
              Herramientas del pasajero
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Consulta tus viajes, pagos, pendientes y
              calificaciones desde una sola pantalla.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Route
                  size={18}
                  className="text-yellow-400"
                />
                {activity.length} viaje
                {activity.length === 1
                  ? ""
                  : "s"}
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <WalletCards
                  size={18}
                  className="text-emerald-400"
                />
                {formatMoney(totalSpent)}
              </span>
            </div>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-3">
            <Link
              href="/dashboard/trips/new"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
            >
              <Navigation size={19} />
              Solicitar nuevo viaje
              <ArrowRight size={19} />
            </Link>

            <button
              type="button"
              onClick={() =>
                loadHistory(true)
              }
              disabled={refreshing}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-6 font-black text-white backdrop-blur transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw
                size={19}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshing
                ? "Actualizando..."
                : "Actualizar historial"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}

      <Card className="overflow-hidden p-2">
        <div className="flex gap-2 overflow-x-auto">
          {passengerToolTabs.map((tab) => {
            const selected =
              activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() =>
                  setActiveTab(tab.value)
                }
                className={cn(
                  "min-w-[150px] shrink-0 rounded-2xl px-5 py-4 text-left transition",
                  selected
                    ? "bg-slate-950 text-white shadow-lg"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                )}
              >
                <span className="block text-sm font-black">
                  {tab.label}
                </span>

                <span
                  className={cn(
                    "mt-1 block text-xs font-semibold",
                    selected
                      ? "text-slate-300"
                      : "text-slate-400"
                  )}
                >
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      {activeTab === "summary" && (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total gastado"
          value={formatMoney(totalSpent)}
          description="En viajes completados"
          icon={CircleDollarSign}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="Completados"
          value={String(
            completedTrips.length
          )}
          description="Viajes terminados"
          icon={CheckCircle2}
          iconClass="bg-blue-100 text-blue-700"
        />

        <StatCard
          label="Activos"
          value={String(
            activeTrips.length
          )}
          description="Solicitados o en curso"
          icon={Clock3}
          iconClass="bg-amber-100 text-amber-800"
        />

        <StatCard
          label="Pagos pendientes"
          value={String(
            pendingPayments.length
          )}
          description={`${reviewedTrips} viajes calificados`}
          icon={CreditCard}
          iconClass="bg-violet-100 text-violet-700"
        />
      </div>
      )}

      {activeTab === "trips" && (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Buscar y organizar
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Tus recorridos
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Filtra por estado o busca una
              dirección o conductor.
            </p>
          </div>

          <div className="relative w-full xl:max-w-md">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Buscar por dirección o conductor..."
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {filters.map((item) => {
            const selected =
              filter === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setFilter(item.value)
                }
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2.5 text-sm font-black transition",
                  selected
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </Card>
      )}

      {visibleActivity.length === 0 ? (
        <Card className="relative flex min-h-[460px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

          <div className="relative max-w-lg text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
              <Route size={35} />
            </span>

            <h2 className="mt-7 text-3xl font-black text-slate-950">
              {activity.length === 0
                ? "Todavía no tienes viajes"
                : "No encontramos resultados"}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              {activity.length === 0
                ? "Cuando solicites tu primer viaje, aparecerá aquí con todos sus detalles."
                : "Prueba con otro término de búsqueda o cambia el filtro seleccionado."}
            </p>

            {activity.length === 0 ? (
              <Link
                href="/dashboard/trips/new"
                className="mt-7 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
              >
                <Navigation size={19} />
                Solicitar mi primer viaje
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-7 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {visibleActivity.map(
            (item) => (
              <TripHistoryCard
                key={item.trip_id}
                item={item}
              />
            )
          )}
        </div>
      )}

      {activity.length > 0 && (
        <Card className="bg-[#0B0F19] text-white">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
                ¿Listo para volver a salir?
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Solicita tu próximo AXI
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Elige origen, destino, forma
                de pago y confirma el viaje
                desde tu panel.
              </p>
            </div>

            <Link
              href="/dashboard/trips/new"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
            >
              <Navigation size={19} />
              Nuevo viaje
              <ArrowRight size={19} />
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}

function TripHistoryCard({
  item,
}: {
  item: PassengerActivity;
}) {
  const isCompleted =
    item.status === "completed";

  const isCancelled =
    item.status === "cancelled";

  const isActive =
    activeTripStatuses.includes(
      item.status
    );

  const paymentPending =
    isCompleted &&
    item.payment_status !== "paid";

  const amount =
    item.amount_due ??
    item.final_price ??
    0;

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div
        className={cn(
          "h-1.5",
          isCompleted &&
            "bg-emerald-500",
          isCancelled &&
            "bg-red-500",
          isActive &&
            "bg-yellow-400"
        )}
      />

      <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                    getTripStatusClasses(
                      item.status
                    )
                  )}
                >
                  {isCompleted && (
                    <CheckCircle2
                      size={14}
                    />
                  )}

                  {isCancelled && (
                    <XCircle size={14} />
                  )}

                  {isActive && (
                    <Clock3 size={14} />
                  )}

                  {tripStatusLabels[
                    item.status
                  ] ?? item.status}
                </span>

                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <CalendarDays
                    size={14}
                  />
                  {formatDate(
                    item.requested_at
                  )}
                </span>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Recorrido
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total
              </p>

              <p className="mt-1 text-3xl font-black text-slate-950">
                {formatMoney(amount)}
              </p>
            </div>
          </div>

          <div className="mt-7 flex gap-4">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <MapPin size={20} />
              </span>

              <span className="my-2 h-12 border-l-2 border-dashed border-slate-300" />

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <Navigation size={20} />
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-8">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Punto de partida
                </p>

                <h2 className="mt-2 text-lg font-black leading-6 text-slate-950">
                  {item.origin_address}
                </h2>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Destino
                </p>

                <p className="mt-2 font-black leading-6 text-slate-950">
                  {item.destination_address}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <InfoBox
              icon={UserRound}
              label="Conductor"
              value={
                item.driver_name ||
                "Sin conductor"
              }
            />

            <InfoBox
              icon={CreditCard}
              label="Método"
              value={
                item.payment_method
                  ? paymentMethodLabels[
                      item
                        .payment_method
                    ] ??
                    item.payment_method
                  : "No seleccionado"
              }
            />

            <InfoBox
              icon={ReceiptText}
              label="Pago"
              value={
                paymentStatusLabels[
                  item.payment_status
                ] ??
                item.payment_status
              }
            />
          </div>

          {item.driver_rating !==
            null && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-yellow-100 bg-yellow-50 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black">
                <Star
                  size={20}
                  fill="currentColor"
                />
              </span>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-yellow-700">
                  Reputación del conductor
                </p>

                <p className="mt-1 font-black text-yellow-900">
                  {Number(
                    item.driver_rating
                  ).toFixed(2)}{" "}
                  de 5 estrellas
                </p>
              </div>
            </div>
          )}

          {item.review_rating !==
            null && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center gap-2">
                <Star
                  size={18}
                  className="text-blue-700"
                  fill="currentColor"
                />

                <p className="font-black text-blue-900">
                  Tu calificación:{" "}
                  {item.review_rating} de 5
                </p>
              </div>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                {item.review_comment ||
                  "No escribiste comentario."}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col border-t border-slate-100 bg-slate-50 p-6 xl:border-l xl:border-t-0">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Detalles del viaje
            </p>

            <div className="mt-5 space-y-3">
              <DetailRow
                label="Estado del viaje"
                value={
                  tripStatusLabels[
                    item.status
                  ] ?? item.status
                }
              />

              <DetailRow
                label="Estado del pago"
                value={
                  paymentStatusLabels[
                    item.payment_status
                  ] ??
                  item.payment_status
                }
                valueClass={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  getPaymentStatusClasses(
                    item.payment_status
                  )
                )}
              />

              {item.completed_at && (
                <DetailRow
                  label="Finalizado"
                  value={formatDate(
                    item.completed_at
                  )}
                />
              )}
            </div>
          </div>

          <div className="mt-7 space-y-3 xl:mt-auto">
            <Link
              href={`/dashboard/trips/${item.trip_id}`}
              className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800"
            >
              <Route size={18} />
              Ver viaje
              <ArrowRight size={18} />
            </Link>

            {paymentPending && (
              <Link
                href={`/dashboard/trips/${item.trip_id}/payment`}
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300"
              >
                <CreditCard
                  size={18}
                />
                Completar pago
              </Link>
            )}

            {isCompleted && (
              <Link
                href={`/dashboard/trips/${item.trip_id}/receipt`}
                className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 transition hover:border-slate-400"
              >
                <ReceiptText
                  size={18}
                />
                Ver recibo
              </Link>
            )}

            {isCompleted &&
              item.driver_id &&
              item.review_rating ===
                null && (
                <Link
                  href={`/dashboard/trips/${item.trip_id}/review`}
                  className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 font-black text-yellow-800 transition hover:bg-yellow-100"
                >
                  <Star size={18} />
                  Calificar viaje
                </Link>
              )}

            {item.driver_id && (
              <Link
                href={`/dashboard/trips/${item.trip_id}/report`}
                className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 font-black text-red-700 transition hover:bg-red-100"
              >
                <ShieldAlert
                  size={18}
                />
                Reportar problema
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
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
  value: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-3 break-words text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-3 text-xs font-semibold text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-110",
            iconClass
          )}
        >
          <Icon size={23} />
        </span>
      </div>
    </Card>
  );
}

function InfoBox({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
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

      <p className="mt-1 break-words text-sm font-black text-slate-700">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-white p-4">
      <span className="text-xs font-semibold text-slate-500">
        {label}
      </span>

      <span
        className={cn(
          "text-right text-xs font-black text-slate-800",
          valueClass
        )}
      >
        {value}
      </span>
    </div>
  );
}



