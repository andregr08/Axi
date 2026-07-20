"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";

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
  const { t } = useLanguage();

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
        `${t("driverApplication.loadError")} ${error.message}`
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
        `${t("driverApplication.uploadError")} ${documentName}: ${error.message}`
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
        t("driverApplication.licenseRequired")
      );
      return;
    }

    if (
      !operatingState.trim() ||
      !operatingCity.trim()
    ) {
      setMessage(
        t("driverApplication.locationRequired")
      );
      return;
    }

    if (!taxiNumber.trim()) {
      setMessage(
        t("driverApplication.taxiNumberRequired")
      );
      return;
    }

    if (
      concessionNumber.trim().length < 3
    ) {
      setMessage(
        t("driverApplication.concessionNumberInvalid")
      );
      return;
    }

    if (!concessionAuthority.trim()) {
      setMessage(
        t("driverApplication.concessionAuthorityRequired")
      );
      return;
    }

    if (!concessionHolderName.trim()) {
      setMessage(
        t("driverApplication.concessionHolderRequired")
      );
      return;
    }

    if (cleanVin.length !== 17) {
      setMessage(
        t("driverApplication.vinInvalid")
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
        t("driverApplication.documentsRequired")
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
        t("driverApplication.submitted")
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("driverApplication.unexpectedError");

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>{t("driverApplication.loading")}</p>;
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          {t("driverApplication.section")}
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          {t("driverApplication.title")}
        </h1>

        <p className="mt-2 text-gray-600">
          {t("driverApplication.description")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl bg-white p-8 shadow-sm"
      >
        <section>
          <h2 className="mb-1 text-xl font-bold">
            {t("driverApplication.driverLicense")}
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            {t("driverApplication.driverLicenseDescription")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              label={t("driverApplication.licenseNumber")}
              value={licenseNumber}
              onChange={setLicenseNumber}
              placeholder={t("driverApplication.licenseNumberPlaceholder")}
              required
            />

            <DateInput
              label={t("driverApplication.licenseExpiration")}
              value={licenseExpiration}
              onChange={setLicenseExpiration}
              required
            />
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="mb-1 text-xl font-bold">
            {t("driverApplication.taxiLegalInformation")}
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            {t("driverApplication.taxiLegalDescription")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              label={t("driverApplication.operatingState")}
              value={operatingState}
              onChange={setOperatingState}
              placeholder={t("driverApplication.operatingStatePlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.operatingCity")}
              value={operatingCity}
              onChange={setOperatingCity}
              placeholder={t("driverApplication.operatingCityPlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.taxiNumber")}
              value={taxiNumber}
              onChange={setTaxiNumber}
              placeholder={t("driverApplication.taxiNumberPlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.concessionNumber")}
              value={concessionNumber}
              onChange={setConcessionNumber}
              placeholder={t("driverApplication.concessionNumberPlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.concessionAuthority")}
              value={concessionAuthority}
              onChange={setConcessionAuthority}
              placeholder={t("driverApplication.concessionAuthorityPlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.concessionHolder")}
              value={concessionHolderName}
              onChange={setConcessionHolderName}
              placeholder={t("driverApplication.concessionHolderPlaceholder")}
              required
            />

            <DateInput
              label={t("driverApplication.concessionExpiration")}
              value={concessionExpiration}
              onChange={setConcessionExpiration}
            />

            <div>
              <label
                htmlFor="vehicleVin"
                className="mb-2 block text-sm font-semibold"
              >
                {t("driverApplication.vehicleVin")}
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
                placeholder={t("driverApplication.vinPlaceholder")}
                className="w-full rounded-xl border px-4 py-3 uppercase"
              />

              <p className="mt-2 text-xs text-gray-500">
                {normalizeVin(vehicleVin).length}/17 {t("driverApplication.characters")}
              </p>
            </div>
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="mb-1 text-xl font-bold">
            {t("driverApplication.personalPhotos")}
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            {t("driverApplication.personalPhotosDescription")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label={t("driverApplication.profilePhoto")}
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
              label={t("driverApplication.frontSelfie")}
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
            {t("driverApplication.officialDocuments")}
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            {t("driverApplication.officialDocumentsDescription")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label={t("driverApplication.licenseFront")}
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
              label={t("driverApplication.licenseBack")}
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
              label={t("driverApplication.identification")}
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
              label={t("driverApplication.concessionDocument")}
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
            {t("driverApplication.taxiPhotos")}
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            {t("driverApplication.taxiPhotosDescription")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <DocumentInput
              label={t("driverApplication.vehicleFront")}
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleFrontPhoto",
                  file
                )
              }
            />

            <DocumentInput
              label={t("driverApplication.vehicleRear")}
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleRearPhoto",
                  file
                )
              }
            />

            <DocumentInput
              label={t("driverApplication.vehicleLeft")}
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                updateFile(
                  "vehicleLeftPhoto",
                  file
                )
              }
            />

            <DocumentInput
              label={t("driverApplication.vehicleRight")}
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
            {t("driverApplication.applicationStatus")}
          </p>

          <p className="mt-1 font-semibold">
            {status === "none" &&
              t("driverApplication.noApplication")}

            {status === "pending" &&
              t("driverApplication.pending")}

            {status === "approved" &&
              t("driverApplication.approved")}

            {status === "rejected" &&
              t("driverApplication.rejected")}
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl p-4 text-sm ${
              (message.includes("correctamente") || message.includes("successfully"))
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
            ? t("driverApplication.uploading")
            : t("driverApplication.submit")}
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
  const { t } = useLanguage();
  const [fileName, setFileName] = useState("");

  return (
    <div>
      <p className="mb-2 block text-sm font-semibold">
        {label}
      </p>

      <label className="block cursor-pointer">
        <input
          type="file"
          accept={accept}
          required={required}
          className="sr-only"
          onChange={(event) => {
            const selectedFile =
              event.target.files?.[0] ?? null;

            setFileName(
              selectedFile?.name ?? ""
            );

            onChange(selectedFile);
          }}
        />

        <span className="flex min-h-14 items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-400">
          <span className="flex min-h-14 shrink-0 items-center bg-slate-950 px-4 text-sm font-bold text-white">
            {t("driverApplication.chooseFile")}
          </span>

          <span className="min-w-0 flex-1 truncate px-4 text-sm text-slate-500">
            {fileName ||
              t("driverApplication.noFileSelected")}
          </span>
        </span>
      </label>
    </div>
  );
}
