"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  FileImage,
  FileText,
  Fingerprint,
  IdCard,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type ApplicationStatus = "pending" | "approved" | "rejected";
type FaceStatus =
  | "pending"
  | "matched"
  | "not_matched"
  | "manual_review";

type FilterStatus = "all" | ApplicationStatus;

type DriverApplication = {
  id: string;
  user_id: string;
  license_number: string;
  license_expiration: string;
  status: ApplicationStatus;
  documents_complete: boolean;
  face_match_status: FaceStatus;
  face_match_score: number | null;
  rejection_reason: string | null;
  profile_photo_url: string | null;
  selfie_url: string | null;
  license_front_url: string | null;
  license_back_url: string | null;
  identification_url: string | null;
  created_at: string;
  profiles:
    | {
        full_name: string | null;
        role: string;
      }
    | {
        full_name: string | null;
        role: string;
      }[]
    | null;
};

type DocumentLinks = {
  profilePhoto: string | null;
  selfie: string | null;
  licenseFront: string | null;
  licenseBack: string | null;
  identification: string | null;
};

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const faceLabels: Record<FaceStatus, string> = {
  pending: "Pendiente",
  matched: "Coincide",
  not_matched: "No coincide",
  manual_review: "Revisión manual",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function isPdfUrl(url: string) {
  return url.toLowerCase().includes(".pdf");
}

export default function DriverApplicationsAdminPage() {
  const router = useRouter();

  const [applications, setApplications] =
    useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [openingId, setOpeningId] =
    useState<string | null>(null);
  const [expandedId, setExpandedId] =
    useState<string | null>(null);
  const [documentLinks, setDocumentLinks] = useState<
    Record<string, DocumentLinks>
  >({});
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<FilterStatus>("pending");

  const loadApplications = useCallback(
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

      const { data, error } = await supabase
        .from("driver_applications")
        .select(`
          id,
          user_id,
          license_number,
          license_expiration,
          status,
          documents_complete,
          face_match_status,
          face_match_score,
          rejection_reason,
          profile_photo_url,
          selfie_url,
          license_front_url,
          license_back_url,
          identification_url,
          created_at,
          profiles:user_id (
            full_name,
            role
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(
          `Error cargando solicitudes: ${error.message}`
        );
      } else {
        setApplications(
          (data ?? []) as DriverApplication[]
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApplications();
  }, [loadApplications]);

  async function createSignedLink(path: string | null) {
    if (!path) return null;

    const { data, error } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(path, 600);

    if (error) {
      throw new Error(error.message);
    }

    return data.signedUrl;
  }

  async function openDocuments(
    application: DriverApplication
  ) {
    if (expandedId === application.id) {
      setExpandedId(null);
      return;
    }

    if (documentLinks[application.id]) {
      setExpandedId(application.id);
      return;
    }

    setOpeningId(application.id);
    setMessage("");

    try {
      const links: DocumentLinks = {
        profilePhoto: await createSignedLink(
          application.profile_photo_url
        ),
        selfie: await createSignedLink(
          application.selfie_url
        ),
        licenseFront: await createSignedLink(
          application.license_front_url
        ),
        licenseBack: await createSignedLink(
          application.license_back_url
        ),
        identification: await createSignedLink(
          application.identification_url
        ),
      };

      setDocumentLinks((current) => ({
        ...current,
        [application.id]: links,
      }));

      setExpandedId(application.id);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Error abriendo documentos: ${error.message}`
          : "No se pudieron abrir los documentos."
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function reviewFace(
    applicationId: string,
    reviewStatus:
      | "matched"
      | "not_matched"
      | "manual_review"
  ) {
    let score: number | null = null;

    if (reviewStatus === "matched") {
      const scoreInput = window.prompt(
        "Escribe el porcentaje estimado de coincidencia, de 0 a 100:"
      );

      if (scoreInput === null) return;

      score = Number(scoreInput);

      if (
        Number.isNaN(score) ||
        score < 0 ||
        score > 100
      ) {
        window.alert(
          "Escribe un número válido entre 0 y 100."
        );
        return;
      }
    }

    const confirmed = window.confirm(
      "¿Confirmas esta revisión facial?"
    );

    if (!confirmed) return;

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc(
      "review_driver_face",
      {
        application_id: applicationId,
        review_status: reviewStatus,
        review_score: score,
      }
    );

    if (error) {
      setMessage(
        `Error en revisión facial: ${error.message}`
      );
    } else {
      setMessage("Revisión facial guardada.");
      await loadApplications(true);
    }

    setProcessingId(null);
  }

  async function approveApplication(
    applicationId: string
  ) {
    const confirmed = window.confirm(
      "¿Confirmas que revisaste identidad, licencia y documentos?"
    );

    if (!confirmed) return;

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc(
      "approve_driver_application",
      {
        application_id: applicationId,
      }
    );

    if (error) {
      setMessage(`Error al aprobar: ${error.message}`);
    } else {
      setMessage(
        "Conductor aprobado correctamente."
      );
      await loadApplications(true);
    }

    setProcessingId(null);
  }

  async function rejectApplication(
    applicationId: string
  ) {
    const reason = window.prompt(
      "Escribe el motivo del rechazo:"
    );

    if (!reason?.trim()) return;

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc(
      "reject_driver_application",
      {
        application_id: applicationId,
        reason: reason.trim(),
      }
    );

    if (error) {
      setMessage(`Error al rechazar: ${error.message}`);
    } else {
      setMessage("Solicitud rechazada.");
      await loadApplications(true);
    }

    setProcessingId(null);
  }

  function getApplicantName(
    application: DriverApplication
  ) {
    const profile = Array.isArray(
      application.profiles
    )
      ? application.profiles[0]
      : application.profiles;

    return profile?.full_name || "Usuario sin nombre";
  }

  const pendingCount = applications.filter(
    (application) => application.status === "pending"
  ).length;

  const approvedCount = applications.filter(
    (application) => application.status === "approved"
  ).length;

  const rejectedCount = applications.filter(
    (application) => application.status === "rejected"
  ).length;

  const filteredApplications = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return applications.filter((application) => {
      const applicantName =
        getApplicantName(application).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        applicantName.includes(normalizedSearch) ||
        application.license_number
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesFilter =
        filter === "all" ||
        application.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [applications, filter, search]);

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
              Centro de verificación
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Solicitudes de conductores
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Revisa identidad, licencia, fotografías y
              documentos antes de autorizar el acceso al
              panel del conductor.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <UsersRound
                  size={18}
                  className="text-yellow-400"
                />
                {applications.length} solicitudes
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Clock3
                  size={18}
                  className="text-amber-400"
                />
                {pendingCount} pendientes
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadApplications(true)}
            disabled={refreshing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              size={19}
              className={refreshing ? "animate-spin" : ""}
            />

            {refreshing
              ? "Actualizando..."
              : "Actualizar solicitudes"}
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

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          label="Pendientes"
          value={pendingCount}
          description="Requieren revisión"
          icon={Clock3}
          iconClass="bg-amber-100 text-amber-700"
        />

        <StatCard
          label="Aprobadas"
          value={approvedCount}
          description="Conductores autorizados"
          icon={UserCheck}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="Rechazadas"
          value={rejectedCount}
          description="No cumplieron requisitos"
          icon={XCircle}
          iconClass="bg-red-100 text-red-700"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Expedientes
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Revisión de solicitudes
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
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
                  placeholder="Buscar nombre o licencia..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-72"
                />
              </div>

              <div className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["pending", "Pendientes"],
                  ["approved", "Aprobadas"],
                  ["rejected", "Rechazadas"],
                  ["all", "Todas"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(value as FilterStatus)
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

        {filteredApplications.length === 0 ? (
          <div className="flex min-h-[420px] items-center justify-center bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400">
                <UsersRound size={34} />
              </span>

              <h3 className="mt-6 text-2xl font-black">
                No hay solicitudes
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                No encontramos expedientes que coincidan con
                la búsqueda o el filtro seleccionado.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredApplications.map((application) => {
              const links =
                documentLinks[application.id];
              const expanded =
                expandedId === application.id;
              const processing =
                processingId === application.id;

              return (
                <article
                  key={application.id}
                  className="p-5 sm:p-7"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
                        <UserRound size={25} />
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-black text-slate-950">
                            {getApplicantName(application)}
                          </h3>

                          <ApplicationBadge
                            status={application.status}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
                          <span className="flex items-center gap-2">
                            <IdCard size={16} />
                            {application.license_number}
                          </span>

                          <span className="flex items-center gap-2">
                            <CalendarDays size={16} />
                            Vence{" "}
                            {formatDate(
                              application.license_expiration
                            )}
                          </span>

                          <span className="flex items-center gap-2">
                            <Clock3 size={16} />
                            Enviada{" "}
                            {formatDate(
                              application.created_at
                            )}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <StatusPill
                            valid={
                              application.documents_complete
                            }
                            label={
                              application.documents_complete
                                ? "Documentos completos"
                                : "Documentos incompletos"
                            }
                            icon={FileCheck2}
                          />

                          <FacePill
                            status={
                              application.face_match_status
                            }
                            score={
                              application.face_match_score
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openDocuments(application)
                        }
                        disabled={
                          openingId === application.id
                        }
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:opacity-50"
                      >
                        {openingId === application.id ? (
                          <>
                            <LoaderCircle
                              size={17}
                              className="animate-spin"
                            />
                            Abriendo...
                          </>
                        ) : expanded ? (
                          <>
                            <X size={17} />
                            Cerrar documentos
                          </>
                        ) : (
                          <>
                            <Eye size={17} />
                            Revisar documentos
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {application.status === "pending" && (
                    <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Acciones de revisión
                      </p>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            reviewFace(
                              application.id,
                              "matched"
                            )
                          }
                          disabled={processing}
                          className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-100 px-4 text-sm font-black text-emerald-800 transition hover:bg-emerald-200 disabled:opacity-50"
                        >
                          <CheckCircle2 size={17} />
                          Rostro coincide
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            reviewFace(
                              application.id,
                              "not_matched"
                            )
                          }
                          disabled={processing}
                          className="flex h-11 items-center gap-2 rounded-2xl bg-red-100 px-4 text-sm font-black text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                        >
                          <XCircle size={17} />
                          No coincide
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            reviewFace(
                              application.id,
                              "manual_review"
                            )
                          }
                          disabled={processing}
                          className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                        >
                          <Fingerprint size={17} />
                          Revisión manual
                        </button>

                        <div className="hidden flex-1 xl:block" />

                        <button
                          type="button"
                          onClick={() =>
                            rejectApplication(application.id)
                          }
                          disabled={processing}
                          className="flex h-11 items-center gap-2 rounded-2xl border border-red-200 bg-white px-5 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <X size={17} />
                          Rechazar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            approveApplication(application.id)
                          }
                          disabled={
                            processing ||
                            application.face_match_status !==
                              "matched" ||
                            !application.documents_complete
                          }
                          className="flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-35"
                        >
                          {processing ? (
                            <LoaderCircle
                              size={17}
                              className="animate-spin"
                            />
                          ) : (
                            <BadgeCheck size={17} />
                          )}
                          Aprobar conductor
                        </button>
                      </div>

                      {(application.face_match_status !==
                        "matched" ||
                        !application.documents_complete) && (
                        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700">
                          <AlertTriangle size={15} />
                          Para aprobar, los documentos deben
                          estar completos y el rostro debe
                          coincidir.
                        </p>
                      )}
                    </div>
                  )}

                  {expanded && links && (
                    <div className="mt-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            Documentación privada
                          </p>

                          <h4 className="mt-1 text-xl font-black">
                            Expediente del solicitante
                          </h4>
                        </div>

                        <ShieldCheck
                          size={23}
                          className="text-yellow-600"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <DocumentCard
                          label="Foto de perfil"
                          url={links.profilePhoto}
                          icon={UserRound}
                        />

                        <DocumentCard
                          label="Selfie frontal"
                          url={links.selfie}
                          icon={Fingerprint}
                        />

                        <DocumentCard
                          label="Licencia — frente"
                          url={links.licenseFront}
                          icon={IdCard}
                        />

                        <DocumentCard
                          label="Licencia — reverso"
                          url={links.licenseBack}
                          icon={FileImage}
                        />

                        <DocumentCard
                          label="Identificación oficial"
                          url={links.identification}
                          icon={FileText}
                        />
                      </div>
                    </div>
                  )}

                  {application.rejection_reason && (
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <AlertTriangle
                        size={18}
                        className="mt-0.5 shrink-0"
                      />

                      <div>
                        <p className="font-black">
                          Motivo del rechazo
                        </p>

                        <p className="mt-1 leading-6">
                          {application.rejection_reason}
                        </p>
                      </div>
                    </div>
                  )}
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
  icon: typeof Clock3;
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

        <p className="text-4xl font-black">{value}</p>
      </div>

      <p className="mt-5 font-black">{label}</p>
      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </Card>
  );
}

function ApplicationBadge({
  status,
}: {
  status: ApplicationStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black",
        status === "approved" &&
          "bg-emerald-100 text-emerald-700",
        status === "pending" &&
          "bg-amber-100 text-amber-800",
        status === "rejected" &&
          "bg-red-100 text-red-700"
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function StatusPill({
  valid,
  label,
  icon: Icon,
}: {
  valid: boolean;
  label: string;
  icon: typeof FileCheck2;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
        valid
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700"
      )}
    >
      {valid ? <Check size={14} /> : <X size={14} />}
      <Icon size={14} />
      {label}
    </span>
  );
}

function FacePill({
  status,
  score,
}: {
  status: FaceStatus;
  score: number | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
        status === "matched" &&
          "bg-emerald-100 text-emerald-700",
        status === "pending" &&
          "bg-slate-100 text-slate-600",
        status === "manual_review" &&
          "bg-blue-100 text-blue-700",
        status === "not_matched" &&
          "bg-red-100 text-red-700"
      )}
    >
      <Fingerprint size={14} />
      {faceLabels[status]}
      {score !== null ? ` · ${score}%` : ""}
    </span>
  );
}

function DocumentCard({
  label,
  url,
  icon: Icon,
}: {
  label: string;
  url: string | null;
  icon: typeof FileText;
}) {
  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon size={19} />
        </span>

        <p className="font-black">{label}</p>
      </div>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group block"
        >
          {isPdfUrl(url) ? (
            <div className="flex h-56 flex-col items-center justify-center bg-slate-50">
              <FileText
                size={42}
                className="text-red-600"
              />

              <p className="mt-4 text-sm font-black">
                Documento PDF
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="h-56 w-full bg-slate-100 object-contain transition group-hover:scale-[1.02]"
            />
          )}

          <div className="flex items-center justify-center gap-2 p-4 text-sm font-black text-slate-700 transition group-hover:bg-slate-50">
            <Eye size={17} />
            Abrir en tamaño completo
          </div>
        </a>
      ) : (
        <div className="flex h-72 flex-col items-center justify-center bg-slate-50 text-center">
          <FileText
            size={35}
            className="text-slate-300"
          />

          <p className="mt-3 text-sm font-bold text-slate-500">
            Documento no disponible
          </p>
        </div>
      )}
    </div>
  );
}
