"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type SosStatus =
  | "active"
  | "acknowledged"
  | "resolved"
  | "false_alarm"
  | string;

type SosAlert = {
  id: string;
  user_id: string;
  trip_id: string | null;
  latitude: number | null;
  longitude: number | null;
  status: SosStatus;
  message: string | null;
  created_at: string;
  profiles:
    | {
        full_name: string | null;
        phone: string | null;
      }
    | {
        full_name: string | null;
        phone: string | null;
      }[]
    | null;
};

const statusLabels: Record<string, string> = {
  active: "Alerta activa",
  acknowledged: "En atención",
  resolved: "Resuelta",
  false_alarm: "Falsa alarma",
};

export default function AdminSOSPage() {
  const router = useRouter();

  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadAlerts = useCallback(
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

      if (!isAdmin(profile?.role)) {
        router.replace("/dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("sos_alerts")
        .select(`
          id,
          user_id,
          trip_id,
          latitude,
          longitude,
          status,
          message,
          created_at,
          profiles:user_id (
            full_name,
            phone
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        setMessage(
          `No fue posible cargar las alertas: ${error.message}`
        );
      } else {
        setAlerts((data ?? []) as SosAlert[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    let channel:
      ReturnType<typeof supabase.channel> | null = null;

    const timer = window.setTimeout(() => {
      void loadAlerts();

      channel = supabase
        .channel(
          `admin-sos-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sos_alerts",
          },
          () => {
            void loadAlerts(true);
          }
        )
        .subscribe();
    }, 0);

    return () => {
      window.clearTimeout(timer);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadAlerts]);

  async function updateAlert(
    alertId: string,
    nextStatus: string
  ) {
    const actionLabels: Record<string, string> = {
      acknowledged: "tomar esta alerta",
      resolved: "marcar la alerta como resuelta",
      false_alarm: "marcarla como falsa alarma",
    };

    const confirmed = window.confirm(
      `¿Confirmas que deseas ${
        actionLabels[nextStatus] ??
        "actualizar esta alerta"
      }?`
    );

    if (!confirmed) return;

    setProcessing(alertId);
    setMessage("");

    const { error } = await supabase.rpc(
      "update_sos_alert",
      {
        alert_id_value: alertId,
        new_status_value: nextStatus,
      }
    );

    if (error) {
      setMessage(
        `No fue posible actualizar la alerta: ${error.message}`
      );
    } else {
      setMessage("Alerta actualizada correctamente.");
      await loadAlerts(true);
    }

    setProcessing(null);
  }

  function getProfile(alert: SosAlert) {
    return Array.isArray(alert.profiles)
      ? alert.profiles[0]
      : alert.profiles;
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function openLocation(alert: SosAlert) {
    if (
      alert.latitude === null ||
      alert.longitude === null
    ) {
      return;
    }

    const url =
      `https://www.google.com/maps/search/?api=1&query=` +
      `${alert.latitude},${alert.longitude}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const activeAlerts = alerts.filter(
    (alert) => alert.status === "active"
  );

  const acknowledgedAlerts = alerts.filter(
    (alert) => alert.status === "acknowledged"
  );

  const closedAlerts = alerts.filter(
    (alert) =>
      alert.status === "resolved" ||
      alert.status === "false_alarm"
  );

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="h-96 animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#450a0a,#991b1b)] px-6 py-8 text-white shadow-[0_25px_80px_rgba(127,29,29,0.25)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-100">
              <Siren
                size={16}
                className={
                  activeAlerts.length > 0
                    ? "animate-pulse"
                    : ""
                }
              />

              Centro de seguridad AXI
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Control de alertas SOS
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-red-100/80 sm:text-base">
              Supervisa emergencias de pasajeros y conductores,
              consulta su ubicación y registra la atención.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-100/70">
                  Emergencias activas
                </p>

                <p className="mt-2 text-6xl font-black">
                  {activeAlerts.length}
                </p>
              </div>

              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-red-700">
                <ShieldAlert size={30} />
              </span>
            </div>

            <button
              type="button"
              onClick={() => loadAlerts(true)}
              disabled={refreshing}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-black text-red-800 transition hover:bg-red-50 disabled:opacity-60"
            >
              <RefreshCw
                size={18}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />

              Actualizar alertas
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <MetricCard
          icon={AlertTriangle}
          label="Alertas activas"
          value={activeAlerts.length}
          variant="danger"
        />

        <MetricCard
          icon={Activity}
          label="En atención"
          value={acknowledgedAlerts.length}
          variant="warning"
        />

        <MetricCard
          icon={CheckCircle2}
          label="Casos cerrados"
          value={closedAlerts.length}
          variant="success"
        />
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.includes("correctamente")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {message}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-emerald-100 text-emerald-700">
            <ShieldCheck size={34} />
          </span>

          <h2 className="mt-6 text-2xl font-black text-slate-950">
            No hay alertas registradas
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            El centro de seguridad se encuentra sin emergencias.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {alerts.map((alert) => {
            const profile = getProfile(alert);
            const isProcessing =
              processing === alert.id;

            const hasLocation =
              alert.latitude !== null &&
              alert.longitude !== null;

            return (
              <article
                key={alert.id}
                className={cn(
                  "overflow-hidden rounded-[2rem] border bg-white shadow-[0_15px_50px_rgba(15,23,42,0.07)]",
                  alert.status === "active"
                    ? "border-red-300 ring-4 ring-red-100"
                    : "border-slate-200"
                )}
              >
                {alert.status === "active" && (
                  <div className="flex items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">
                    <Siren
                      size={16}
                      className="animate-pulse"
                    />
                    Requiere atención inmediata
                  </div>
                )}

                <div className="p-6 sm:p-8">
                  <div className="flex flex-col gap-7 xl:flex-row xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-4">
                        <span
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-2xl",
                            alert.status === "active"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          <UserRound size={25} />
                        </span>

                        <div>
                          <h2 className="text-xl font-black text-slate-950">
                            {profile?.full_name ||
                              "Usuario AXI"}
                          </h2>

                          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                            <Clock3 size={15} />
                            {formatDate(alert.created_at)}
                          </p>
                        </div>

                        <StatusBadge
                          status={alert.status}
                        />
                      </div>

                      <div className="mt-7 grid gap-4 md:grid-cols-2">
                        <InformationCard
                          icon={PhoneCall}
                          label="Teléfono"
                          value={
                            profile?.phone ||
                            "No registrado"
                          }
                        />

                        <InformationCard
                          icon={LocateFixed}
                          label="Ubicación"
                          value={
                            hasLocation
                              ? "Coordenadas disponibles"
                              : "No disponible"
                          }
                        />
                      </div>

                      {alert.message && (
                        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5">
                          <p className="text-xs font-black uppercase tracking-wider text-red-600">
                            Mensaje de emergencia
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-red-800">
                            {alert.message}
                          </p>
                        </div>
                      )}

                      {hasLocation && (
                        <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
                          <div className="flex items-start gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                              <MapPin size={22} />
                            </span>

                            <div>
                              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                                Ubicación registrada
                              </p>

                              <p className="mt-2 text-sm font-bold">
                                {Number(
                                  alert.latitude
                                ).toFixed(6)}
                                ,{" "}
                                {Number(
                                  alert.longitude
                                ).toFixed(6)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openLocation(alert)
                            }
                            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-black text-slate-950 transition hover:bg-slate-100"
                          >
                            <ExternalLink size={17} />
                            Abrir en Google Maps
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-3 xl:w-72">
                      {profile?.phone && (
                        <a
                          href={`tel:${profile.phone}`}
                          className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white"
                        >
                          <PhoneCall size={18} />
                          Llamar al usuario
                        </a>
                      )}

                      {alert.status === "active" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAlert(
                              alert.id,
                              "acknowledged"
                            )
                          }
                          disabled={isProcessing}
                          className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black disabled:opacity-50"
                        >
                          <ShieldCheck size={18} />

                          {isProcessing
                            ? "Actualizando..."
                            : "Tomar alerta"}
                        </button>
                      )}

                      {alert.status ===
                        "acknowledged" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAlert(
                              alert.id,
                              "resolved"
                            )
                          }
                          disabled={isProcessing}
                          className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 font-black text-white disabled:opacity-50"
                        >
                          <CheckCircle2 size={18} />

                          {isProcessing
                            ? "Actualizando..."
                            : "Marcar resuelta"}
                        </button>
                      )}

                      {[
                        "active",
                        "acknowledged",
                      ].includes(alert.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAlert(
                              alert.id,
                              "false_alarm"
                            )
                          }
                          disabled={isProcessing}
                          className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 font-black text-slate-600 disabled:opacity-50"
                        >
                          <XCircle size={18} />
                          Falsa alarma
                        </button>
                      )}

                      {alert.trip_id && (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/dashboard/trips/${alert.trip_id}`
                            )
                          }
                          className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 font-black text-slate-700"
                        >
                          Ver viaje
                          <ArrowRight size={18} />
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
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  variant: "danger" | "warning" | "success";
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            variant === "danger" &&
              "bg-red-100 text-red-700",
            variant === "warning" &&
              "bg-amber-100 text-amber-700",
            variant === "success" &&
              "bg-emerald-100 text-emerald-700"
          )}
        >
          <Icon size={22} />
        </span>

        <p className="text-4xl font-black text-slate-950">
          {value}
        </p>
      </div>

      <p className="mt-5 text-sm font-black text-slate-600">
        {label}
      </p>
    </div>
  );
}

function InformationCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon size={19} className="text-slate-500" />

      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-800">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: SosStatus;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-black",
        status === "active" &&
          "bg-red-100 text-red-700",
        status === "acknowledged" &&
          "bg-amber-100 text-amber-700",
        status === "resolved" &&
          "bg-emerald-100 text-emerald-700",
        status === "false_alarm" &&
          "bg-slate-100 text-slate-600"
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
