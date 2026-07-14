"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReportReason =
  | "unsafe_behavior"
  | "harassment"
  | "fraud"
  | "vehicle_issue"
  | "payment_issue"
  | "no_show"
  | "inappropriate_behavior"
  | "other";

type TripData = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
  origin_address: string;
  destination_address: string;
};

const reasonLabels: Record<
  ReportReason,
  string
> = {
  unsafe_behavior: "Conducta insegura",
  harassment: "Acoso",
  fraud: "Fraude",
  vehicle_issue: "Problema con el vehículo",
  payment_issue: "Problema con el pago",
  no_show: "No se presentó",
  inappropriate_behavior:
    "Comportamiento inapropiado",
  other: "Otro",
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

  const [description, setDescription] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function loadReportData() {
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
        "Este viaje no tiene conductor asignado."
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
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReportData();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [tripId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!trip) {
      return;
    }

    const cleanDescription =
      description.trim();

    if (cleanDescription.length < 10) {
      setMessage(
        "Describe el problema con al menos 10 caracteres."
      );
      return;
    }

    if (cleanDescription.length > 2000) {
      setMessage(
        "La descripción no puede superar 2000 caracteres."
      );
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que deseas enviar este reporte?"
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "submit_user_report",
      {
        requested_trip_id: trip.id,
        reported_user_id_value:
          reportedUserId,
        report_reason_value:
          reason,
        report_description_value:
          cleanDescription,
      }
    );

    setSaving(false);

    if (error) {
      setMessage(
        `No fue posible enviar el reporte: ${error.message}`
      );
      return;
    }

    alert(
      "Reporte enviado correctamente."
    );

    router.push(
      `/dashboard/trips/${trip.id}`
    );
  }


  if (loading) {
    return <p>Cargando reporte...</p>;
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible abrir el reporte."}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Seguridad y soporte
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Reportar usuario
        </h1>

        <p className="mt-2 text-gray-600">
          Reportarás a {reportedUserName}.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl bg-white p-8 shadow-sm"
      >
        <div className="rounded-xl bg-gray-50 p-5">
          <p className="text-sm text-gray-500">
            Viaje relacionado
          </p>

          <p className="mt-2 font-semibold">
            {trip.origin_address}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            hacia {trip.destination_address}
          </p>
        </div>

        <div>
          <label
            htmlFor="reason"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Motivo del reporte
          </label>

          <select
            id="reason"
            value={reason}
            onChange={(event) =>
              setReason(
                event.target.value as ReportReason
              )
            }
            className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
          >
            {(
              Object.entries(reasonLabels) as [
                ReportReason,
                string,
              ][]
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Describe lo ocurrido
          </label>

          <textarea
            id="description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            rows={8}
            maxLength={2000}
            placeholder="Explica qué pasó con el mayor detalle posible..."
            className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
          />

          <p className="mt-2 text-right text-xs text-gray-400">
            {description.length}/2000
          </p>
        </div>

        <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
          Los reportes falsos o malintencionados pueden provocar restricciones en la cuenta.
        </div>

        {message && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/trips/${trip.id}`)
            }
            className="flex-1 rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Enviando..."
              : "Enviar reporte"}
          </button>
        </div>
      </form>
    </section>
  );
}
