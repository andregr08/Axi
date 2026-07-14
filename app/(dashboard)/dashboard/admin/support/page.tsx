"use client";

import { useEffect, useMemo, useState } from "react";
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
  user_id: string;
  trip_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  profiles:
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[]
    | null;
  trips:
    | {
        origin_address: string;
        destination_address: string;
      }
    | {
        origin_address: string;
        destination_address: string;
      }[]
    | null;
};

const categoryLabels: Record<TicketCategory, string> = {
  trip_issue: "Problema con un viaje",
  payment_issue: "Problema con un pago",
  driver_issue: "Problema con un conductor",
  passenger_issue: "Problema con un pasajero",
  lost_item: "Objeto olvidado",
  refund_request: "Solicitud de reembolso",
  safety_issue: "Problema de seguridad",
  account_issue: "Problema con la cuenta",
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
  waiting_user: "Esperando usuario",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export default function AdminSupportPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadTickets() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .select(`
        id,
        user_id,
        trip_id,
        category,
        subject,
        description,
        priority,
        status,
        resolution,
        created_at,
        updated_at,
        profiles:user_id (
          full_name
        ),
        trips:trip_id (
          origin_address,
          destination_address
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error cargando tickets: ${error.message}`);
    } else {
      setTickets((data ?? []) as SupportTicket[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function updateTicket(
    ticket: SupportTicket,
    newStatus: TicketStatus,
    newPriority: TicketPriority
  ) {
    let resolution = ticket.resolution;

    if (
      newStatus === "resolved" ||
      newStatus === "closed"
    ) {
      resolution = window.prompt(
        "Escribe la resolución del caso:",
        ticket.resolution ?? ""
      );

      if (!resolution?.trim() || resolution.trim().length < 5) {
        setMessage("Debes escribir una resolución de al menos 5 caracteres.");
        return;
      }
    }

    const confirmed = window.confirm(
      `¿Confirmas cambiar el ticket a "${statusLabels[newStatus]}"?`
    );

    if (!confirmed) return;

    setProcessingId(ticket.id);
    setMessage("");

    const { error } = await supabase.rpc(
      "update_support_ticket",
      {
        ticket_id_value: ticket.id,
        new_status_value: newStatus,
        new_priority_value: newPriority,
        resolution_value: resolution?.trim() || null,
      }
    );

    if (error) {
      setMessage(`Error actualizando ticket: ${error.message}`);
    } else {
      setMessage("Ticket actualizado correctamente.");
      await loadTickets();
    }

    setProcessingId(null);
  }

  function getProfile(ticket: SupportTicket) {
    return Array.isArray(ticket.profiles)
      ? ticket.profiles[0]
      : ticket.profiles;
  }

  function getTrip(ticket: SupportTicket) {
    return Array.isArray(ticket.trips)
      ? ticket.trips[0]
      : ticket.trips;
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all" ||
        ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        ticket.priority === priorityFilter;

      return matchesStatus && matchesPriority;
    });
  }, [tickets, statusFilter, priorityFilter]);

  const openCount = tickets.filter(
    (ticket) => ticket.status === "open"
  ).length;

  const reviewCount = tickets.filter(
    (ticket) => ticket.status === "in_review"
  ).length;

  const urgentCount = tickets.filter(
    (ticket) => ticket.priority === "urgent"
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) =>
      ticket.status === "resolved" ||
      ticket.status === "closed"
  ).length;

  if (loading) {
    return <p>Cargando soporte...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Soporte
        </h1>

        <p className="mt-2 text-gray-600">
          Gestiona las solicitudes de pasajeros y conductores.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Abiertos</p>
          <p className="mt-3 text-3xl font-bold">{openCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">En revisión</p>
          <p className="mt-3 text-3xl font-bold">{reviewCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Urgentes</p>
          <p className="mt-3 text-3xl font-bold">{urgentCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Resueltos</p>
          <p className="mt-3 text-3xl font-bold">{resolvedCount}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Estado
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="w-full rounded-xl border px-4 py-3"
          >
            <option value="all">Todos</option>

            {(
              Object.entries(statusLabels) as [
                TicketStatus,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Prioridad
          </label>

          <select
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value)
            }
            className="w-full rounded-xl border px-4 py-3"
          >
            <option value="all">Todas</option>

            {(
              Object.entries(priorityLabels) as [
                TicketPriority,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {filteredTickets.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              No hay tickets con estos filtros.
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const profile = getProfile(ticket);
            const trip = getTrip(ticket);
            const processing = processingId === ticket.id;

            return (
              <article
                key={ticket.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-6 xl:flex-row">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">
                        {ticket.subject}
                      </h2>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                        {statusLabels[ticket.status]}
                      </span>

                      <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                        {priorityLabels[ticket.priority]}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-gray-500">
                      Usuario:{" "}
                      {profile?.full_name || "Usuario sin nombre"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Categoría: {categoryLabels[ticket.category]}
                    </p>

                    {trip && (
                      <p className="mt-1 text-sm text-gray-500">
                        Viaje: {trip.origin_address} →{" "}
                        {trip.destination_address}
                      </p>
                    )}

                    <p className="mt-4 whitespace-pre-wrap text-gray-700">
                      {ticket.description}
                    </p>

                    {ticket.resolution && (
                      <div className="mt-5 rounded-xl bg-green-50 p-4">
                        <p className="text-sm font-semibold text-green-700">
                          Resolución
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm text-green-700">
                          {ticket.resolution}
                        </p>
                      </div>
                    )}

                    <p className="mt-5 text-xs text-gray-400">
                      Creado: {formatDate(ticket.created_at)}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Actualizado: {formatDate(ticket.updated_at)}
                    </p>
                  </div>

                  <div className="xl:w-72">
                    <label className="mb-2 block text-sm font-semibold">
                      Prioridad
                    </label>

                    <select
                      value={ticket.priority}
                      onChange={(event) =>
                        void updateTicket(
                          ticket,
                          ticket.status,
                          event.target.value as TicketPriority
                        )
                      }
                      disabled={processing}
                      className="w-full rounded-xl border px-4 py-3 disabled:opacity-50"
                    >
                      {(
                        Object.entries(priorityLabels) as [
                          TicketPriority,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <div className="mt-4 space-y-3">
                      {ticket.status === "open" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateTicket(
                              ticket,
                              "in_review",
                              ticket.priority
                            )
                          }
                          disabled={processing}
                          className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          Pasar a revisión
                        </button>
                      )}

                      {ticket.status !== "resolved" &&
                        ticket.status !== "closed" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                updateTicket(
                                  ticket,
                                  "waiting_user",
                                  ticket.priority
                                )
                              }
                              disabled={processing}
                              className="w-full rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"
                            >
                              Pedir información
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateTicket(
                                  ticket,
                                  "resolved",
                                  ticket.priority
                                )
                              }
                              disabled={processing}
                              className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                            >
                              Resolver
                            </button>
                          </>
                        )}

                      {ticket.status === "resolved" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateTicket(
                              ticket,
                              "closed",
                              ticket.priority
                            )
                          }
                          disabled={processing}
                          className="w-full rounded-xl bg-gray-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          Cerrar caso
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
