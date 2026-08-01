"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";
import { useLanguage } from "@/hooks/useLanguage";

type ApplicationStatus = "pending" | "approved" | "rejected";

type FaceStatus = "pending" | "matched" | "not_matched" | "manual_review";

type PermitHolderStatus =
  | "pending"
  | "authorized"
  | "expired"
  | "revoked";

type PermitHolderAuthorization = {
  id: string;
  status: PermitHolderStatus;
  holder_name: string;
  holder_email: string | null;
  holder_phone: string | null;
  relationship_to_driver: string;
  authorization_expires_on: string | null;
  no_expiration: boolean;
  holder_identification_url: string | null;
  holder_concession_document_url: string | null;
  authorized_at: string | null;
};

type DriverApplication = {
  id: string;
  user_id: string;

  license_number: string;
  license_expiration: string;

  operating_state: string | null;
  operating_city: string | null;
  taxi_number: string | null;
  vehicle_plate: string | null;
  is_concession_holder: boolean | null;
  concession_number: string | null;
  concession_authority: string | null;
  concession_holder_name: string | null;
  concession_expiration: string | null;
  vehicle_vin: string | null;

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
  concession_document_url: string | null;

  vehicle_front_photo_url: string | null;
  vehicle_rear_photo_url: string | null;
  vehicle_left_photo_url: string | null;
  vehicle_right_photo_url: string | null;

  created_at: string;

  permit_holder_authorizations:
    | PermitHolderAuthorization
    | PermitHolderAuthorization[]
    | null;

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
  concessionDocument: string | null;
  holderIdentification: string | null;
  holderConcessionDocument: string | null;
  vehicleFrontPhoto: string | null;
  vehicleRearPhoto: string | null;
  vehicleLeftPhoto: string | null;
  vehicleRightPhoto: string | null;
};

