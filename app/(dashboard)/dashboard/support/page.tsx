"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TicketStatus =
  | "open"
  | "in_review"
  | "waiting_user"
  | "resolved"
  | "closed";

type TicketPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type TicketCategory =
  | "trip_issue"
  | "payment_issue"
  | "driver_issue"
  | "passenger_issue"
  | "lost_item"
  | "refund_request"
  | "safety_issue"
  | "account_issue"
  | "other";

type SupportTicket = {
  id: string;
  trip_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

type TripOption = {
  id: string;
  origin_address: string;
  destination_address: string;
  requested_at: string;
};

const categoryLabels: Record<TicketCategory, string> = {
  trip_issue: "Problema con un viaje",
  payment_issue: "Problema con un pago",
  driver_issue: "Problema con un conductor",
  passenger_issue: "Problema con un pasajero",
  lost_item: "Objeto olvidado",
  refund_request: "Solicitud de reembolso",
  safety_issue: "Problema de seguridad",
  account_issue: "Problema con mi cuenta",
  other: "Otro",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const statusLabels: Record<TicketStatus, string> = {
  open: "Abierto",
  in_review: "En revisión",
  waiting_user: "Esperando respuesta",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export default function SupportPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);

  const [tripId, setTripId] = useState("");
  const [category, setCategory] =
    useState<TicketCategory>("trip_issue");
  const [priority, setPriority] =
    useState<TicketPriority>("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSupportData() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: ticketsData, error: ticketsError } =
      await supabase
        .from("support_tickets")
        .select(`
          id,
          trip_id,
          category,
          subject,
          description,
          priority,
          status,
          resolution,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

    if (ticketsError) {
      setMessage(
        `Error cargando solicitudes: ${ticketsError.message}`
      );
    } else {
      setTickets((ticketsData ?? []) as SupportTicket[]);
    }

    const { data: tripsData, error: tripsError } =
      await supabase
        .from("trips")
        .select(`
          id,
          origin_address,
          destination_address,
          requested_at
        `)
        .order("requested_at", { ascending: false })
        .limit(50);

    if (tripsError) {
      setMessage(
        `Error cargando viajes: ${tripsError.message}`
      );
    } else {
      setTrips((tripsData ?? []) as TripOption[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSupportData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (subject.trim().length < 5) {
      setMessage(
        "El asunto debe tener al menos 5 caracteres."
      );
      return;
    }

    if (description.trim().length < 10) {
      setMessage(
        "La descripción debe tener al menos 10 caracteres."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "create_support_ticket",
      {
        related_trip_id: tripId || null,
        ticket_category: category,
        ticket_subject: subject.trim(),
        ticket_description: description.trim(),
        ticket_priority: priority,
      }
    );

    setSaving(false);

    if (error) {
      setMessage(
        `Error creando solicitud: ${error.message}`
      );
      return;
    }

    setTripId("");
    setCategory("trip_issue");
    setPriority("normal");
    setSubject("");
    setDescription("");

    setMessage(
      "Solicitud de soporte creada correctamente."
    );

    await loadSupportData();
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getTripLabel(ticketTripId: string | null) {
    if (!ticketTripId) return "Sin viaje relacionado";

    const trip = trips.find(
      (item) => item.id === ticketTripId
    );

    if (!trip) return "Viaje relacionado";

    return `${trip.origin_address} → ${trip.destination_address}`;
  }

  if (loading) {
    return <p>Cargando centro de ayuda...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Soporte
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Centro de ayuda
        </h1>

        <p className="mt-2 text-gray-600">
          Reporta un problema y consulta el estado de tus solicitudes.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-6 rounded-2xl bg-white p-7 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-bold">
              Nueva solicitud
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Describe el problema con el mayor detalle posible.
            </p>
          </div>

          <div>
            <label
              htmlFor="trip"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Viaje relacionado
            </label>

            <select
              id="trip"
              value={tripId}
              onChange={(event) =>
                setTripId(event.target.value)
              }
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            >
              <option value="">
                Sin viaje relacionado
              </option>

              {trips.map((trip) => (
                <option
                  key={trip.id}
                  value={trip.id}
                >
                  {trip.origin_address} →{" "}
                  {trip.destination_address}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="category"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Categoría
            </label>

            <select
              id="category"
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as TicketCategory
                )
              }
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            >
              {(
                Object.entries(categoryLabels) as [
                  TicketCategory,
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
              htmlFor="priority"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Prioridad
            </label>

            <select
              id="priority"
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as TicketPriority
                )
              }
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            >
              {(
                Object.entries(priorityLabels) as [
                  TicketPriority,
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
              htmlFor="subject"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Asunto
            </label>

            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              maxLength={150}
              placeholder="Ejemplo: Cobro incorrecto"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Descripción
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={7}
              maxLength={3000}
              placeholder="Describe qué ocurrió..."
              className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
            />

            <p className="mt-2 text-right text-xs text-gray-400">
              {description.length}/3000
            </p>
          </div>

          {message && (
            <div className="rounded-xl bg-gray-100 p-4 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Enviando..."
              : "Enviar solicitud"}
          </button>
        </form>

        <div>
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Mis solicitudes
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Consulta el avance y la resolución de cada caso.
            </p>
          </div>

          {tickets.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="font-semibold text-gray-700">
                No tienes solicitudes de soporte
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {tickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-5 lg:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold">
                          {ticket.subject}
                        </h3>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                          {statusLabels[ticket.status]}
                        </span>

                        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                          {priorityLabels[ticket.priority]}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
                        {categoryLabels[ticket.category]}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {getTripLabel(ticket.trip_id)}
                      </p>

                      <p className="mt-4 whitespace-pre-wrap text-gray-700">
                        {ticket.description}
                      </p>

                      {ticket.resolution && (
                        <div className="mt-5 rounded-xl bg-green-50 p-4">
                          <p className="text-sm font-semibold text-green-700">
                            Resolución
                          </p>

                          <p className="mt-1 text-sm text-green-700">
                            {ticket.resolution}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-gray-400 lg:text-right">
                      <p>
                        Creado: {formatDate(ticket.created_at)}
                      </p>

                      <p className="mt-1">
                        Actualizado:{" "}
                        {formatDate(ticket.updated_at)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
