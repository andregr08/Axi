"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/lib/supabaseClient";

type AuthorizationStatus =
  | "pending"
  | "authorized"
  | "expired"
  | "revoked";

type PublicAuthorization = {
  authorization_id: string;
  authorization_status:
    AuthorizationStatus;
  holder_name: string;
  driver_name: string | null;
  taxi_number: string | null;
  vehicle_plate: string | null;
  concession_number: string | null;
  authorization_expires_on:
    string | null;
  no_expiration: boolean;
};

type Props = {
  token: string;
};

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const maximumFileSize =
  10 * 1024 * 1024;

export function PermitHolderAuthorizationForm({
  token,
}: Props) {
  const [
    authorization,
    setAuthorization,
  ] = useState<PublicAuthorization | null>(
    null
  );

  const [identification, setIdentification] =
    useState<File | null>(null);

  const [
    concessionDocument,
    setConcessionDocument,
  ] = useState<File | null>(null);

  const [
    declarationAccepted,
    setDeclarationAccepted,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadAuthorization() {
      setLoading(true);
      setMessage("");

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_permit_holder_authorization_public",
        {
          p_token: token,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        setMessage(
          "No fue posible consultar esta autorizaci?n."
        );
        setLoading(false);
        return;
      }

      const result =
        Array.isArray(data) && data.length > 0
          ? (
              data[0] as PublicAuthorization
            )
          : null;

      if (!result) {
        setMessage(
          "El enlace no existe o ya no es v?lido."
        );
        setLoading(false);
        return;
      }

      setAuthorization(result);
      setLoading(false);
    }

    void loadAuthorization();

    return () => {
      active = false;
    };
  }, [token]);

  function validateFile(
    file: File | null,
    label: string
  ) {
    if (!file) {
      return `Selecciona ${label}.`;
    }

    if (!allowedTypes.includes(file.type)) {
      return `${label} debe ser una imagen o un archivo PDF.`;
    }

    if (file.size > maximumFileSize) {
      return `${label} no puede pesar m?s de 10 MB.`;
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (
      !authorization ||
      authorization.authorization_status !==
        "pending"
    ) {
      setMessage(
        "Esta autorizaci?n ya no se encuentra pendiente."
      );
      return;
    }

    const identificationFile =
      identification;

    const concessionFile =
      concessionDocument;

    const identificationError =
      validateFile(
        identificationFile,
        "tu identificaci?n oficial"
      );

    if (identificationError) {
      setMessage(
        identificationError
      );
      return;
    }

    const concessionError =
      validateFile(
        concessionFile,
        "el permiso o concesi?n"
      );

    if (concessionError) {
      setMessage(
        concessionError
      );
      return;
    }

    if (
      !identificationFile ||
      !concessionFile
    ) {
      setMessage(
        "Debes adjuntar los dos documentos requeridos."
      );
      return;
    }

    if (!declarationAccepted) {
      setMessage(
        "Debes aceptar la declaraci?n para autorizar al conductor."
      );
      return;
    }

    const identificationPath =
      `${token}/identification`;

    const concessionPath =
      `${token}/concession`;

    const uploadedPaths: string[] =
      [];

    setSubmitting(true);

    try {
      const storage =
        supabase.storage.from(
          "permit-holder-documents"
        );

      /*
       * Eliminar restos de un intento
       * anterior que no haya terminado.
       * Esto solamente funciona mientras
       * la autorizaci?n siga pendiente.
       */
      const {
        error: staleFilesError,
      } = await storage.remove([
        identificationPath,
        concessionPath,
      ]);

      if (staleFilesError) {
        throw new Error(
          `No fue posible preparar los documentos: ${staleFilesError.message}`
        );
      }

      const {
        error:
          identificationUploadError,
      } = await storage.upload(
        identificationPath,
        identificationFile,
        {
          upsert: false,
          contentType:
            identificationFile.type,
          cacheControl: "3600",
        }
      );

      if (
        identificationUploadError
      ) {
        throw new Error(
          `No fue posible subir la identificaci?n: ${identificationUploadError.message}`
        );
      }

      uploadedPaths.push(
        identificationPath
      );

      const {
        error:
          concessionUploadError,
      } = await storage.upload(
        concessionPath,
        concessionFile,
        {
          upsert: false,
          contentType:
            concessionFile.type,
          cacheControl: "3600",
        }
      );

      if (concessionUploadError) {
        throw new Error(
          `No fue posible subir el permiso o concesi?n: ${concessionUploadError.message}`
        );
      }

      uploadedPaths.push(
        concessionPath
      );

      const {
        error: authorizationError,
      } = await supabase.rpc(
        "authorize_permit_holder_public",
        {
          p_token: token,

          p_identification_path:
            identificationPath,

          p_concession_document_path:
            concessionPath,

          p_declaration_accepted:
            declarationAccepted,
        }
      );

      if (authorizationError) {
        throw new Error(
          authorizationError.message
        );
      }

      setAuthorization(
        (current) =>
          current
            ? {
                ...current,

                authorization_status:
                  "authorized",
              }
            : current
      );

      setIdentification(null);

      setConcessionDocument(null);

      setDeclarationAccepted(false);

      setMessage(
        "Autorizaci?n registrada correctamente. AXI revisar? los documentos antes de activar al conductor."
      );
    } catch (error) {
      /*
       * Si todav?a no se confirm? la
       * autorizaci?n, borrar cualquier
       * archivo cargado durante el intento.
       */
      if (
        uploadedPaths.length > 0
      ) {
        const {
          error: cleanupError,
        } = await supabase.storage
          .from(
            "permit-holder-documents"
          )
          .remove(uploadedPaths);

        if (cleanupError) {
          console.error(
            "No fue posible limpiar los documentos incompletos:",
            cleanupError
          );
        }
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Ocurri? un error inesperado."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <p className="text-sm font-semibold text-slate-600">
          Consultando autorizaci?n...
        </p>
      </main>
    );
  }

  if (!authorization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
          <Logo />

          <h1 className="mt-8 text-2xl font-black text-slate-950">
            Enlace no disponible
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {message}
          </p>
        </div>
      </main>
    );
  }

  const isAuthorized =
    authorization.authorization_status ===
    "authorized";

  const isUnavailable =
    authorization.authorization_status ===
      "expired" ||
    authorization.authorization_status ===
      "revoked";

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Logo />

          <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
            Autorizaci?n de conductor
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Solicitud del titular del permiso
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Revisa la informaci?n del conductor y del taxi antes de otorgar tu autorizaci?n.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-black text-slate-950">
            Informaci?n de la solicitud
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DataItem
              label="Permisionario"
              value={
                authorization.holder_name
              }
            />

            <DataItem
              label="Conductor"
              value={
                authorization.driver_name ||
                "Sin nombre registrado"
              }
            />

            <DataItem
              label="N?mero de taxi"
              value={
                authorization.taxi_number ||
                "No registrado"
              }
            />

            <DataItem
              label="Placas"
              value={
                authorization.vehicle_plate ||
                "No registradas"
              }
            />

            <DataItem
              label="Permiso o concesi?n"
              value={
                authorization.concession_number ||
                "No registrado"
              }
            />

            <DataItem
              label="Vigencia de autorizaci?n"
              value={
                authorization.no_expiration
                  ? "Sin fecha definida"
                  : formatDate(
                      authorization
                        .authorization_expires_on
                    )
              }
            />
          </div>
        </section>

        {isAuthorized && (
          <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <h2 className="text-xl font-black">
              Autorizaci?n registrada
            </h2>

            <p className="mt-2 text-sm leading-6">
              Tus documentos fueron recibidos. El conductor continuar? pendiente hasta que AXI termine la revisi?n.
            </p>
          </section>
        )}

        {isUnavailable && (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
            <h2 className="text-xl font-black">
              Autorizaci?n no disponible
            </h2>

            <p className="mt-2 text-sm leading-6">
              Este enlace venci? o fue revocado. El conductor deber? solicitar uno nuevo.
            </p>
          </section>
        )}

        {!isAuthorized && !isUnavailable && (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-6 rounded-3xl bg-white p-6 shadow-sm md:p-8"
          >
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Documentos del permisionario
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Los documentos deben pertenecer al titular indicado en esta solicitud.
              </p>
            </div>

            <FileInput
              label="Identificaci?n oficial"
              description="INE, pasaporte u otra identificaci?n oficial vigente."
              file={identification}
              onChange={setIdentification}
            />

            <FileInput
              label="Permiso o concesi?n"
              description="Documento oficial del permiso o concesi?n a tu nombre."
              file={concessionDocument}
              onChange={setConcessionDocument}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <input
                type="checkbox"
                checked={
                  declarationAccepted
                }
                onChange={(event) =>
                  setDeclarationAccepted(
                    event.target.checked
                  )
                }
                className="mt-1 h-4 w-4"
              />

              <span className="text-sm leading-6 text-slate-700">
                Declaro que soy titular del permiso o concesi?n mostrado, que la informaci?n proporcionada es verdadera y que autorizo expresamente al conductor indicado para operar este taxi durante la vigencia registrada.
              </span>
            </label>

            {message && (
              <div
                className={
                  message.includes(
                    "correctamente"
                  )
                    ? "rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
                    : "rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800"
                }
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-slate-950 px-6 py-4 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Guardando autorizaci?n..."
                : "Autorizar conductor"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "No registrada";
  }

  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString(
    "es-MX",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function DataItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 break-words font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function FileInput({
  label,
  description,
  file,
  onChange,
}: {
  label: string;
  description: string;
  file: File | null;
  onChange: (
    file: File | null
  ) => void;
}) {
  return (
    <div>
      <p className="font-bold text-slate-900">
        {label}
      </p>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <label className="mt-3 block cursor-pointer">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(event) =>
            onChange(
              event.target.files?.[0] ??
                null
            )
          }
        />

        <span className="flex min-h-14 items-center overflow-hidden rounded-2xl border border-slate-200">
          <span className="flex min-h-14 shrink-0 items-center bg-slate-950 px-4 text-sm font-bold text-white">
            Seleccionar
          </span>

          <span className="min-w-0 flex-1 truncate px-4 text-sm text-slate-500">
            {file?.name ||
              "Ning?n archivo seleccionado"}
          </span>
        </span>
      </label>
    </div>
  );
}
