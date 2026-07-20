"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";
import { useLanguage } from "@/hooks/useLanguage";

type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected";

type FaceStatus =
  | "pending"
  | "matched"
  | "not_matched"
  | "manual_review";

type DriverApplication = {
  id: string;
  user_id: string;

  license_number: string;
  license_expiration: string;

  operating_state: string | null;
  operating_city: string | null;
  taxi_number: string | null;
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
  vehicleFrontPhoto: string | null;
  vehicleRearPhoto: string | null;
  vehicleLeftPhoto: string | null;
  vehicleRightPhoto: string | null;
};

export default function DriverApplicationsAdminPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();

  const [applications, setApplications] =
    useState<DriverApplication[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [openingId, setOpeningId] =
    useState<string | null>(null);

  const [documentLinks, setDocumentLinks] =
    useState<Record<string, DocumentLinks>>({});

  const [message, setMessage] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"all" | ApplicationStatus>("all");

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
      .select(`
        id,
        user_id,
        license_number,
        license_expiration,
        operating_state,
        operating_city,
        taxi_number,
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
        profiles:user_id (
          full_name,
          role
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      setMessage(
        `${t("driverApplications.loadError")} ${error.message}`
      );
    } else {
      setApplications(
        (data ?? []) as DriverApplication[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplications();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  async function createSignedLink(
    path: string | null
  ) {
    if (!path) {
      return null;
    }

    const { data, error } =
      await supabase.storage
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
    setOpeningId(application.id);
    setMessage("");

    try {
      const links: DocumentLinks = {
        profilePhoto:
          await createSignedLink(
            application.profile_photo_url
          ),

        selfie:
          await createSignedLink(
            application.selfie_url
          ),

        licenseFront:
          await createSignedLink(
            application.license_front_url
          ),

        licenseBack:
          await createSignedLink(
            application.license_back_url
          ),

        identification:
          await createSignedLink(
            application.identification_url
          ),

        concessionDocument:
          await createSignedLink(
            application.concession_document_url
          ),

        vehicleFrontPhoto:
          await createSignedLink(
            application.vehicle_front_photo_url
          ),

        vehicleRearPhoto:
          await createSignedLink(
            application.vehicle_rear_photo_url
          ),

        vehicleLeftPhoto:
          await createSignedLink(
            application.vehicle_left_photo_url
          ),

        vehicleRightPhoto:
          await createSignedLink(
            application.vehicle_right_photo_url
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
          : t("driverApplications.documentsUnavailable")
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
        t("driverApplications.faceScorePrompt")
      );

      if (scoreInput === null) {
        return;
      }

      score = Number(scoreInput);

      if (
        Number.isNaN(score) ||
        score < 0 ||
        score > 100
      ) {
        window.alert(
          t("driverApplications.invalidScore")
        );
        return;
      }
    }

    const confirmed = window.confirm(
      t("driverApplications.confirmFaceReview")
    );

    if (!confirmed) {
      return;
    }

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
        `${t("driverApplications.faceReviewError")} ${error.message}`
      );
    } else {
      setMessage(
        t("driverApplications.faceReviewSaved")
      );

      await loadApplications();
    }

    setProcessingId(null);
  }

  async function approveApplication(
    applicationId: string
  ) {
    const application =
      applications.find(
        item => item.id === applicationId
      );

    if (
      !application ||
      application.status !== "pending"
    ) {
      window.alert(
        "Esta solicitud ya fue procesada."
      );
      return;
    }
    const confirmed = window.confirm(
      t("driverApplications.confirmApprove")
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc(
      "approve_driver_application",
      {
        application_id: applicationId,
      }
    );

    if (error) {
      setMessage(
        `${t("driverApplications.approveError")} ${error.message}`
      );
    } else {
      setMessage(
        t("driverApplications.approved")
      );

      await loadApplications();
    }

    setProcessingId(null);
  }

  async function rejectApplication(
    applicationId: string
  ) {
    const application =
      applications.find(
        item => item.id === applicationId
      );

    if (
      !application ||
      application.status !== "pending"
    ) {
      window.alert(
        "Esta solicitud ya fue procesada."
      );
      return;
    }
    const reason = window.prompt(
      t("driverApplications.rejectReasonPrompt")
    );

    if (!reason?.trim()) {
      return;
    }

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
      setMessage(
        `${t("driverApplications.rejectError")} ${error.message}`
      );
    } else {
      setMessage(
        t("driverApplications.rejected")
      );

      await loadApplications();
    }

    setProcessingId(null);
  }

  function getApplicantName(
    application: DriverApplication
  ) {
    const profile =
      Array.isArray(application.profiles)
        ? application.profiles[0]
        : application.profiles;

    return (
      profile?.full_name ||
      t("driverApplications.unnamedUser")
    );
  }

  function faceStatusLabel(
    status: FaceStatus
  ) {
    const labels: Record<
      FaceStatus,
      string
    > = {
      pending: t("driverApplications.pending"),
      matched: t("driverApplications.matched"),
      not_matched: t("driverApplications.notMatched"),
      manual_review: t("driverApplications.manualReview"),
    };

    return labels[status];
  }

  function applicationStatusLabel(
    status: ApplicationStatus
  ) {
    const labels: Record<
      ApplicationStatus,
      string
    > = {
      pending: t("driverApplications.pending"),
      approved: t("driverApplications.approvedStatus"),
      rejected: t("driverApplications.rejectedStatus"),
    };

    return labels[status];
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return t("driverApplications.notApplicable");
    }

    return new Date(
      `${value}T12:00:00`
    ).toLocaleDateString(locale === "es" ? "es-MX" : "en-US");
  }

  const filteredApplications =
    applications.filter((application) => {
      const matchesStatus =
        statusFilter === "all" ||
        application.status === statusFilter;

      const matchesSearch =
        getApplicantName(application)
          .toLowerCase()
          .includes(search.toLowerCase());

      return (
        matchesStatus &&
        matchesSearch
      );
    });

  if (loading) {
    return (
      <p>{t("driverApplications.loading")}</p>
    );
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Solicitudes de conductores
        </h1>

        <p className="mt-2 text-gray-600">
          {t("driverApplications.subtitle")}
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}


      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total</p>
          <p className="mt-2 text-3xl font-bold">
            {applications.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-yellow-50 p-5 shadow-sm">
          <p className="text-sm text-yellow-700">
            Pendientes
          </p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">
            {
              applications.filter(
                a => a.status === "pending"
              ).length
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-green-50 p-5 shadow-sm">
          <p className="text-sm text-green-700">
            Aprobadas
          </p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {
              applications.filter(
                a => a.status === "approved"
              ).length
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-red-700">
            Rechazadas
          </p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {
              applications.filter(
                a => a.status === "rejected"
              ).length
            }
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row">
        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Buscar conductor..."
          className="flex-1 rounded-xl border px-4 py-3"
        />

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as
                | "all"
                | ApplicationStatus
            )
          }
          className="rounded-xl border px-4 py-3"
        >
          <option value="all">
            Todas
          </option>

          <option value="pending">
            Pendientes
          </option>

          <option value="approved">
            Aprobadas
          </option>

          <option value="rejected">
            Rechazadas
          </option>
        </select>
      </div>

      <div className="space-y-6">
        {filteredApplications.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              {t("driverApplications.empty")}
            </p>
          </div>
        ) : (
          filteredApplications.map((application) => {
            const links =
              documentLinks[application.id];

            const processing =
              processingId === application.id;

            return (
              <article
                key={application.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-6 xl:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">
                        {getApplicantName(
                          application
                        )}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          application.status ===
                          "approved"
                            ? "bg-green-50 text-green-700"
                            : application.status ===
                                "rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {applicationStatusLabel(
                          application.status
                        )}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <DataItem
                        label={t("driverApplications.licenseNumber")}
                        value={
                          application.license_number
                        }
                      />

                      <DataItem
                        label={t("driverApplications.licenseExpiration")}
                        value={formatDate(
                          application.license_expiration
                        )}
                      />

                      <DataItem
                        label={t("driverApplications.operatingState")}
                        value={
                          application.operating_state
                        }
                      />

                      <DataItem
                        label={t("driverApplications.operatingCity")}
                        value={
                          application.operating_city
                        }
                      />

                      <DataItem
                        label={t("driverApplications.taxiNumber")}
                        value={
                          application.taxi_number
                        }
                      />

                      <DataItem
                        label={t("driverApplications.concessionNumber")}
                        value={
                          application.concession_number
                        }
                      />

                      <DataItem
                        label={t("driverApplications.concessionAuthority")}
                        value={
                          application.concession_authority
                        }
                      />

                      <DataItem
                        label={t("driverApplications.concessionHolder")}
                        value={
                          application.concession_holder_name
                        }
                      />

                      <DataItem
                        label={t("driverApplications.concessionExpiration")}
                        value={formatDate(
                          application.concession_expiration
                        )}
                      />

                      <DataItem
                        label={t("driverApplications.vehicleVin")}
                        value={
                          application.vehicle_vin
                        }
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
                          application.face_match_status
                        )}${
                          application.face_match_score !==
                          null
                            ? ` (${application.face_match_score}%)`
                            : ""
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 xl:max-w-sm xl:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        openDocuments(
                          application
                        )
                      }
                      disabled={
                        openingId ===
                        application.id
                      }
                      className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {openingId ===
                      application.id
                        ? t("driverApplications.opening")
                        : t("driverApplications.reviewDocuments")}
                    </button>

                    {application.status ===
                      "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            reviewFace(
                              application.id,
                              "matched"
                            )
                          }
                          disabled={processing}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >{t("driverApplications.faceMatches")}</button>

                        <button
                          type="button"
                          onClick={() =>
                            reviewFace(
                              application.id,
                              "not_matched"
                            )
                          }
                          disabled={processing}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                        >{t("driverApplications.notMatched")}</button>

                        <button
                          type="button"
                          onClick={() =>
                            reviewFace(
                              application.id,
                              "manual_review"
                            )
                          }
                          disabled={processing}
                          className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >{t("driverApplications.manualReview")}</button>

                        <button
                          type="button"
                          onClick={() =>
                            approveApplication(
                              application.id
                            )
                          }
                          disabled={
                            processing ||
                            application.face_match_status !==
                              "matched" ||
                            !application.documents_complete ||
                            !application.concession_document_url ||
                            !application.vehicle_vin ||
                            !application.taxi_number ||
                            !application.concession_number
                          }
                          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >{t("driverApplications.approve")}</button>

                        <button
                          type="button"
                          onClick={() =>
                            rejectApplication(
                              application.id
                            )
                          }
                          disabled={processing}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                        >{t("driverApplications.reject")}</button>
                      </>
                    )}
                  </div>
                </div>

                {links && (
                  <div className="mt-8">
                    <h3 className="mb-4 text-lg font-bold">{t("driverApplications.requiredDocuments")}</h3>

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
                        url={
                          links.concessionDocument
                        }
                        document
                      />
                    </div>

                    <h3 className="mb-4 mt-8 text-lg font-bold">{t("driverApplications.optionalTaxiPhotos")}</h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <DocumentCard
                        label={t("driverApplications.frontView")}
                        url={
                          links.vehicleFrontPhoto
                        }
                      />

                      <DocumentCard
                        label={t("driverApplications.rearView")}
                        url={
                          links.vehicleRearPhoto
                        }
                      />

                      <DocumentCard
                        label={t("driverApplications.leftSide")}
                        url={
                          links.vehicleLeftPhoto
                        }
                      />

                      <DocumentCard
                        label={t("driverApplications.rightSide")}
                        url={
                          links.vehicleRightPhoto
                        }
                      />
                    </div>
                  </div>
                )}

                {application.rejection_reason && (
                  <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {t("driverApplications.reason")}:{" "}
                    {
                      application.rejection_reason
                    }
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

function DataItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
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
      <p className="mb-3 text-sm font-semibold">
        {label}
      </p>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
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


