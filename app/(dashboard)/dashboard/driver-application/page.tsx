"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Status =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

type DocumentFiles = {
  profilePhoto: File | null;
  selfie: File | null;
  licenseFront: File | null;
  licenseBack: File | null;
  identification: File | null;
  concessionDocument: File | null;
  vehicleFrontPhoto: File | null;
  vehicleRearPhoto: File | null;
  vehicleLeftPhoto: File | null;
  vehicleRightPhoto: File | null;
};

const emptyFiles: DocumentFiles = {
  profilePhoto: null,
  selfie: null,
  licenseFront: null,
  licenseBack: null,
  identification: null,
  concessionDocument: null,
  vehicleFrontPhoto: null,
  vehicleRearPhoto: null,
  vehicleLeftPhoto: null,
  vehicleRightPhoto: null,
};

export default function DriverApplicationPage() {
  const router = useRouter();

  const [licenseNumber, setLicenseNumber] =
    useState("");

  const [
    licenseExpiration,
    setLicenseExpiration,
  ] = useState("");

  const [operatingState, setOperatingState] =
    useState("");

  const [operatingCity, setOperatingCity] =
    useState("");

  const [taxiNumber, setTaxiNumber] =
    useState("");

  const [
    concessionNumber,
    setConcessionNumber,
  ] = useState("");

  const [
    concessionAuthority,
    setConcessionAuthority,
  ] = useState("");

  const [
    concessionHolderName,
    setConcessionHolderName,
  ] = useState("");

  const [
    concessionExpiration,
    setConcessionExpiration,
  ] = useState("");

  const [vehicleVin, setVehicleVin] =
    useState("");

  const [status, setStatus] =
    useState<Status>("none");

  const [files, setFiles] =
    useState<DocumentFiles>(emptyFiles);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

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
      .select(`
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
        status
      `)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setMessage(
        `Error cargando solicitud: ${error.message}`
      );
    } else if (data) {
      setLicenseNumber(
        data.license_number ?? ""
      );

      setLicenseExpiration(
        data.license_expiration ?? ""
      );

      setOperatingState(
        data.operating_state ?? ""
      );

      setOperatingCity(
        data.operating_city ?? ""
      );

      setTaxiNumber(
        data.taxi_number ?? ""
      );

      setConcessionNumber(
        data.concession_number ?? ""
      );

      setConcessionAuthority(
        data.concession_authority ?? ""
      );

      setConcessionHolderName(
        data.concession_holder_name ?? ""
      );

      setConcessionExpiration(
        data.concession_expiration ?? ""
      );

      setVehicleVin(
        data.vehicle_vin ?? ""
      );

      setStatus(
        data.status as Status
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplication();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  function getExtension(file: File) {
    const parts = file.name.split(".");

    return parts.length > 1
      ? parts.pop()!.toLowerCase()
      : "jpg";
  }

  async function uploadDocument(
    userId: string,
    file: File,
    documentName: string
  ) {
    const extension = getExtension(file);

    const path =
      `${userId}/${documentName}.${extension}`;

    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, file, {
        upsert: true,
        contentType:
          file.type ||
          "application/octet-stream",
      });

    if (error) {
      throw new Error(
        `Error subiendo ${documentName}: ${error.message}`
      );
    }

    return path;
  }

  function normalizeVin(value: string) {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function updateFile(
    field: keyof DocumentFiles,
    file: File | null
  ) {
    setFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  async function uploadOptionalDocument(
    userId: string,
    file: File | null,
    documentName: string
  ) {
    if (!file) {
      return null;
    }

    return uploadDocument(
      userId,
      file,
      documentName
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const cleanVin =
      normalizeVin(vehicleVin);

    if (
      !licenseNumber.trim() ||
      !licenseExpiration
    ) {
      setMessage(
        "Completa el número y vencimiento de la licencia."
      );
      return;
    }

    if (
      !operatingState.trim() ||
      !operatingCity.trim()
    ) {
      setMessage(
        "Escribe el estado y la ciudad o municipio donde opera el taxi."
      );
      return;
    }

    if (!taxiNumber.trim()) {
      setMessage(
        "Escribe el número económico del taxi."
      );
      return;
    }

    if (
      concessionNumber.trim().length < 3
    ) {
      setMessage(
        "Escribe un número de concesión o permiso válido."
      );
      return;
    }

    if (!concessionAuthority.trim()) {
      setMessage(
        "Escribe la autoridad que emitió la concesión o permiso."
      );
      return;
    }

    if (!concessionHolderName.trim()) {
      setMessage(
        "Escribe el nombre del titular de la concesión."
      );
      return;
    }

    if (cleanVin.length !== 17) {
      setMessage(
        "El VIN o número de serie debe contener exactamente 17 caracteres."
      );
      return;
    }

    const requiredDocumentsSelected =
      files.profilePhoto &&
      files.selfie &&
      files.licenseFront &&
      files.licenseBack &&
      files.identification &&
      files.concessionDocument;

    if (!requiredDocumentsSelected) {
      setMessage(
        "Selecciona todos los documentos obligatorios, incluido el documento de concesión o permiso."
      );
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

      const profilePhotoPath =
        await uploadDocument(
          userId,
          files.profilePhoto!,
          "profile-photo"
        );

      const selfiePath =
        await uploadDocument(
          userId,
          files.selfie!,
          "selfie"
        );

      const licenseFrontPath =
        await uploadDocument(
          userId,
          files.licenseFront!,
          "license-front"
        );

      const licenseBackPath =
        await uploadDocument(
          userId,
          files.licenseBack!,
          "license-back"
        );

      const identificationPath =
        await uploadDocument(
          userId,
          files.identification!,
          "identification"
        );

      const concessionDocumentPath =
        await uploadDocument(
          userId,
          files.concessionDocument!,
          "concession-document"
        );

      const vehicleFrontPhotoPath =
        await uploadOptionalDocument(
          userId,
          files.vehicleFrontPhoto,
          "vehicle-front"
        );

      const vehicleRearPhotoPath =
        await uploadOptionalDocument(
          userId,
          files.vehicleRearPhoto,
          "vehicle-rear"
        );

      const vehicleLeftPhotoPath =
        await uploadOptionalDocument(
          userId,
          files.vehicleLeftPhoto,
          "vehicle-left"
        );

      const vehicleRightPhotoPath =
        await uploadOptionalDocument(
          userId,
          files.vehicleRightPhoto,
          "vehicle-right"
        );

      const { error } = await supabase
        .from("driver_applications")
        .upsert(
          {
            user_id: userId,

            license_number:
              licenseNumber.trim(),

            license_expiration:
              licenseExpiration,

            operating_state:
              operatingState.trim(),

            operating_city:
              operatingCity.trim(),

            taxi_number:
              taxiNumber.trim(),

            concession_number:
              concessionNumber.trim(),

            concession_authority:
              concessionAuthority.trim(),

            concession_holder_name:
              concessionHolderName.trim(),

            concession_expiration:
              concessionExpiration || null,

            vehicle_vin:
              cleanVin,

            concession_document_url:
              concessionDocumentPath,

            vehicle_front_photo_url:
              vehicleFrontPhotoPath,

            vehicle_rear_photo_url:
              vehicleRearPhotoPath,

            vehicle_left_photo_url:
              vehicleLeftPhotoPath,

            vehicle_right_photo_url:
              vehicleRightPhotoPath,

            status: "pending",

            profile_photo_url:
              profilePhotoPath,

            selfie_url:
              selfiePath,

            license_front_url:
              licenseFrontPath,

            license_back_url:
              licenseBackPath,

            identification_url:
              identificationPath,

            documents_complete: true,

            face_match_status:
              "pending",

            face_match_score:
              null,
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
        "Solicitud enviada correctamente. Tus datos y documentos quedaron pendientes de revisión."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.";

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Cargando solicitud...</p>;
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Registro de conductor
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Solicitud para conducir con AXI
        </h1>

        <p className="mt-2 text-gray-600">
          AXI es una plataforma exclusiva para taxis legalmente autorizados.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl bg-white p-8 shadow-sm"
      >
        <section>
          <h2 className="mb-1 text-xl font-bold">
            Licencia del conductor
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            Ingresa los datos de tu licencia vigente.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              label="Número de licencia"
              value={licenseNumber}
              onChange={setLicenseNumber}
              placeholder="Ejemplo: ABC123456"
              required
            />

            <DateInput
              label="Vencimiento de la licencia"
              value={licenseExpiration}
              onChange={setLicenseExpiration}
              required
            />
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="mb-1 text-xl font-bold">
            Información legal del taxi
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            Escribe los datos de la unidad y de la autorización gubernamental con la que opera.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              label="Estado donde opera"
              value={operatingState}
              onChange={setOperatingState}
              placeholder="Ejemplo: Puebla"
              required
            />

            <TextInput
              label="Ciudad o municipio"
              value={operatingCity}
              onChange={setOperatingCity}
              placeholder="Ejemplo: San Andrés Cholula"
              required
            />

            <TextInput
              label="Número económico del taxi"
              value={taxiNumber}
              onChange={setTaxiNumber}
              placeholder="Ejemplo: TX-1542"
              required
            />

            <TextInput
              label="Número de concesión o permiso"
              value={concessionNumber}
              onChange={setConcessionNumber}
              placeholder="Escribe el número oficial"
              required
            />

            <TextInput
              label="Autoridad emisora"
              value={concessionAuthority}
              onChange={setConcessionAuthority}
              placeholder="Secretaría o autoridad que lo emitió"
              required
            />

            <TextInput
              label="Titular de la concesión"
              value={concessionHolderName}
              onChange={setConcessionHolderName}
              placeholder="Nombre completo del titular"
              required
            />

            <DateInput
              label="Vencimiento del permiso (opcional)"
              value={concessionExpiration}
              onChange={setConcessionExpiration}
            />

            <div>
              <label
                htmlFor="vehicleVin"
                className="mb-2 block text-sm font-semibold"
              >
                VIN o número de serie
              </label>

              <input
                id="vehicleVin"
                value={vehicleVin}
                onChange={(event) =>
                  setVehicleVin(
                    normalizeVin(
                      event.target.value
                    )
                  )
                }
                minLength={17}
                maxLength={17}
                required
                placeholder="17 caracteres"
                className="w-full rounded-xl border px-4 py-3 uppercase"
              />

              <p className="mt-2 text-xs text-gray-500">
                {normalizeVin(vehicleVin).length}/17 caracteres
              </p>
            </div>
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="mb-1 text-xl font-bold">
            Fotografías personales
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            La selfie debe mostrar claramente el rostro del solicitante.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label="Foto de perfil"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(file) =>
                updateFile(
                  "profilePhoto",
                  file
                )
              }
            />

            <DocumentInput
              label="Selfie frontal"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(file) =>
                updateFile(
                  "selfie",
                  file
                )
              }
            />
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="mb-1 text-xl font-bold">
            Documentos oficiales
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            Los archivos deben ser claros, legibles y mostrar el documento completo.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label="Licencia — frente"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(file) =>
                updateFile(
                  "licenseFront",
                  file
                )
              }
            />

            <DocumentInput
              label="Licencia — reverso"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(file) =>
                updateFile(
                  "licenseBack",
                  file
                )
              }
            />

            <DocumentInput
              label="INE, pasaporte o identificación"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              onChange={(file) =>
                updateFile(
                  "identification",
                  file
                )
              }
            />

            <DocumentInput
              label="Documento de concesión o permiso"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              onChange={(file) =>
                updateFile(
                  "concessionDocument",
                  file
                )
              }
            />
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="mb-1 text-xl font-bold">
            Fotografías exteriores del taxi
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            Son opcionales y sirven como apoyo para validar visualmente la unidad.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label="Vista frontal (opcional)"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleFrontPhoto",
                  file
                )
              }
            />

            <DocumentInput
              label="Vista trasera (opcional)"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleRearPhoto",
                  file
                )
              }
            />

            <DocumentInput
              label="Lado izquierdo (opcional)"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleLeftPhoto",
                  file
                )
              }
            />

            <DocumentInput
              label="Lado derecho (opcional)"
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleRightPhoto",
                  file
                )
              }
            />
          </div>
        </section>

        <div className="rounded-xl bg-gray-100 p-4">
          <p className="text-sm text-gray-500">
            Estado de la solicitud
          </p>

          <p className="mt-1 font-semibold">
            {status === "none" &&
              "Sin solicitud"}

            {status === "pending" &&
              "Pendiente de revisión"}

            {status === "approved" &&
              "Aprobada"}

            {status === "rejected" &&
              "Rechazada"}
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl p-4 text-sm ${
              message.includes(
                "correctamente"
              )
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={
            saving ||
            status === "approved"
          }
          className="w-full rounded-xl bg-black py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving
            ? "Subiendo documentos..."
            : "Enviar solicitud"}
        </button>
      </form>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-3"
      />
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        className="w-full rounded-xl border px-4 py-3"
      />
    </div>
  );
}

function DocumentInput({
  label,
  accept,
  required = false,
  onChange,
}: {
  label: string;
  accept: string;
  required?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        type="file"
        accept={accept}
        required={required}
        onChange={(event) =>
          onChange(
            event.target.files?.[0] ??
              null
          )
        }
        className="block w-full rounded-xl border p-3 text-sm"
      />
    </div>
  );
}
