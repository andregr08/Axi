"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CarFront,
  CheckCircle2,
  FileWarning,
  Flag,
  MapPin,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserX,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type ReportReason =
  | "unsafe_behavior"
  | "harassment"
  | "fraud"
  | "vehicle_issue"
  | "payment_issue"
  | "no_show"
  | "inappropriate_behavior"
  | "other";

type Severity = "low" | "medium" | "high";

type TripData = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
  origin_address: string;
  destination_address: string;
};

const REPORT_REASONS: Array<{
  value: ReportReason;
  title: string;
  description: string;
  icon: typeof ShieldAlert;
}> = [
  {
    value: "unsafe_behavior",
    title: "Conducta insegura",
    description: "Manejo riesgoso o acciones que pusieron a alguien en peligro.",
    icon: ShieldAlert,
  },
  {
    value: "harassment",
    title: "Acoso",
    description: "Comentarios, contacto o comportamiento intimidante.",
    icon: UserX,
  },
  {
    value: "fraud",
    title: "Fraude",
    description: "Cobros, engaños o información falsa.",
    icon: FileWarning,
  },
  {
    value: "vehicle_issue",
    title: "Problema con el vehículo",
    description: "El taxi no coincidía o presentaba una condición insegura.",
    icon: CarFront,
  },
  {
    value: "payment_issue",
    title: "Problema con el pago",
    description: "Cobro incorrecto, adeudo o desacuerdo con el monto.",
    icon: Banknote,
  },
  {
    value: "no_show",
    title: "No se presentó",
    description: "La otra persona no llegó al punto acordado.",
    icon: MapPin,
  },
  {
    value: "inappropriate_behavior",
    title: "Comportamiento inapropiado",
    description: "Actitud ofensiva, agresiva o contraria a las reglas de AXI.",
    icon: MessageSquareWarning,
  },
  {
    value: "other",
    title: "Otro motivo",
    description: "El problema no corresponde a las categorías anteriores.",
    icon: Flag,
  },
];

const severityLabels: Record<Severity, string> = {
  low: "Leve",
  medium: "Importante",
  high: "Grave",
};

