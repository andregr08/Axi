"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Headphones,
  Inbox,
  LifeBuoy,
  LoaderCircle,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

type TicketStatus =
  "open" | "in_review" | "waiting_user" | "resolved" | "closed";

type TicketPriority = "low" | "normal" | "high" | "urgent";

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

type TicketFilter = "all" | "open" | "in-progress" | "resolved" | "urgent";

type TicketProfile = {
  id?: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

type TicketTrip = {
  id: string;
  trip_number: number;
  trip_code: string;
  origin_address: string;
  destination_address: string;
  status: string;
  requested_at: string;
};

type SupportTicket = {
  id: string;
  user_id: string;
  trip_id: string | null;
  conversation_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_admin_id: string | null;
  resolution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  requester: TicketProfile | null;
  assigned_admin: TicketProfile | null;
  trip: TicketTrip | null;
};

type SupportAgent = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type AIConversationStatus = "active" | "waiting_human" | "closed";

type SupportChatMessage = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "assistant" | "support" | "system";
  sender_user_id: string | null;
  content: string;
  created_at: string;
};

const statusLabels: Record<TicketStatus, string> = {
  open: "Abierto",
  in_review: "En revisión",
  waiting_user: "Esperando usuario",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const categoryLabels: Record<TicketCategory, string> = {
  trip_issue: "Problema con viaje",
  payment_issue: "Problema con pago",
  driver_issue: "Problema con conductor",
  passenger_issue: "Problema con pasajero",
  lost_item: "Objeto olvidado",
  refund_request: "Solicitud de reembolso",
  safety_issue: "Problema de seguridad",
  account_issue: "Problema con cuenta",
  other: "Otro",
};

export default function AdminSupportPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketFilter>("all");
  const [message, setMessage] = useState("");
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<string, string>
  >({});

  const [conversationMessages, setConversationMessages] = useState<
    Record<string, SupportChatMessage[]>
  >({});

  const [conversationStatuses, setConversationStatuses] = useState<
    Record<string, AIConversationStatus>
  >({});

  const [conversationDrafts, setConversationDrafts] = useState<
    Record<string, string>
  >({});

  const [expandedConversations, setExpandedConversations] = useState<
    Record<string, boolean>
  >({});

  const [chatProcessingId, setChatProcessingId] = useState<string | null>(null);

  const loadConversationData = useCallback(
    async (conversationIds: string[]) => {
      const uniqueIds = Array.from(
        new Set(conversationIds.filter(Boolean)),
      );

      if (uniqueIds.length === 0) {
        setConversationMessages({});
        setConversationStatuses({});
        return;
      }

      const [conversationsResult, messagesResult] = await Promise.all([
        supabase
          .from("ai_conversations")
          .select("id, status")
          .in("id", uniqueIds),

        supabase
          .from("ai_messages")
          .select(
            "id, conversation_id, sender_type, sender_user_id, content, created_at",
          )
          .in("conversation_id", uniqueIds)
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (conversationsResult.error) {
        setMessage((current) =>
          current
            ? `${current} Conversaciones: ${conversationsResult.error.message}`
            : `No se pudieron cargar las conversaciones: ${conversationsResult.error.message}`,
        );
      } else {
        setConversationStatuses(
          Object.fromEntries(
            (conversationsResult.data ?? []).map((conversation) => [
              conversation.id,
              conversation.status as AIConversationStatus,
            ]),
          ),
        );
      }

      if (messagesResult.error) {
        setMessage((current) =>
          current
            ? `${current} Mensajes: ${messagesResult.error.message}`
            : `No se pudieron cargar los mensajes: ${messagesResult.error.message}`,
        );
        return;
      }

      const groupedMessages: Record<string, SupportChatMessage[]> = {};

      for (const row of (messagesResult.data ?? []) as SupportChatMessage[]) {
        groupedMessages[row.conversation_id] = [
          ...(groupedMessages[row.conversation_id] ?? []),
          row,
        ];
      }

      setConversationMessages(groupedMessages);
    },
    [],
  );

  const loadSupport = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) {
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

      setCurrentUserId(session.user.id);

      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (
        profileError ||
        !["admin", "support"].includes(String(currentProfile?.role))
      ) {
        router.replace("/dashboard");
        return;
      }

      const [ticketsResult, agentsResult] = await Promise.all([
        supabase
          .from("support_tickets")
          .select(
            `
            id,
            user_id,
            trip_id,
            conversation_id,
            category,
            subject,
            description,
            priority,
            status,
            assigned_admin_id,
            resolution,
            resolved_at,
            closed_at,
            created_at,
            updated_at,
            requester:profiles!support_tickets_user_id_fkey (
              id,
              full_name,
              phone,
              role
            ),
            assigned_admin:profiles!support_tickets_assigned_admin_id_fkey (
              id,
              full_name,
              phone,
              role
            ),
            trip:trips!support_tickets_trip_id_fkey (
              id,
              trip_number,
              trip_code,
              origin_address,
              destination_address,
              status,
              requested_at
            )
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("role", ["admin", "support"])
          .order("full_name", { ascending: true }),
      ]);

      const supportUserIds = Array.from(
        new Set(
          [
            ...(ticketsResult.data ?? []).flatMap((ticket) => [
              ticket.user_id,
              ticket.assigned_admin_id,
            ]),
            ...(agentsResult.data ?? []).map((agent) => agent.id),
          ].filter((id): id is string => Boolean(id)),
        ),
      );

      let supportEmailMap = new Map<string, string | null>();

      if (supportUserIds.length > 0) {
        const { data: emailRows, error: emailsError } = await supabase.rpc(
          "admin_get_profile_emails",
          {
            requested_user_ids: supportUserIds,
          },
        );

        if (emailsError) {
          setMessage(
            `No fue posible cargar algunos correos: ${emailsError.message}`,
          );
        } else {
          supportEmailMap = new Map(
            (emailRows ?? []).map(
              (row: { id: string; email: string | null }) => [
                row.id,
                row.email,
              ],
            ),
          );
        }
      }

      if (ticketsResult.error) {
        setMessage(
          `No se pudieron cargar los tickets: ${ticketsResult.error.message}`,
        );
        setTickets([]);
        setConversationMessages({});
        setConversationStatuses({});
      } else {
        const loadedTickets = (ticketsResult.data ?? []).map((ticket) => {
          const requester = Array.isArray(ticket.requester)
            ? (ticket.requester[0] ?? null)
            : (ticket.requester ?? null);

          const assignedAdmin = Array.isArray(ticket.assigned_admin)
            ? (ticket.assigned_admin[0] ?? null)
            : (ticket.assigned_admin ?? null);

          return {
            ...ticket,
            requester: requester
              ? {
                  ...requester,
                  email: supportEmailMap.get(ticket.user_id) ?? null,
                }
              : null,
            assigned_admin: assignedAdmin
              ? {
                  ...assignedAdmin,
                  email: ticket.assigned_admin_id
                    ? (supportEmailMap.get(ticket.assigned_admin_id) ?? null)
                    : null,
                }
              : null,
            trip: Array.isArray(ticket.trip)
              ? (ticket.trip[0] ?? null)
              : (ticket.trip ?? null),
          };
        }) as SupportTicket[];

        setTickets(loadedTickets);

        await loadConversationData(
          loadedTickets
            .map((ticket) => ticket.conversation_id)
            .filter((id): id is string => Boolean(id)),
        );

        setResolutionDrafts(
          Object.fromEntries(
            loadedTickets.map((ticket) => [ticket.id, ticket.resolution ?? ""]),
          ),
        );
      }

      if (agentsResult.error) {
        setMessage((current) =>
          current
            ? `${current} Agentes: ${agentsResult.error.message}`
            : `No se pudieron cargar los agentes: ${agentsResult.error.message}`,
        );
        setAgents([]);
      } else {
        setAgents(
          (agentsResult.data ?? []).map((agent) => ({
            ...agent,
            email: supportEmailMap.get(agent.id) ?? null,
          })) as SupportAgent[],
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [loadConversationData, router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSupport();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSupport]);

  const supportConversationIds = useMemo(
    () =>
      tickets
        .map((ticket) => ticket.conversation_id)
        .filter((id): id is string => Boolean(id)),
    [tickets],
  );

  useEffect(() => {
    if (supportConversationIds.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadConversationData(supportConversationIds);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadConversationData, supportConversationIds]);

  async function updateTicket(
    ticketId: string,
    updates: Record<string, string | null>,
    successMessage: string,
  ) {
    setProcessingId(ticketId);
    setMessage("");

    const { error } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", ticketId);

    if (error) {
      setMessage(`No se pudo actualizar el ticket: ${error.message}`);
      setProcessingId(null);
      return;
    }

    setMessage(successMessage);
    await loadSupport();
    setProcessingId(null);
  }

  async function changeStatus(ticket: SupportTicket, status: TicketStatus) {
    const now = new Date().toISOString();

    await updateTicket(
      ticket.id,
      {
        status,
        resolved_at:
          status === "resolved" || status === "closed"
            ? (ticket.resolved_at ?? now)
            : null,
        closed_at: status === "closed" ? now : null,
      },
      `Ticket marcado como ${statusLabels[status].toLowerCase()}.`,
    );
  }

  async function assignTicket(ticketId: string, agentId: string) {
    await updateTicket(
      ticketId,
      {
        assigned_admin_id: agentId || null,
        status: agentId ? "in_review" : "open",
      },
      agentId ? "Ticket asignado correctamente." : "Asignación eliminada.",
    );
  }

  async function assignToMe(ticketId: string) {
    await assignTicket(ticketId, currentUserId);
  }

  function toggleConversation(ticketId: string) {
    setExpandedConversations((current) => ({
      ...current,
      [ticketId]: !current[ticketId],
    }));
  }

  async function sendSupportMessage(ticket: SupportTicket) {
    const content = (conversationDrafts[ticket.id] ?? "").trim();

    if (!ticket.conversation_id) {
      setMessage("Este ticket no tiene una conversación de AXI AI vinculada.");
      return;
    }

    if (!content) {
      setMessage("Escribe una respuesta antes de enviarla.");
      return;
    }

    setChatProcessingId(ticket.id);
    setMessage("");

    const { error: messageError } = await supabase.rpc(
      "support_send_ai_message",
      {
        requested_conversation_id: ticket.conversation_id,
        message_content: content,
      },
    );

    if (messageError) {
      setMessage(`No se pudo enviar la respuesta: ${messageError.message}`);
      setChatProcessingId(null);
      return;
    }

    const { error: ticketError } = await supabase
      .from("support_tickets")
      .update({
        assigned_admin_id: currentUserId || ticket.assigned_admin_id,
        status: "waiting_user",
      })
      .eq("id", ticket.id);

    setConversationDrafts((current) => ({
      ...current,
      [ticket.id]: "",
    }));

    setExpandedConversations((current) => ({
      ...current,
      [ticket.id]: true,
    }));

    await loadSupport();

    setMessage(
      ticketError
        ? `La respuesta fue enviada, pero no se actualizó el ticket: ${ticketError.message}`
        : "Respuesta enviada al usuario correctamente.",
    );

    setChatProcessingId(null);
  }

  async function returnConversationToAI(ticket: SupportTicket) {
    if (!ticket.conversation_id) {
      setMessage("Este ticket no tiene una conversación vinculada.");
      return;
    }

    setChatProcessingId(ticket.id);
    setMessage("");

    const { error: conversationError } = await supabase.rpc(
      "resume_ai_conversation",
      {
        requested_conversation_id: ticket.conversation_id,
      },
    );

    if (conversationError) {
      setMessage(
        `No se pudo devolver la conversación a AXI AI: ${conversationError.message}`,
      );
      setChatProcessingId(null);
      return;
    }

    const now = new Date().toISOString();

    const { error: ticketError } = await supabase
      .from("support_tickets")
      .update({
        status: "resolved",
        resolved_at: now,
      })
      .eq("id", ticket.id);

    await loadSupport();

    setMessage(
      ticketError
        ? `AXI AI fue reactivada, pero no se actualizó el ticket: ${ticketError.message}`
        : "La conversación volvió a AXI AI y el ticket fue resuelto.",
    );

    setChatProcessingId(null);
  }

  async function saveResolution(ticket: SupportTicket) {
    const resolution = (resolutionDrafts[ticket.id] ?? "").trim();

    if (resolution.length < 5) {
      setMessage("La resolución debe contener al menos 5 caracteres.");
      return;
    }

    await updateTicket(
      ticket.id,
      {
        resolution,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      },
      "Resolución guardada y ticket marcado como resuelto.",
    );
  }

  const metrics = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === "open").length,
      inProgress: tickets.filter((ticket) =>
        ["in_review", "waiting_user"].includes(ticket.status),
      ).length,
      urgent: tickets.filter(
        (ticket) =>
          ticket.priority === "urgent" &&
          !["resolved", "closed"].includes(ticket.status),
      ).length,
      resolved: tickets.filter((ticket) =>
        ["resolved", "closed"].includes(ticket.status),
      ).length,
    }),
    [tickets],
  );

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "open" && ticket.status === "open") ||
        (filter === "in-progress" &&
          ["in_review", "waiting_user"].includes(ticket.status)) ||
        (filter === "resolved" &&
          ["resolved", "closed"].includes(ticket.status)) ||
        (filter === "urgent" && ticket.priority === "urgent");

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        ticket.id,
        ticket.subject,
        ticket.description,
        ticket.requester?.full_name,
        ticket.requester?.email,
        ticket.requester?.phone,
        ticket.assigned_admin?.full_name,
        ticket.trip?.id,
        ticket.trip?.origin_address,
        ticket.trip?.destination_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [filter, search, tickets]);

  function formatDate(value: string | null) {
    if (!value) {
      return "No disponible";
    }

    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function shortId(value: string) {
    return value.slice(0, 8).toUpperCase();
  }

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
              <Sparkles size={15} />
              Centro operativo
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Soporte y atención de tickets
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Consulta solicitudes, asigna agentes, cambia estados, registra
              resoluciones y entra a la conversación del viaje relacionado.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Headphones size={18} className="text-yellow-400" />
                Atención centralizada
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ShieldCheck size={18} className="text-emerald-400" />
                Acceso para admin y soporte
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Bandeja actual
                </p>

                <p className="mt-2 text-3xl font-black">{tickets.length}</p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <LifeBuoy size={27} />
              </span>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-300">
              {metrics.urgent > 0
                ? `${metrics.urgent} caso${
                    metrics.urgent === 1 ? "" : "s"
                  } urgente${metrics.urgent === 1 ? "" : "s"} requiere atención.`
                : "No hay casos urgentes activos."}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-sm">
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Abiertos"
          value={metrics.open}
          description="Sin agente atendiendo"
          icon={Inbox}
          iconClass="bg-blue-100 text-blue-700"
        />

        <MetricCard
          label="En seguimiento"
          value={metrics.inProgress}
          description="En revisión o esperando usuario"
          icon={Headphones}
          iconClass="bg-amber-100 text-amber-800"
        />

        <MetricCard
          label="Urgentes"
          value={metrics.urgent}
          description="Casos prioritarios activos"
          icon={AlertTriangle}
          iconClass="bg-red-100 text-red-700"
        />

        <MetricCard
          label="Resueltos"
          value={metrics.resolved}
          description="Resueltos o cerrados"
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Bandeja de atención
              </p>

              <h2 className="mt-1 text-2xl font-black">Tickets registrados</h2>

              <p className="mt-2 text-sm text-slate-500">
                Mostrando {filteredTickets.length} de {tickets.length} tickets.
              </p>
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar usuario, correo, viaje o asunto..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-80"
                />
              </div>

              <button
                type="button"
                onClick={() => void loadSupport(true)}
                disabled={refreshing}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? "animate-spin" : ""}
                />
                {refreshing ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              ["all", "Todos"],
              ["open", "Abiertos"],
              ["in-progress", "En seguimiento"],
              ["urgent", "Urgentes"],
              ["resolved", "Resueltos"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as TicketFilter)}
                className={cn(
                  "whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition",
                  filter === value
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-950",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="flex min-h-[460px] items-center justify-center bg-slate-50 px-6 py-12">
            <div className="max-w-lg text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                <MessageCircle size={35} />
              </span>

              <h3 className="mt-7 text-3xl font-black">
                No hay tickets para mostrar
              </h3>

              <p className="mt-4 text-sm leading-7 text-slate-500">
                No encontramos solicitudes que coincidan con el filtro o la
                búsqueda seleccionada.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-5 sm:p-7">
            {filteredTickets.map((ticket) => {
              const processing = processingId === ticket.id;
              const chatProcessing = chatProcessingId === ticket.id;
              const conversationOpen = Boolean(
                expandedConversations[ticket.id],
              );

              const ticketConversationMessages = ticket.conversation_id
                ? (conversationMessages[ticket.conversation_id] ?? [])
                : [];

              const conversationStatus = ticket.conversation_id
                ? (conversationStatuses[ticket.conversation_id] ??
                  "waiting_human")
                : null;

              return (
                <article
                  key={ticket.id}
                  className={cn(
                    "overflow-hidden rounded-[1.8rem] border bg-white shadow-sm",
                    ticket.priority === "urgent"
                      ? "border-red-300"
                      : "border-slate-200",
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5",
                      ticket.priority === "urgent" && "bg-red-500",
                      ticket.priority === "high" && "bg-orange-500",
                      ticket.priority === "normal" && "bg-blue-500",
                      ticket.priority === "low" && "bg-slate-400",
                    )}
                  />

                  <div className="grid gap-7 p-6 xl:grid-cols-[1fr_360px]">
                    <div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge status={ticket.status} />
                            <PriorityBadge priority={ticket.priority} />

                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                              {categoryLabels[ticket.category]}
                            </span>
                          </div>

                          <h3 className="mt-4 text-xl font-black text-slate-950">
                            {ticket.subject}
                          </h3>

                          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                            Ticket #{shortId(ticket.id)}
                          </p>
                        </div>

                        <p className="text-xs font-bold text-slate-400">
                          {formatDate(ticket.created_at)}
                        </p>
                      </div>

                      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {ticket.description}
                      </p>

                      <div className="mt-6 grid gap-3 md:grid-cols-2">
                        <InfoPanel
                          icon={UserRound}
                          label="Usuario"
                          value={
                            ticket.requester?.full_name ||
                            ticket.requester?.email ||
                            "Usuario sin nombre"
                          }
                          detail={ticket.requester?.email || "Sin correo"}
                        />

                        <InfoPanel
                          icon={Headphones}
                          label="Agente asignado"
                          value={
                            ticket.assigned_admin?.full_name ||
                            ticket.assigned_admin?.email ||
                            "Sin asignar"
                          }
                          detail={
                            ticket.assigned_admin?.role
                              ? `Rol: ${ticket.assigned_admin.role}`
                              : "Pendiente de asignación"
                          }
                        />
                      </div>

                      {ticket.trip ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                Viaje {ticket.trip.trip_code}
                              </p>

                              <p className="mt-2 flex items-start gap-2 text-sm font-bold text-slate-700">
                                <MapPin
                                  size={17}
                                  className="mt-0.5 shrink-0 text-emerald-600"
                                />
                                {ticket.trip.origin_address}
                              </p>

                              <p className="mt-2 flex items-start gap-2 text-sm font-bold text-slate-700">
                                <MapPin
                                  size={17}
                                  className="mt-0.5 shrink-0 text-red-600"
                                />
                                {ticket.trip.destination_address}
                              </p>
                            </div>

                            <Link
                              href={`/dashboard/trips/${ticket.trip.id}/chat`}
                              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800"
                            >
                              <MessageCircle size={17} />
                              Abrir chat del viaje
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                          Este ticket no tiene un viaje relacionado.
                        </div>
                      )}

                      {ticket.conversation_id && (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => toggleConversation(ticket.id)}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                          >
                            <div>
                              <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                                <MessageCircle size={18} />
                                Conversación escalada
                              </p>

                              <p className="mt-1 text-xs font-bold text-slate-500">
                                {ticketConversationMessages.length} mensajes
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "rounded-full px-3 py-1 text-[11px] font-black",
                                  conversationStatus === "waiting_human" &&
                                    "bg-yellow-100 text-yellow-800",
                                  conversationStatus === "active" &&
                                    "bg-emerald-100 text-emerald-700",
                                  conversationStatus === "closed" &&
                                    "bg-slate-200 text-slate-600",
                                )}
                              >
                                {conversationStatus === "waiting_human"
                                  ? "Soporte humano"
                                  : conversationStatus === "active"
                                    ? "AXI AI activa"
                                    : "Cerrada"}
                              </span>

                              <span className="text-xs font-black text-slate-500">
                                {conversationOpen ? "Ocultar" : "Abrir"}
                              </span>
                            </div>
                          </button>

                          {conversationOpen && (
                            <div className="border-t border-slate-200">
                              <div className="max-h-[420px] space-y-3 overflow-y-auto bg-slate-50 p-4">
                                {ticketConversationMessages.length === 0 ? (
                                  <div className="rounded-xl bg-white p-5 text-center text-sm font-bold text-slate-500">
                                    Todavía no hay mensajes en esta conversación.
                                  </div>
                                ) : (
                                  ticketConversationMessages.map(
                                    (chatMessage) => {
                                      const isUser =
                                        chatMessage.sender_type === "user";
                                      const isSupport =
                                        chatMessage.sender_type === "support";
                                      const isSystem =
                                        chatMessage.sender_type === "system";

                                      const senderLabel = isUser
                                        ? ticket.requester?.full_name ||
                                          ticket.requester?.email ||
                                          "Usuario"
                                        : isSupport
                                          ? "Soporte AXI"
                                          : isSystem
                                            ? "Sistema"
                                            : "AXI AI";

                                      return (
                                        <div
                                          key={chatMessage.id}
                                          className={cn(
                                            "w-fit max-w-[88%] rounded-2xl px-4 py-3 shadow-sm",
                                            isUser &&
                                              "ml-auto bg-slate-950 text-white",
                                            isSupport &&
                                              "mr-auto border border-yellow-200 bg-yellow-100 text-slate-950",
                                            chatMessage.sender_type ===
                                              "assistant" &&
                                              "mr-auto border border-slate-200 bg-white text-slate-800",
                                            isSystem &&
                                              "mx-auto bg-slate-200 text-slate-600",
                                          )}
                                        >
                                          <p
                                            className={cn(
                                              "mb-1 text-[10px] font-black uppercase tracking-wider",
                                              isUser
                                                ? "text-slate-300"
                                                : "text-slate-500",
                                            )}
                                          >
                                            {senderLabel}
                                          </p>

                                          <p className="whitespace-pre-wrap text-sm leading-6">
                                            {chatMessage.content}
                                          </p>

                                          <p
                                            className={cn(
                                              "mt-2 text-[10px] font-bold",
                                              isUser
                                                ? "text-slate-400"
                                                : "text-slate-400",
                                            )}
                                          >
                                            {formatDate(chatMessage.created_at)}
                                          </p>
                                        </div>
                                      );
                                    },
                                  )
                                )}
                              </div>

                              <div className="border-t border-slate-200 bg-white p-4">
                                {conversationStatus === "waiting_human" ? (
                                  <>
                                    <textarea
                                      value={
                                        conversationDrafts[ticket.id] ?? ""
                                      }
                                      onChange={(event) =>
                                        setConversationDrafts((current) => ({
                                          ...current,
                                          [ticket.id]: event.target.value,
                                        }))
                                      }
                                      placeholder="Escribe una respuesta para el usuario..."
                                      rows={3}
                                      disabled={chatProcessing}
                                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
                                    />

                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void sendSupportMessage(ticket)
                                        }
                                        disabled={
                                          chatProcessing ||
                                          !(
                                            conversationDrafts[ticket.id] ?? ""
                                          ).trim()
                                        }
                                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-xs font-black text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
                                      >
                                        {chatProcessing ? (
                                          <LoaderCircle
                                            size={16}
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <Send size={16} />
                                        )}
                                        Enviar respuesta
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void returnConversationToAI(ticket)
                                        }
                                        disabled={chatProcessing}
                                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                      >
                                        <Sparkles size={16} />
                                        Devolver a AXI AI
                                      </button>
                                    </div>

                                    <p className="mt-3 text-xs leading-5 text-slate-500">
                                      Mientras soporte atiende esta conversación,
                                      AXI AI permanece completamente pausada.
                                    </p>
                                  </>
                                ) : (
                                  <div
                                    className={cn(
                                      "rounded-xl p-4 text-sm font-bold",
                                      conversationStatus === "active"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-600",
                                    )}
                                  >
                                    {conversationStatus === "active"
                                      ? "La conversación ya fue devuelta a AXI AI."
                                      : "Esta conversación está cerrada."}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-5 rounded-[1.5rem] bg-slate-50 p-5">
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                          Agente responsable
                        </label>

                        <select
                          value={ticket.assigned_admin_id ?? ""}
                          onChange={(event) =>
                            void assignTicket(ticket.id, event.target.value)
                          }
                          disabled={processing}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-slate-400"
                        >
                          <option value="">Sin asignar</option>

                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.full_name || agent.email || "Agente"} ·{" "}
                              {agent.role}
                            </option>
                          ))}
                        </select>

                        {ticket.assigned_admin_id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => void assignToMe(ticket.id)}
                            disabled={processing}
                            className="mt-2 h-10 w-full rounded-xl bg-yellow-400 px-3 text-xs font-black text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
                          >
                            Asignarme este ticket
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                          Estado
                        </label>

                        <select
                          value={ticket.status}
                          onChange={(event) =>
                            void changeStatus(
                              ticket,
                              event.target.value as TicketStatus,
                            )
                          }
                          disabled={processing}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-slate-400"
                        >
                          {Object.entries(statusLabels).map(
                            ([status, label]) => (
                              <option key={status} value={status}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                          Resolución
                        </label>

                        <textarea
                          value={resolutionDrafts[ticket.id] ?? ""}
                          onChange={(event) =>
                            setResolutionDrafts((current) => ({
                              ...current,
                              [ticket.id]: event.target.value,
                            }))
                          }
                          placeholder="Describe cómo se resolvió el caso..."
                          rows={5}
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                        />

                        <button
                          type="button"
                          onClick={() => void saveResolution(ticket)}
                          disabled={processing}
                          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {processing ? (
                            <>
                              <LoaderCircle
                                size={16}
                                className="animate-spin"
                              />
                              Actualizando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={16} />
                              Guardar y resolver
                            </>
                          )}
                        </button>
                      </div>

                      <div className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                        <p>
                          <strong>Actualizado:</strong>{" "}
                          {formatDate(ticket.updated_at)}
                        </p>

                        {ticket.resolved_at && (
                          <p className="mt-1">
                            <strong>Resuelto:</strong>{" "}
                            {formatDate(ticket.resolved_at)}
                          </p>
                        )}
                      </div>
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

function MetricCard({
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
            iconClass,
          )}
        >
          <Icon size={23} />
        </span>

        <p className="text-4xl font-black">{value}</p>
      </div>

      <p className="mt-5 font-black">{label}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black",
        status === "open" && "bg-blue-100 text-blue-700",
        status === "in_review" && "bg-amber-100 text-amber-800",
        status === "waiting_user" && "bg-violet-100 text-violet-700",
        status === "resolved" && "bg-emerald-100 text-emerald-700",
        status === "closed" && "bg-slate-200 text-slate-700",
      )}
    >
      {status === "open" && <Inbox size={14} />}
      {["in_review", "waiting_user"].includes(status) && <Clock3 size={14} />}
      {["resolved", "closed"].includes(status) && <CheckCircle2 size={14} />}
      {statusLabels[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black",
        priority === "urgent" && "bg-red-100 text-red-700",
        priority === "high" && "bg-orange-100 text-orange-700",
        priority === "normal" && "bg-slate-100 text-slate-600",
        priority === "low" && "bg-slate-100 text-slate-500",
      )}
    >
      {priority === "urgent" && <AlertTriangle size={14} />}
      Prioridad {priorityLabels[priority]}
    </span>
  );
}

function InfoPanel({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
          <Icon size={17} />
        </span>

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <p className="mt-1 break-words text-sm font-black text-slate-800">
            {value}
          </p>

          <p className="mt-1 break-words text-xs text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}
