"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Status = "none" | "pending" | "approved" | "rejected";

type DocumentFiles = {
  profilePhoto: File | null;
  selfie: File | null;
  licenseFront: File | null;
  licenseBack: File | null;
  identification: File | null;
};

const emptyFiles: DocumentFiles = {
  profilePhoto: null,
  selfie: null,
  licenseFront: null,
  licenseBack: null,
  identification: null,
};

export default function DriverApplicationPage() {
  const router = useRouter();

  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiration, setLicenseExpiration] = useState("");
  const [status, setStatus] = useState<Status>("none");
  const [files, setFiles] = useState<DocumentFiles>(emptyFiles);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadApplication() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("driver_applications")
        .select("license_number, license_expiration, status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else if (data) {
        setLicenseNumber(data.license_number ?? "");
        setLicenseExpiration(data.license_expiration ?? "");
        setStatus(data.status);
      }

      setLoading(false);
    }

    loadApplication();
  }, [router]);

  function getExtension(file: File) {
    const parts = file.name.split(".");
    return parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
  }

  async function uploadDocument(
    userId: string,
    file: File,
    documentName: string
  ) {
    const extension = getExtension(file);
    const path = `${userId}/${documentName}.${extension}`;

    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      throw new Error(`Error subiendo ${documentName}: ${error.message}`);
    }

    return path;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!licenseNumber.trim() || !licenseExpiration) {
      setMessage("Completa el número y vencimiento de la licencia.");
      return;
    }

    const allDocumentsSelected =
      files.profilePhoto &&
      files.selfie &&
      files.licenseFront &&
      files.licenseBack &&
      files.identification;

    if (!allDocumentsSelected) {
      setMessage("Debes seleccionar todos los documentos y fotografías.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      const profilePhotoPath = await uploadDocument(
        userId,
        files.profilePhoto!,
        "profile-photo"
      );

      const selfiePath = await uploadDocument(
        userId,
        files.selfie!,
        "selfie"
      );

      const licenseFrontPath = await uploadDocument(
        userId,
        files.licenseFront!,
        "license-front"
      );

      const licenseBackPath = await uploadDocument(
        userId,
        files.licenseBack!,
        "license-back"
      );

      const identificationPath = await uploadDocument(
        userId,
        files.identification!,
        "identification"
      );

      const { error } = await supabase
        .from("driver_applications")
        .upsert(
          {
            user_id: userId,
            license_number: licenseNumber.trim(),
            license_expiration: licenseExpiration,
            status: "pending",
            profile_photo_url: profilePhotoPath,
            selfie_url: selfiePath,
            license_front_url: licenseFrontPath,
            license_back_url: licenseBackPath,
            identification_url: identificationPath,
            documents_complete: true,
            face_match_status: "pending",
            face_match_score: null,
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      setStatus("pending");
      setMessage(
        "Solicitud enviada. Tus documentos quedaron pendientes de revisión."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ocurrió un error inesperado.";

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function updateFile(field: keyof DocumentFiles, file: File | null) {
    setFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  if (loading) {
    return <p>Cargando solicitud...</p>;
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Registro de conductor
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Solicitud para ser conductor
        </h1>

        <p className="mt-2 text-gray-600">
          Completa tus datos y sube documentos claros y vigentes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-7 rounded-2xl bg-white p-8 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Número de licencia
            </label>

            <input
              value={licenseNumber}
              onChange={(event) => setLicenseNumber(event.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              placeholder="Ejemplo: PUE123456"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Vencimiento de la licencia
            </label>

            <input
              type="date"
              value={licenseExpiration}
              onChange={(event) => setLicenseExpiration(event.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-bold">Fotografías personales</h2>
          <p className="mb-5 text-sm text-gray-500">
            La selfie deberá mostrar claramente el rostro del solicitante.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label="Foto de perfil"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) => updateFile("profilePhoto", file)}
            />

            <DocumentInput
              label="Selfie frontal"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) => updateFile("selfie", file)}
            />
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-bold">Documentos oficiales</h2>
          <p className="mb-5 text-sm text-gray-500">
            Las imágenes deben ser legibles, sin reflejos y mostrar el documento completo.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label="Licencia — frente"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) => updateFile("licenseFront", file)}
            />

            <DocumentInput
              label="Licencia — reverso"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) => updateFile("licenseBack", file)}
            />

            <DocumentInput
              label="INE, pasaporte o identificación"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(file) => updateFile("identification", file)}
            />
          </div>
        </div>

        <div className="rounded-xl bg-gray-100 p-4">
          <p className="text-sm text-gray-500">Estado de la solicitud</p>
          <p className="mt-1 font-semibold">
            {status === "none" && "Sin solicitud"}
            {status === "pending" && "Pendiente de revisión"}
            {status === "approved" && "Aprobada"}
            {status === "rejected" && "Rechazada"}
          </p>
        </div>

        {message && (
          <div className="rounded-xl bg-gray-100 p-4 text-sm">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || status === "approved"}
          className="w-full rounded-xl bg-black py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Subiendo documentos..." : "Enviar solicitud"}
        </button>
      </form>
    </section>
  );
}

function DocumentInput({
  label,
  accept,
  onChange,
}: {
  label: string;
  accept: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>

      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full rounded-xl border p-3 text-sm"
      />
    </div>
  );
}
