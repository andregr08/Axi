"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ApplicationStatus = "pending" | "approved" | "rejected";
type FaceStatus = "pending" | "matched" | "not_matched" | "manual_review";

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

export default function DriverApplicationsAdminPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [documentLinks, setDocumentLinks] = useState<
    Record<string, DocumentLinks>
  >({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadApplications();
  }, []);

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
      setMessage(`Error cargando solicitudes: ${error.message}`);
    } else {
      setApplications((data ?? []) as DriverApplication[]);
    }

    setLoading(false);
  }

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

  async function openDocuments(application: DriverApplication) {
    setOpeningId(application.id);
    setMessage("");

    try {
      const links: DocumentLinks = {
        profilePhoto: await createSignedLink(
          application.profile_photo_url
        ),
        selfie: await createSignedLink(application.selfie_url),
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
    reviewStatus: "matched" | "not_matched" | "manual_review"
  ) {
    let score: number | null = null;

    if (reviewStatus === "matched") {
      const scoreInput = window.prompt(
        "Escribe el porcentaje estimado de coincidencia, de 0 a 100:"
      );

      if (scoreInput === null) return;

      score = Number(scoreInput);

      if (Number.isNaN(score) || score < 0 || score > 100) {
        alert("Escribe un número válido entre 0 y 100.");
        return;
      }
    }

    const confirmed = window.confirm(
      "¿Confirmas esta revisión facial?"
    );

    if (!confirmed) return;

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc("review_driver_face", {
      application_id: applicationId,
      review_status: reviewStatus,
      review_score: score,
    });

    if (error) {
      setMessage(`Error en revisión facial: ${error.message}`);
    } else {
      setMessage("Revisión facial guardada.");
      await loadApplications();
    }

    setProcessingId(null);
  }

  async function approveApplication(applicationId: string) {
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
      setMessage("Conductor aprobado correctamente.");
      await loadApplications();
    }

    setProcessingId(null);
  }

  async function rejectApplication(applicationId: string) {
    const reason = window.prompt("Escribe el motivo del rechazo:");

    if (!reason) return;

    setProcessingId(applicationId);
    setMessage("");

    const { error } = await supabase.rpc(
      "reject_driver_application",
      {
        application_id: applicationId,
        reason,
      }
    );

    if (error) {
      setMessage(`Error al rechazar: ${error.message}`);
    } else {
      setMessage("Solicitud rechazada.");
      await loadApplications();
    }

    setProcessingId(null);
  }

  function getApplicantName(application: DriverApplication) {
    const profile = Array.isArray(application.profiles)
      ? application.profiles[0]
      : application.profiles;

    return profile?.full_name || "Usuario sin nombre";
  }

  function faceStatusLabel(status: FaceStatus) {
    const labels: Record<FaceStatus, string> = {
      pending: "Pendiente",
      matched: "Coincide",
      not_matched: "No coincide",
      manual_review: "Revisión manual",
    };

    return labels[status];
  }

  if (loading) {
    return <p>Cargando solicitudes...</p>;
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
          Revisa identidad, licencia y documentos antes de aprobar.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {applications.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold">
              No hay solicitudes registradas.
            </p>
          </div>
        ) : (
          applications.map((application) => {
            const links = documentLinks[application.id];

            return (
              <article
                key={application.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row">
                  <div>
                    <h2 className="text-xl font-bold">
                      {getApplicantName(application)}
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                      Licencia: {application.license_number}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Vence:{" "}
                      {new Date(
                        application.license_expiration
                      ).toLocaleDateString("es-MX")}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Documentos:{" "}
                      {application.documents_complete
                        ? "Completos"
                        : "Incompletos"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Verificación facial:{" "}
                      {faceStatusLabel(application.face_match_status)}
                      {application.face_match_score !== null
                        ? ` (${application.face_match_score}%)`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => openDocuments(application)}
                      disabled={openingId === application.id}
                      className="rounded-lg border px-4 py-2 text-sm font-semibold"
                    >
                      {openingId === application.id
                        ? "Abriendo..."
                        : "Revisar documentos"}
                    </button>

                    {application.status === "pending" && (
                      <>
                        <button
                          onClick={() =>
                            reviewFace(application.id, "matched")
                          }
                          disabled={processingId === application.id}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Rostro coincide
                        </button>

                        <button
                          onClick={() =>
                            reviewFace(application.id, "not_matched")
                          }
                          disabled={processingId === application.id}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                        >
                          No coincide
                        </button>

                        <button
                          onClick={() =>
                            reviewFace(application.id, "manual_review")
                          }
                          disabled={processingId === application.id}
                          className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          Revisión manual
                        </button>

                        <button
                          onClick={() =>
                            approveApplication(application.id)
                          }
                          disabled={
                            processingId === application.id ||
                            application.face_match_status !== "matched" ||
                            !application.documents_complete
                          }
                          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Aprobar
                        </button>

                        <button
                          onClick={() =>
                            rejectApplication(application.id)
                          }
                          disabled={processingId === application.id}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {links && (
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <DocumentCard
                      label="Foto de perfil"
                      url={links.profilePhoto}
                    />
                    <DocumentCard
                      label="Selfie"
                      url={links.selfie}
                    />
                    <DocumentCard
                      label="Licencia frente"
                      url={links.licenseFront}
                    />
                    <DocumentCard
                      label="Licencia reverso"
                      url={links.licenseBack}
                    />
                    <DocumentCard
                      label="Identificación"
                      url={links.identification}
                    />
                  </div>
                )}

                {application.rejection_reason && (
                  <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    Motivo: {application.rejection_reason}
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

function DocumentCard({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-semibold">{label}</p>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={url}
            alt={label}
            className="h-52 w-full rounded-lg bg-gray-100 object-contain"
          />

          <p className="mt-3 text-center text-sm font-semibold underline">
            Abrir en tamaño completo
          </p>
        </a>
      ) : (
        <div className="flex h-52 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
          Documento no disponible
        </div>
      )}
    </div>
  );
}