export default function TripReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] =
    useState<TripData | null>(null);

  const [reportedUserId, setReportedUserId] =
    useState("");

  const [reportedUserName, setReportedUserName] =
    useState("Usuario AXI");

  const [reason, setReason] =
    useState<ReportReason>(
      "inappropriate_behavior"
    );

  const [severity, setSeverity] =
    useState<Severity>("medium");

  const [description, setDescription] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data, error } =
      await supabase
        .from("trips")
        .select(`
          id,
          passenger_id,
          driver_id,
          status,
          origin_address,
          destination_address
        `)
        .eq("id", tripId)
        .single();

    if (error || !data) {
      setMessage(
        `No fue posible cargar el viaje: ${
          error?.message ??
          "Viaje no encontrado"
        }`
      );
      setLoading(false);
      return;
    }

    const isPassenger =
      data.passenger_id === session.user.id;

    const isDriver =
      data.driver_id === session.user.id;

    if (!isPassenger && !isDriver) {
      setMessage(
        "No tienes permiso para reportar este viaje."
      );
      setLoading(false);
      return;
    }

    if (!data.driver_id) {
      setMessage(
        "Este viaje todavía no tiene conductor asignado."
      );
      setLoading(false);
      return;
    }

    const targetUserId = isPassenger
      ? data.driver_id
      : data.passenger_id;

    setTrip(data as TripData);
    setReportedUserId(targetUserId);

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", targetUserId)
        .single();

    setReportedUserName(
      profile?.full_name ||
      "Usuario AXI"
    );

    setLoading(false);
  }, [router, tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReportData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReportData]);

  function handleReview(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const cleanDescription =
      description.trim();

    if (cleanDescription.length < 10) {
      setMessage(
        "Describe lo ocurrido con al menos 10 caracteres."
      );
      return;
    }

    if (cleanDescription.length > 2000) {
      setMessage(
        "La descripción no puede superar 2000 caracteres."
      );
      return;
    }

    setConfirmOpen(true);
  }

  async function submitReport() {
    if (!trip) return;

    setSaving(true);
    setMessage("");

    const reportText = [
      `Nivel de gravedad: ${severityLabels[severity]}.`,
      description.trim(),
    ].join("\n\n");

    const { error } = await supabase.rpc(
      "submit_user_report",
      {
        requested_trip_id: trip.id,
        reported_user_id_value:
          reportedUserId,
        report_reason_value:
          reason,
        report_description_value:
          reportText,
      }
    );

    setSaving(false);

    if (error) {
      setMessage(
        `No fue posible enviar el reporte: ${error.message}`
      );
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    setSubmitted(true);
  }

  const selectedReason =
    REPORT_REASONS.find(
      (item) => item.value === reason
    ) ?? REPORT_REASONS[0];

  if (loading) {
    return (
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200" />
        <div className="h-[620px] animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  if (!trip) {
    return (
      <section className="mx-auto flex min-h-[65vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center">
          <AlertOctagon
            size={38}
            className="mx-auto text-red-700"
          />

          <h1 className="mt-5 text-2xl font-black text-red-900">
            No fue posible abrir el reporte
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-700">
            {message}
          </p>

          <Link
            href={`/dashboard/trips/${tripId}`}
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <ArrowLeft size={18} />
            Volver al viaje
          </Link>
        </div>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-12">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={36} />
          </span>

          <h1 className="mt-7 text-3xl font-black text-slate-950">
            Reporte enviado
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            El equipo de AXI podrá revisar el viaje, la información
            relacionada y la descripción que proporcionaste.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/trips/${trip.id}`
              )
            }
            className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 font-black text-black"
          >
            Volver al viaje
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-5xl space-y-8">
        <div>
          <Link
            href={`/dashboard/trips/${trip.id}`}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-950 hover:text-white"
          >
            <ArrowLeft size={18} />
            Volver al viaje
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#450a0a,#991b1b)] px-6 py-8 text-white shadow-[0_25px_80px_rgba(127,29,29,0.22)] sm:px-9 sm:py-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-400/20 blur-3xl" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em]">
                <ShieldAlert size={16} />
                Seguridad AXI
              </span>

              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
                Reportar un incidente
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-red-100/80">
                Reportarás a{" "}
                <strong className="text-white">
                  {reportedUserName}
                </strong>
                . Describe lo ocurrido con información clara y verdadera.
              </p>
            </div>

            <div className="rounded-[1.7rem] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-wider text-red-100/70">
                Emergencia inmediata
              </p>

              <a
                href="tel:911"
                className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 font-black text-red-800"
              >
                <Siren size={18} />
                Llamar al 911
              </a>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleReview}
          className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"
        >
          <div className="space-y-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                Paso 1
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                ¿Qué ocurrió?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Selecciona la categoría que mejor describa el problema.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {REPORT_REASONS.map((item) => {
                  const Icon = item.icon;
                  const active =
                    reason === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        setReason(item.value)
                      }
                      className={cn(
                        "flex items-start gap-4 rounded-2xl border p-4 text-left transition",
                        active
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          active
                            ? "bg-yellow-400 text-black"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        <Icon size={20} />
                      </span>

                      <div>
                        <p className="text-sm font-black">
                          {item.title}
                        </p>

                        <p
                          className={cn(
                            "mt-1 text-xs leading-5",
                            active
                              ? "text-slate-400"
                              : "text-slate-500"
                          )}
                        >
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                Paso 2
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Nivel de gravedad
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["low", "Leve", "No existió riesgo inmediato."],
                    ["medium", "Importante", "Requiere revisión de AXI."],
                    ["high", "Grave", "Hubo riesgo o conducta seria."],
                  ] as Array<[Severity, string, string]>
                ).map(([value, title, detail]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setSeverity(value)
                    }
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      severity === value
                        ? value === "high"
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-yellow-400 bg-yellow-50"
                        : "border-slate-200"
                    )}
                  >
                    <p className="font-black">
                      {title}
                    </p>

                    <p
                      className={cn(
                        "mt-2 text-xs leading-5",
                        severity === value &&
                          value === "high"
                          ? "text-red-100"
                          : "text-slate-500"
                      )}
                    >
                      {detail}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600"
              >
                Paso 3
              </label>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Describe lo ocurrido
              </h2>

              <textarea
                id="description"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                rows={9}
                maxLength={2000}
                placeholder="Incluye qué pasó, dónde ocurrió, cuándo ocurrió y cualquier información que pueda ayudar a revisar el caso..."
                className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 outline-none transition focus:border-yellow-400 focus:bg-white"
              />

              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>
                  Mínimo 10 caracteres
                </span>

                <span>
                  {description.length}/2000
                </span>
              </div>
            </div>

            {message && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
              >
                {message}
              </div>
            )}
          </div>

          <aside className="h-fit space-y-5 xl:sticky xl:top-8">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                Viaje relacionado
              </p>

              <div className="mt-5 space-y-4">
                <RoutePoint
                  label="Origen"
                  value={trip.origin_address}
                />

                <RoutePoint
                  label="Destino"
                  value={trip.destination_address}
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
                Resumen
              </p>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Usuario reportado"
                  value={reportedUserName}
                />

                <SummaryRow
                  label="Motivo"
                  value={selectedReason.title}
                />

                <SummaryRow
                  label="Gravedad"
                  value={severityLabels[severity]}
                />
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  description.trim().length < 10
                }
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 font-black text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-40"
              >
                Revisar reporte
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-amber-700"
                />

                <p className="text-xs leading-6 text-amber-800">
                  Los reportes falsos o malintencionados pueden provocar
                  restricciones en la cuenta.
                </p>
              </div>
            </div>
          </aside>
        </form>
      </section>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-report-title"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="relative bg-red-600 p-7 text-white">
              <button
                type="button"
                onClick={() =>
                  setConfirmOpen(false)
                }
                disabled={saving}
                className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>

              <AlertOctagon size={32} />

              <h2
                id="confirm-report-title"
                className="mt-5 text-3xl font-black"
              >
                Confirma el reporte
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-100">
                Revisa los datos antes de enviarlos al equipo de AXI.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="space-y-4">
                <SummaryRow
                  label="Usuario"
                  value={reportedUserName}
                />

                <SummaryRow
                  label="Motivo"
                  value={selectedReason.title}
                />

                <SummaryRow
                  label="Gravedad"
                  value={severityLabels[severity]}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Descripción
                </p>

                <p className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {description.trim()}
                </p>
              </div>

              <button
                type="button"
                onClick={submitReport}
                disabled={saving}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 font-black text-white disabled:opacity-60"
              >
                {saving
                  ? "Enviando reporte..."
                  : "Confirmar y enviar"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setConfirmOpen(false)
                }
                disabled={saving}
                className="mt-3 h-12 w-full rounded-2xl border border-slate-200 font-black text-slate-600"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RoutePoint({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-white bg-yellow-400 shadow" />

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

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="max-w-[60%] text-right text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}
