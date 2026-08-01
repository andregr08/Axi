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

type HolderAnswer =
  | "yes"
  | "no"
  | null;

type DocumentFiles = {
  profilePhoto: File | null;
  selfie: File | null;
  licenseFront: File | null;
  licenseBack: File | null;
  identification: File | null;
  concessionDocument: File | null;
  taxCertificate: File | null;
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
  taxCertificate: null,
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

  const [
    holderAnswer,
    setHolderAnswer,
  ] = useState<HolderAnswer>(null);

  const [
    vehiclePlate,
    setVehiclePlate,
  ] = useState("");

  const [
    holderEmail,
    setHolderEmail,
  ] = useState("");

  const [
    holderPhone,
    setHolderPhone,
  ] = useState("");

  const [
    holderRelationship,
    setHolderRelationship,
  ] = useState("");

  const [
    authorizationExpiration,
    setAuthorizationExpiration,
  ] = useState("");

  const [
    authorizationNoExpiration,
    setAuthorizationNoExpiration,
  ] = useState(false);

  const [
    authorizationToken,
    setAuthorizationToken,
  ] = useState<string | null>(null);

  const [
    authorizationLink,
    setAuthorizationLink,
  ] = useState("");

  const [vehicleVin, setVehicleVin] =
    useState("");

  const [rfc, setRfc] =
    useState("");

  const [fiscalName, setFiscalName] =
    useState("");

  const [
    fiscalPostalCode,
    setFiscalPostalCode,
  ] = useState("");

  const [
    taxRegimeCode,
    setTaxRegimeCode,
  ] = useState("");

  const [
    existingTaxCertificateUrl,
    setExistingTaxCertificateUrl,
  ] = useState<string | null>(null);

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
        id,
        is_concession_holder,
        license_number,
        license_expiration,
        operating_state,
        operating_city,
        taxi_number,
        vehicle_plate,
        concession_number,
        concession_authority,
        concession_holder_name,
        concession_expiration,
        vehicle_vin,
        rfc,
        fiscal_name,
        fiscal_postal_code,
        tax_regime_code,
        tax_certificate_url,
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

      setVehiclePlate(
        data.vehicle_plate ?? ""
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

      setRfc(
        data.rfc ?? ""
      );

      setFiscalName(
        data.fiscal_name ?? ""
      );

      setFiscalPostalCode(
        data.fiscal_postal_code ?? ""
      );

      setTaxRegimeCode(
        data.tax_regime_code ?? ""
      );

      setExistingTaxCertificateUrl(
        data.tax_certificate_url ?? null
      );

      setStatus(
        data.status as Status
      );

      const loadedHolderAnswer: HolderAnswer =
        data.is_concession_holder === false
          ? "no"
          : "yes";

      setHolderAnswer(
        loadedHolderAnswer
      );

      if (
        loadedHolderAnswer === "no" &&
        data.id
      ) {
        const {
          data: holderAuthorization,
          error: holderAuthorizationError,
        } = await supabase
          .from(
            "permit_holder_authorizations"
          )
          .select(`
            holder_email,
            holder_phone,
            relationship_to_driver,
            authorization_expires_on,
            no_expiration,
            authorization_token
          `)
          .eq(
            "driver_application_id",
            data.id
          )
          .maybeSingle();

        if (
          !holderAuthorizationError &&
          holderAuthorization
        ) {
          setHolderEmail(
            holderAuthorization
              .holder_email ?? ""
          );

          setHolderPhone(
            holderAuthorization
              .holder_phone ?? ""
          );

          setHolderRelationship(
            holderAuthorization
              .relationship_to_driver ?? ""
          );

          setAuthorizationExpiration(
            holderAuthorization
              .authorization_expires_on ?? ""
          );

          setAuthorizationNoExpiration(
            holderAuthorization
              .no_expiration ?? false
          );

          setAuthorizationToken(
            holderAuthorization
              .authorization_token ?? null
          );
        }
      }
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

  useEffect(() => {
    if (!authorizationToken) {
      setAuthorizationLink("");
      return;
    }

    setAuthorizationLink(
      `${window.location.origin}/permit-holder/${authorizationToken}`
    );
  }, [authorizationToken]);

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

  function normalizeRfc(value: string) {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9Ñ&]/g, "")
      .slice(0, 13);
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

    const cleanRfc =
      normalizeRfc(rfc);

    if (holderAnswer === null) {
      setMessage(
        "Selecciona si eres titular del permiso o concesión."
      );
      return;
    }

    if (!vehiclePlate.trim()) {
      setMessage(
        "Las placas del taxi son obligatorias."
      );
      return;
    }

    if (holderAnswer === "no") {
      const cleanHolderEmail =
        holderEmail.trim();

      const cleanHolderPhone =
        holderPhone.trim();

      if (
        !cleanHolderEmail &&
        !cleanHolderPhone
      ) {
        setMessage(
          "Registra el correo o teléfono del permisionario."
        );
        return;
      }

      if (
        cleanHolderEmail &&
        !/^[^s@]+@[^s@]+.[^s@]+$/.test(
          cleanHolderEmail
        )
      ) {
        setMessage(
          "El correo del permisionario no es válido."
        );
        return;
      }

      if (!holderRelationship.trim()) {
        setMessage(
          "Indica tu relación con el permisionario."
        );
        return;
      }

      if (
        !authorizationNoExpiration &&
        !authorizationExpiration
      ) {
        setMessage(
          "Indica la vigencia de la autorización."
        );
        return;
      }
    }

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
      !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(
        cleanRfc
      )
    ) {
      setMessage(
        t("driverApplication.rfcInvalid")
      );
      return;
    }

    if (fiscalName.trim().length < 3) {
      setMessage(
        t("driverApplication.fiscalNameRequired")
      );
      return;
    }

    if (
      !/^[0-9]{5}$/.test(
        fiscalPostalCode.trim()
      )
    ) {
      setMessage(
        t("driverApplication.fiscalPostalCodeInvalid")
      );
      return;
    }

    if (
      !/^[0-9]{3}$/.test(
        taxRegimeCode.trim()
      )
    ) {
      setMessage(
        t("driverApplication.taxRegimeInvalid")
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

      const uploadedTaxCertificatePath =
        await uploadOptionalDocument(
          userId,
          files.taxCertificate,
          "tax-certificate"
        );

      const taxCertificatePath =
        uploadedTaxCertificatePath ??
        existingTaxCertificateUrl;

      const {
        data: savedApplication,
        error,
      } = await supabase
        .from("driver_applications")
        .upsert(
          {
            user_id: userId,

            is_concession_holder:
              holderAnswer === "yes",

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

            vehicle_plate:
              vehiclePlate
                .trim()
                .toUpperCase(),

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

            rfc:
              cleanRfc,

            fiscal_name:
              fiscalName.trim(),

            fiscal_postal_code:
              fiscalPostalCode.trim(),

            tax_regime_code:
              taxRegimeCode.trim(),

            tax_certificate_url:
              taxCertificatePath,

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
        )
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (!savedApplication?.id) {
        throw new Error(
          "No fue posible identificar la solicitud guardada."
        );
      }

      if (holderAnswer === "yes") {
        const {
          error: holderSelectionError,
        } = await supabase.rpc(
          "set_driver_as_concession_holder",
          {
            p_application_id:
              savedApplication.id,
          }
        );

        if (holderSelectionError) {
          throw new Error(
            holderSelectionError.message
          );
        }

        setAuthorizationToken(null);
      }

      if (holderAnswer === "no") {
        const {
          error: authorizationError,
        } = await supabase.rpc(
          "upsert_permit_holder_authorization",
          {
            p_application_id:
              savedApplication.id,

            p_holder_name:
              concessionHolderName.trim(),

            p_holder_email:
              holderEmail.trim() || null,

            p_holder_phone:
              holderPhone.trim() || null,

            p_relationship_to_driver:
              holderRelationship.trim(),

            p_authorization_expires_on:
              authorizationNoExpiration
                ? null
                : authorizationExpiration,

            p_no_expiration:
              authorizationNoExpiration,
          }
        );

        if (authorizationError) {
          throw new Error(
            authorizationError.message
          );
        }

        const {
          data: savedAuthorization,
          error: savedAuthorizationError,
        } = await supabase
          .from(
            "permit_holder_authorizations"
          )
          .select(
            "authorization_token"
          )
          .eq(
            "driver_application_id",
            savedApplication.id
          )
          .single();

        if (
          savedAuthorizationError ||
          !savedAuthorization
            ?.authorization_token
        ) {
          throw new Error(
            savedAuthorizationError
              ?.message ||
              "No fue posible generar el enlace del permisionario."
          );
        }

        setAuthorizationToken(
          savedAuthorization
            .authorization_token
        );
      }

      setStatus("pending");

      setMessage(
        holderAnswer === "no"
          ? "Solicitud enviada correctamente. Pendiente de autorización del permisionario."
          : t(
              "driverApplication.submitted"
            )
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

  async function copyAuthorizationLink() {
    if (!authorizationLink) {
      setMessage(
        "El enlace todavía no est? disponible."
      );
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          authorizationLink
        );
      } else {
        const temporaryInput =
          document.createElement(
            "textarea"
          );

        temporaryInput.value =
          authorizationLink;

        temporaryInput.style.position =
          "fixed";

        temporaryInput.style.opacity =
          "0";

        document.body.appendChild(
          temporaryInput
        );

        temporaryInput.select();

        document.execCommand("copy");

        temporaryInput.remove();
      }

      setMessage(
        "Enlace copiado correctamente."
      );
    } catch {
      setMessage(
        "No fue posible copiar el enlace."
      );
    }
  }

  async function shareAuthorizationLink() {
    if (!authorizationLink) {
      setMessage(
        "El enlace todavía no est? disponible."
      );
      return;
    }

    const shareData = {
      title:
        "Autorización de conductor AXI",

      text:
        `Hola. ${concessionHolderName.trim() || "El titular del permiso"} debe revisar y autorizar mi solicitud para conducir este taxi en AXI.`,

      url:
        authorizationLink,
    };

    try {
      if (navigator.share) {
        await navigator.share(
          shareData
        );

        setMessage(
          "Enlace compartido correctamente."
        );

        return;
      }

      await copyAuthorizationLink();
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return;
      }

      setMessage(
        "No fue posible compartir el enlace."
      );
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
            ¿Eres titular del permiso o concesión del taxi?
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            Selecciona la opción que corresponda antes de continuar con tu registro.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={status === "approved"}
              onClick={() => setHolderAnswer("yes")}
              className={
                holderAnswer === "yes"
                  ? "rounded-xl border border-black bg-black p-5 text-left text-white transition"
                  : "rounded-xl border border-gray-200 bg-white p-5 text-left text-gray-900 transition hover:border-gray-400"
              }
            >
              <span className="block font-bold">
                Sí, soy el titular
              </span>

              <span className="mt-2 block text-sm opacity-80">
                El permiso o concesión del taxi está a mi nombre.
              </span>
            </button>

            <button
              type="button"
              disabled={status === "approved"}
              onClick={() => setHolderAnswer("no")}
              className={
                holderAnswer === "no"
                  ? "rounded-xl border border-black bg-black p-5 text-left text-white transition"
                  : "rounded-xl border border-gray-200 bg-white p-5 text-left text-gray-900 transition hover:border-gray-400"
              }
            >
              <span className="block font-bold">
                No, trabajo para un permisionario
              </span>

              <span className="mt-2 block text-sm opacity-80">
                El titular deberá autorizarme antes de que AXI pueda activarme.
              </span>
            </button>
          </div>
        </section>

        {holderAnswer !== null && (
          <>
        <section className="border-t pt-8">
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
            {t("driverApplication.fiscalInformation")}
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            {t("driverApplication.fiscalDescription")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              label={t("driverApplication.rfc")}
              value={rfc}
              onChange={(value) =>
                setRfc(normalizeRfc(value))
              }
              placeholder={t("driverApplication.rfcPlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.fiscalName")}
              value={fiscalName}
              onChange={setFiscalName}
              placeholder={t("driverApplication.fiscalNamePlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.fiscalPostalCode")}
              value={fiscalPostalCode}
              onChange={(value) =>
                setFiscalPostalCode(
                  value
                    .replace(/[^0-9]/g, "")
                    .slice(0, 5)
                )
              }
              placeholder={t("driverApplication.fiscalPostalCodePlaceholder")}
              required
            />

            <TextInput
              label={t("driverApplication.taxRegimeCode")}
              value={taxRegimeCode}
              onChange={(value) =>
                setTaxRegimeCode(
                  value
                    .replace(/[^0-9]/g, "")
                    .slice(0, 3)
                )
              }
              placeholder={t("driverApplication.taxRegimePlaceholder")}
              required
            />

            <div className="md:col-span-2">
              <DocumentInput
                label={t("driverApplication.taxCertificateOptional")}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(file) =>
                  updateFile(
                    "taxCertificate",
                    file
                  )
                }
              />

              {existingTaxCertificateUrl && (
                <p className="mt-2 text-xs font-medium text-green-700">
                  {t("driverApplication.existingTaxCertificate")}
                </p>
              )}
            </div>
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
              label="Placas del taxi"
              value={vehiclePlate}
              onChange={(value) =>
                setVehiclePlate(
                  value
                    .toUpperCase()
                    .replace(
                      /[^A-Z0-9-]/g,
                      ""
                    )
                )
              }
              placeholder="Ej. 1234-SSJ"
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
              label={
                holderAnswer === "no"
                  ? "Nombre completo del permisionario"
                  : t(
                      "driverApplication.concessionHolder"
                    )
              }
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

        {holderAnswer === "no" && (
          <section className="border-t pt-8">
            <h2 className="mb-1 text-xl font-bold">
              Datos del permisionario
            </h2>

            <p className="mb-5 text-sm text-gray-500">
              Ya utilizamos el nombre del titular y el número de concesión capturados arriba. Completa los datos necesarios para solicitar su autorización.
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <TextInput
                label="Correo electrónico"
                value={holderEmail}
                onChange={setHolderEmail}
                placeholder="correo@ejemplo.com"
              />

              <TextInput
                label="Teléfono"
                value={holderPhone}
                onChange={(value) =>
                  setHolderPhone(
                    value.replace(
                      /[^0-9+ ()-]/g,
                      ""
                    )
                  )
                }
                placeholder="222 123 4567"
              />

              <TextInput
                label="Relación con el conductor"
                value={holderRelationship}
                onChange={setHolderRelationship}
                placeholder="Empleado, operador, familiar..."
                required
              />

              <div>
                <p className="mb-2 block text-sm font-semibold">
                  Vigencia
                </p>

                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      authorizationNoExpiration
                    }
                    onChange={(event) => {
                      const checked =
                        event.target.checked;

                      setAuthorizationNoExpiration(
                        checked
                      );

                      if (checked) {
                        setAuthorizationExpiration(
                          ""
                        );
                      }
                    }}
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold">
                    Sin fecha definida
                  </span>
                </label>
              </div>

              {!authorizationNoExpiration && (
                <DateInput
                  label="Fecha de vencimiento de la autorización"
                  value={
                    authorizationExpiration
                  }
                  onChange={
                    setAuthorizationExpiration
                  }
                  required
                />
              )}
            </div>

            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              El conductor permanecerá pendiente y no podrá recibir viajes hasta que el permisionario autorice la solicitud y AXI la apruebe.
            </div>
          </section>
        )}

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
              (
                holderAnswer === "no"
                  ? "Pendiente de autorización del permisionario"
                  : t(
                      "driverApplication.pending"
                    )
              )}

            {status === "approved" &&
              t("driverApplication.approved")}

            {status === "rejected" &&
              t("driverApplication.rejected")}
          </p>
        </div>

        {holderAnswer === "no" &&
          authorizationToken &&
          authorizationLink && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                Autorización del permisionario
              </p>

              <h2 className="mt-2 text-lg font-bold text-blue-950">
                Comparte este enlace con el titular
              </h2>

              <p className="mt-2 text-sm leading-6 text-blue-900">
                El permisionario deberá abrirlo, revisar los datos, subir su identificación y su concesión, y autorizarte.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl border border-blue-200 bg-white p-4">
                <p className="break-all text-sm font-medium text-slate-700">
                  {authorizationLink}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void copyAuthorizationLink()
                  }
                  className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-100"
                >
                  Copiar enlace
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void shareAuthorizationLink()
                  }
                  className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-900"
                >
                  Compartir con el permisionario
                </button>
              </div>

              <p className="mt-4 text-xs leading-5 text-blue-800">
                Tu solicitud permanecerá bloqueada hasta que el titular autorice y AXI revise los documentos.
              </p>
            </section>
          )}

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
          </>
        )}
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