export default function DriverApplicationsAdminPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();

  const [applications, setApplications] = useState<DriverApplication[]>([]);

  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [openingId, setOpeningId] = useState<string | null>(null);

  const [documentLinks, setDocumentLinks] = useState<
    Record<string, DocumentLinks>
  >({});

  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>(
    "all",
  );

  const [documentsFilter, setDocumentsFilter] = useState<
    "all" | "complete" | "incomplete"
  >("all");

  const [faceFilter, setFaceFilter] = useState<"all" | FaceStatus>("all");

  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "week" | "month"
  >("all");

  async function loadApplications() {
    setLoading(true);
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
      .from("driver_applications")
      .select(
        `
        id,
        user_id,
        license_number,
        license_expiration,
        operating_state,
        operating_city,
        taxi_number,
        vehicle_plate,
        is_concession_holder,
        concession_number,
        concession_authority,
        concession_holder_name,
        concession_expiration,
        vehicle_vin,
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
        concession_document_url,
        vehicle_front_photo_url,
        vehicle_rear_photo_url,
        vehicle_left_photo_url,
        vehicle_right_photo_url,
        created_at,
        permit_holder_authorizations (
          id,
          status,
          holder_name,
          holder_email,
          holder_phone,
          relationship_to_driver,
          authorization_expires_on,
          no_expiration,
          holder_identification_url,
          holder_concession_document_url,
          authorized_at
        ),
        profiles:user_id (
          full_name,
          role
        )
      `,
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      setMessage(`${t("driverApplications.loadError")} ${error.message}`);
    } else {
      setApplications((data ?? []) as DriverApplication[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function createSignedLink(path: string | null) {
    if (!path) {
      return null;
    }

    const { data, error } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(path, 600);

    if (error) {
      throw new Error(error.message);
    }

    return data.signedUrl;
  }

  async function createPermitHolderSignedLink(
    path: string | null
  ) {
    if (!path) {
      return null;
    }

    const {
      data,
      error,
    } = await supabase.storage
      .from(
        "permit-holder-documents"
      )
      .createSignedUrl(
        path,
        600
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return data.signedUrl;
  }

  async function openDocuments(application: DriverApplication) {
    setOpeningId(application.id);
    setMessage("");

    try {
      const permitAuthorization =
        getPermitAuthorization(
          application
        );

      const links: DocumentLinks = {
        profilePhoto: await createSignedLink(application.profile_photo_url),

        selfie: await createSignedLink(application.selfie_url),

        licenseFront: await createSignedLink(application.license_front_url),

        licenseBack: await createSignedLink(application.license_back_url),

        identification: await createSignedLink(application.identification_url),

        concessionDocument: await createSignedLink(
          application.concession_document_url,
        ),

        holderIdentification:
          await createPermitHolderSignedLink(
            permitAuthorization
              ?.holder_identification_url ??
              null
          ),

        holderConcessionDocument:
          await createPermitHolderSignedLink(
            permitAuthorization
              ?.holder_concession_document_url ??
              null
          ),

        vehicleFrontPhoto: await createSignedLink(
          application.vehicle_front_photo_url,
        ),

        vehicleRearPhoto: await createSignedLink(
          application.vehicle_rear_photo_url,
        ),

        vehicleLeftPhoto: await createSignedLink(
          application.vehicle_left_photo_url,
        ),

        vehicleRightPhoto: await createSignedLink(
          application.vehicle_right_photo_url,
        ),
      };

      setDocumentLinks((current) => ({
        ...current,
        [application.id]: links,
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${t("driverApplications.openDocumentsError")} ${error.message}`
          : t("driverApplications.documentsUnavailable"),
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function reviewFace(
    applicationId: string,
    reviewStatus: "matched" | "not_matched" | "manual_review",
  ) {
    let score: number | null = null;

    if (reviewStatus === "matched") {
      const scoreInput = window.prompt(t("driverApplications.faceScorePrompt"));

      if (scoreInput === null) {
        return;
      }

      score = Number(scoreInput);

      if (Number.isNaN(score) || score < 0 || score > 100) {
        window.alert(t("driverApplications.invalidScore"));
        return;
      }
    }

    const confirmed = window.confirm(t("driverApplications.confirmFaceReview"));

    if (!confirmed) {
      return;
    }

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc("review_driver_face", {
      application_id: applicationId,
      review_status: reviewStatus,
      review_score: score,
    });

    if (error) {
      setMessage(`${t("driverApplications.faceReviewError")} ${error.message}`);
    } else {
      setMessage(t("driverApplications.faceReviewSaved"));

      await loadApplications();
    }

    setProcessingId(null);
  }

  async function approveApplication(applicationId: string) {
    const application = applications.find((item) => item.id === applicationId);

    if (!application || application.status !== "pending") {
      window.alert("Esta solicitud ya fue procesada.");
      return;
    }

    if (
      !isPermitAuthorizationReady(
        application
      )
    ) {
      window.alert(
        "No puedes aprobar esta solicitud hasta que el permisionario autorice, adjunte su identificación y su concesión, y la autorización siga vigente."
      );
      return;
    }

    const confirmed = window.confirm(t("driverApplications.confirmApprove"));

    if (!confirmed) {
      return;
    }

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc("approve_driver_application", {
      application_id: applicationId,
    });

    if (error) {
      const approvalError =
        `${t("driverApplications.approveError")} ${error.message}`;

      setMessage(
        approvalError
      );

      window.alert(
        approvalError
      );
    } else {
      setMessage(t("driverApplications.approved"));

      await loadApplications();
    }

    setProcessingId(null);
  }

  async function rejectApplication(applicationId: string) {
    const application = applications.find((item) => item.id === applicationId);

    if (!application || application.status !== "pending") {
      window.alert("Esta solicitud ya fue procesada.");
      return;
    }
    const reason = window.prompt(t("driverApplications.rejectReasonPrompt"));

    if (!reason?.trim()) {
      return;
    }

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc("reject_driver_application", {
      application_id: applicationId,
      reason: reason.trim(),
    });

    if (error) {
      setMessage(`${t("driverApplications.rejectError")} ${error.message}`);
    } else {
      setMessage(t("driverApplications.rejected"));

      await loadApplications();
    }

    setProcessingId(null);
  }

  function getPermitAuthorization(
    application: DriverApplication
  ) {
    const authorization =
      application
        .permit_holder_authorizations;

    return Array.isArray(
      authorization
    )
      ? authorization[0] ?? null
      : authorization;
  }

  function isPermitAuthorizationReady(
    application: DriverApplication
  ) {
    /*
     * Las solicitudes del propio titular y las
     * solicitudes anteriores al nuevo flujo no
     * requieren una autorización externa.
     */
    if (
      application
        .is_concession_holder !== false
    ) {
      return true;
    }

    const authorization =
      getPermitAuthorization(
        application
      );

    if (
      !authorization ||
      authorization.status !==
        "authorized" ||
      !authorization
        .holder_identification_url ||
      !authorization
        .holder_concession_document_url
    ) {
      return false;
    }

    if (
      authorization.no_expiration
    ) {
      return true;
    }

    if (
      !authorization
        .authorization_expires_on
    ) {
      return false;
    }

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    return (
      authorization
        .authorization_expires_on >=
      today
    );
  }

  function permitAuthorizationLabel(
    application: DriverApplication
  ) {
    if (
      application
        .is_concession_holder !== false
    ) {
      return "No requerida";
    }

    const authorization =
      getPermitAuthorization(
        application
      );

    if (!authorization) {
      return "Sin solicitud";
    }

    const labels:
      Record<
        PermitHolderStatus,
        string
      > = {
        pending:
          "Pendiente del permisionario",
        authorized:
          isPermitAuthorizationReady(
            application
          )
            ? "Autorizada"
            : "Autorización incompleta o vencida",
        expired:
          "Vencida",
        revoked:
          "Revocada",
      };

    return labels[
      authorization.status
    ];
  }

  function getApplicantProfile(application: DriverApplication) {
    return Array.isArray(application.profiles)
      ? application.profiles[0]
      : application.profiles;
  }

  function getApplicantName(application: DriverApplication) {
    return (
      getApplicantProfile(application)?.full_name ||
      t("driverApplications.unnamedUser")
    );
  }

  function getApplicantEmail(_application: DriverApplication) {
    return "";
  }

  function faceStatusLabel(status: FaceStatus) {
    const labels: Record<FaceStatus, string> = {
      pending: t("driverApplications.pending"),
      matched: t("driverApplications.matched"),
      not_matched: t("driverApplications.notMatched"),
      manual_review: t("driverApplications.manualReview"),
    };

    return labels[status];
  }

  function applicationStatusLabel(status: ApplicationStatus) {
    const labels: Record<ApplicationStatus, string> = {
      pending: t("driverApplications.pending"),
      approved: t("driverApplications.approvedStatus"),
      rejected: t("driverApplications.rejectedStatus"),
    };

    return labels[status];
  }

  function formatDate(value: string | null) {
    if (!value) {
      return t("driverApplications.notApplicable");
    }

    return new Date(`${value}T12:00:00`).toLocaleDateString(
      locale === "es" ? "es-MX" : "en-US",
    );
  }

  const filteredApplications = applications.filter((application) => {
    const normalizedSearch = search.trim().toLowerCase();

    const permitAuthorization =
      getPermitAuthorization(
        application
      );

    const searchableValues = [
      getApplicantName(application),
      getApplicantEmail(application),
      application.license_number,
      application.operating_state,
      application.operating_city,
      application.taxi_number,
      application.vehicle_plate,
      application.concession_number,
      application.concession_holder_name,
      permitAuthorization
        ?.holder_name,
      permitAuthorization
        ?.holder_email,
      permitAuthorization
        ?.holder_phone,
      application.vehicle_vin,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !normalizedSearch || searchableValues.includes(normalizedSearch);

    const matchesStatus =
      statusFilter === "all" || application.status === statusFilter;

    const matchesDocuments =
      documentsFilter === "all" ||
      (documentsFilter === "complete"
        ? application.documents_complete
        : !application.documents_complete);

    const matchesFace =
      faceFilter === "all" || application.face_match_status === faceFilter;

    const createdAt = new Date(application.created_at);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const matchesDate =
      dateFilter === "all" ||
      (dateFilter === "today" && createdAt >= startOfToday) ||
      (dateFilter === "week" && createdAt >= startOfWeek) ||
      (dateFilter === "month" && createdAt >= startOfMonth);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDocuments &&
      matchesFace &&
      matchesDate
    );
  });

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    documentsFilter !== "all" ||
    faceFilter !== "all" ||
    dateFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDocumentsFilter("all");
    setFaceFilter("all");
    setDateFilter("all");
  }

  if (loading) {
    return <p>{t("driverApplications.loading")}</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">Administración</p>

        <h1 className="text-3xl font-bold text-gray-900">
          Solicitudes de conductores
        </h1>

        <p className="mt-2 text-gray-600">{t("driverApplications.subtitle")}</p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">{message}</div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total</p>
          <p className="mt-2 text-3xl font-bold">{applications.length}</p>
        </div>

        <div className="rounded-2xl border bg-yellow-50 p-5 shadow-sm">
          <p className="text-sm text-yellow-700">Pendientes</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">
            {applications.filter((a) => a.status === "pending").length}
          </p>
        </div>

        <div className="rounded-2xl border bg-green-50 p-5 shadow-sm">
          <p className="text-sm text-green-700">Aprobadas</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {applications.filter((a) => a.status === "approved").length}
          </p>
        </div>

        <div className="rounded-2xl border bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-red-700">Rechazadas</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {applications.filter((a) => a.status === "rejected").length}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, correo, licencia, ciudad, taxi o VIN..."
            className="rounded-xl border px-4 py-3 xl:col-span-2"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | ApplicationStatus)
            }
            className="rounded-xl border px-4 py-3"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
          </select>

          <select
            value={documentsFilter}
            onChange={(e) =>
              setDocumentsFilter(
                e.target.value as "all" | "complete" | "incomplete",
              )
            }
            className="rounded-xl border px-4 py-3"
          >
            <option value="all">Todos los documentos</option>
            <option value="complete">Documentación completa</option>
            <option value="incomplete">Documentación incompleta</option>
          </select>

          <select
            value={faceFilter}
            onChange={(e) =>
              setFaceFilter(e.target.value as "all" | FaceStatus)
            }
            className="rounded-xl border px-4 py-3"
          >
            <option value="all">Toda revisión facial</option>
            <option value="pending">Rostro pendiente</option>
            <option value="matched">Rostro coincide</option>
            <option value="not_matched">Rostro no coincide</option>
            <option value="manual_review">Revisión manual</option>
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value as "all" | "today" | "week" | "month",
                )
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="all">Cualquier fecha</option>
              <option value="today">Recibidas hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Este mes</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-gray-50"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <p className="text-sm font-semibold text-gray-600">
            {filteredApplications.length} de {applications.length} solicitudes
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {filteredApplications.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">{t("driverApplications.empty")}</p>
          </div>
        ) : (
          filteredApplications.map((application) => {
            const links = documentLinks[application.id];

            const processing =
              processingId ===
              application.id;

            const permitAuthorization =
              getPermitAuthorization(
                application
              );

            const permitAuthorizationReady =
              isPermitAuthorizationReady(
                application
              );

            return (
              <article
                key={application.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="space-y-5">
                  <div className="min-w-0">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <h2 className="text-xl font-bold">
                          {getApplicantName(application)}
                        </h2>

                        {getApplicantEmail(application) && (
                          <p className="mt-1 text-sm text-gray-500">
                            {getApplicantEmail(application)}
                          </p>
                        )}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          application.status === "approved"
                            ? "bg-green-50 text-green-700"
                            : application.status === "rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {applicationStatusLabel(application.status)}
                      </span>
                      </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openDocuments(application)}
                      disabled={openingId === application.id}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {openingId === application.id
                        ? t("driverApplications.opening")
                        : t("driverApplications.reviewDocuments")}
                    </button>

                    {application.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            approveApplication(
                              application.id
                            )
                          }
                          disabled={
                            processing ||
                            !application.documents_complete ||
                            !application.concession_document_url ||
                            !application.vehicle_vin ||
                            !application.taxi_number ||
                            !application.concession_number ||
                            !permitAuthorizationReady
                          }
                          className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                        >
                          {processing
                            ? "Aprobando..."
                            : t(
                                "driverApplications.approve"
                              )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            rejectApplication(
                              application.id
                            )
                          }
                          disabled={processing}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t(
                            "driverApplications.reject"
                          )}
                        </button>
                      </>
                    )}
                  </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <DataItem
                        label={t("driverApplications.licenseNumber")}
                        value={application.license_number}
                      />

                      <DataItem
                        label={t("driverApplications.licenseExpiration")}
                        value={formatDate(application.license_expiration)}
                      />

                      <DataItem
                        label={t("driverApplications.operatingState")}
                        value={application.operating_state}
                      />

                      <DataItem
                        label={t("driverApplications.operatingCity")}
                        value={application.operating_city}
                      />

                      <DataItem
                        label={t("driverApplications.taxiNumber")}
                        value={application.taxi_number}
                      />

                      <DataItem
                        label="Placas"
                        value={application.vehicle_plate}
                      />

                      <DataItem
                        label="Relación con la concesión"
                        value={
                          application
                            .is_concession_holder === false
                            ? "Trabaja para un permisionario"
                            : application
                                  .is_concession_holder === true
                              ? "Es titular de la concesión"
                              : "Solicitud anterior al nuevo flujo"
                        }
                      />

                      <DataItem
                        label="Autorización del permisionario"
                        value={
                          permitAuthorizationLabel(
                            application
                          )
                        }
                      />

                      <DataItem
                        label={t("driverApplications.concessionNumber")}
                        value={application.concession_number}
                      />

                      <DataItem
                        label={t("driverApplications.concessionAuthority")}
                        value={application.concession_authority}
                      />

                      <DataItem
                        label={t("driverApplications.concessionHolder")}
                        value={application.concession_holder_name}
                      />

                      <DataItem
                        label={t("driverApplications.concessionExpiration")}
                        value={formatDate(application.concession_expiration)}
                      />

                      <DataItem
                        label={t("driverApplications.vehicleVin")}
                        value={application.vehicle_vin}
                      />

                      <DataItem
                        label={t("driverApplications.documents")}
                        value={
                          application.documents_complete
                            ? t("driverApplications.complete")
                            : t("driverApplications.incomplete")
                        }
                      />

                      <DataItem
                        label={t("driverApplications.faceVerification")}
                        value={`${faceStatusLabel(
                          application.face_match_status,
                        )}${
                          application.face_match_score !== null
                            ? ` (${application.face_match_score}%)`
                            : ""
                        }`}
                      />
                    </div>
                  </div>


                </div>

                {application
                  .is_concession_holder === false && (
                  <section
                    className={
                      permitAuthorizationReady
                        ? "mt-6 rounded-2xl border border-green-200 bg-green-50 p-5"
                        : "mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                          Autorización externa
                        </p>

                        <h3 className="mt-1 text-lg font-bold">
                          Datos del permisionario
                        </h3>
                      </div>

                      <span
                        className={
                          permitAuthorizationReady
                            ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800"
                            : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
                        }
                      >
                        {permitAuthorizationLabel(
                          application
                        )}
                      </span>
                    </div>

                    {permitAuthorization ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <DataItem
                          label="Nombre completo"
                          value={
                            permitAuthorization
                              .holder_name
                          }
                        />

                        <DataItem
                          label="Correo"
                          value={
                            permitAuthorization
                              .holder_email
                          }
                        />

                        <DataItem
                          label="Teléfono"
                          value={
                            permitAuthorization
                              .holder_phone
                          }
                        />

                        <DataItem
                          label="Relación con el conductor"
                          value={
                            permitAuthorization
                              .relationship_to_driver
                          }
                        />

                        <DataItem
                          label="Vigencia"
                          value={
                            permitAuthorization
                              .no_expiration
                              ? "Sin fecha definida"
                              : formatDate(
                                  permitAuthorization
                                    .authorization_expires_on
                                )
                          }
                        />

                        <DataItem
                          label="Fecha de autorización"
                          value={
                            permitAuthorization
                              .authorized_at
                              ? new Date(
                                  permitAuthorization
                                    .authorized_at
                                ).toLocaleString(
                                  locale === "es"
                                    ? "es-MX"
                                    : "en-US"
                                )
                              : "Todavía no autoriza"
                          }
                        />
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-amber-900">
                        No se encontró una solicitud de autorización para este permisionario.
                      </p>
                    )}

                    {!permitAuthorizationReady && (
                      <p className="mt-4 text-sm font-semibold text-amber-900">
                        El botón Aprobar permanecerá bloqueado hasta que la autorización sea válida y están presentes los dos documentos del permisionario.
                      </p>
                    )}
                  </section>
                )}

                {links && (
                  <div className="mt-8">
                    <h3 className="mb-4 text-lg font-bold">
                      {t("driverApplications.requiredDocuments")}
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <DocumentCard
                        label={t("driverApplications.profilePhoto")}
                        url={links.profilePhoto}
                      />

                      <DocumentCard
                        label={t("driverApplications.selfie")}
                        url={links.selfie}
                      />

                      <DocumentCard
                        label={t("driverApplications.licenseFront")}
                        url={links.licenseFront}
                      />

                      <DocumentCard
                        label={t("driverApplications.licenseBack")}
                        url={links.licenseBack}
                      />

                      <DocumentCard
                        label={t("driverApplications.identification")}
                        url={links.identification}
                      />

                      <DocumentCard
                        label={t("driverApplications.concessionDocument")}
                        url={links.concessionDocument}
                        document
                      />
                    </div>

                    {application
                      .is_concession_holder === false && (
                      <>
                        <h3 className="mb-4 mt-8 text-lg font-bold">
                          Documentos del permisionario
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                          <DocumentCard
                            label="Identificación oficial del permisionario"
                            url={
                              links
                                .holderIdentification
                            }
                            document
                          />

                          <DocumentCard
                            label="Permiso o concesión a nombre del permisionario"
                            url={
                              links
                                .holderConcessionDocument
                            }
                            document
                          />
                        </div>
                      </>
                    )}

                    <h3 className="mb-4 mt-8 text-lg font-bold">
                      {t("driverApplications.optionalTaxiPhotos")}
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <DocumentCard
                        label={t("driverApplications.frontView")}
                        url={links.vehicleFrontPhoto}
                      />

                      <DocumentCard
                        label={t("driverApplications.rearView")}
                        url={links.vehicleRearPhoto}
                      />

                      <DocumentCard
                        label={t("driverApplications.leftSide")}
                        url={links.vehicleLeftPhoto}
                      />

                      <DocumentCard
                        label={t("driverApplications.rightSide")}
                        url={links.vehicleRightPhoto}
                      />
                    </div>
                  </div>
                )}

                {application.rejection_reason && (
                  <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {t("driverApplications.reason")}:{" "}
                    {application.rejection_reason}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function DataItem({ label, value }: { label: string; value: string | null }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-gray-800">
        {value || t("driverApplications.notRegistered")}
      </p>
    </div>
  );
}

function DocumentCard({
  label,
  url,
  document = false,
}: {
  label: string;
  url: string | null;
  document?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-semibold">{label}</p>

      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {document ? (
            <div className="flex h-52 items-center justify-center rounded-lg bg-gray-100 px-5 text-center text-sm font-semibold text-gray-700">
              {t("driverApplications.openDocument")}
            </div>
          ) : (
            <img
              src={url}
              alt={label}
              className="h-52 w-full rounded-lg bg-gray-100 object-contain"
            />
          )}

          <p className="mt-3 text-center text-sm font-semibold underline">
            {t("driverApplications.openFullSize")}
          </p>
        </a>
      ) : (
        <div className="flex h-52 items-center justify-center rounded-lg bg-gray-100 px-4 text-center text-sm text-gray-500">
          {t("driverApplications.fileUnavailable")}
        </div>
      )}
    </div>
  );
}
