"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  FileCheck2,
  FileImage,
  FileText,
  IdCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type Status = "none" | "pending" | "approved" | "rejected";

type DocumentFiles = {
  profilePhoto: File | null;
  selfie: File | null;
  licenseFront: File | null;
  licenseBack: File | null;
  identification: File | null;
};

type DocumentField = keyof DocumentFiles;

const emptyFiles: DocumentFiles = {
  profilePhoto: null,
  selfie: null,
  licenseFront: null,
  licenseBack: null,
  identification: null,
};

const documentConfiguration: Array<{
  field: DocumentField;
  title: string;
  description: string;
  accept: string;
  icon: typeof Camera;
}> = [
  {
    field: "profilePhoto",
    title: "Foto de perfil",
    description: "Fotografía clara, reciente y con buena iluminación.",
    accept: "image/jpeg,image/png,image/webp",
    icon: CircleUserRound,
  },
  {
    field: "selfie",
    title: "Selfie frontal",
    description: "Muestra tu rostro completo, sin lentes ni accesorios.",
    accept: "image/jpeg,image/png,image/webp",
    icon: Camera,
  },
  {
    field: "licenseFront",
    title: "Licencia — frente",
    description: "La información debe verse completa y ser legible.",
    accept: "image/jpeg,image/png,image/webp",
    icon: IdCard,
  },
  {
    field: "licenseBack",
    title: "Licencia — reverso",
    description: "Evita reflejos, sombras o partes recortadas.",
    accept: "image/jpeg,image/png,image/webp",
    icon: FileImage,
  },
  {
    field: "identification",
    title: "Identificación oficial",
    description: "INE, pasaporte u otra identificación vigente.",
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    icon: FileText,
  },
];

const statusContent: Record<
  Status,
  {
    label: string;
    description: string;
    icon: typeof Clock3;
    containerClass: string;
    iconClass: string;
  }
> = {
  none: {
    label: "Sin solicitud",
    description: "Completa tus datos y documentos para iniciar.",
    icon: AlertCircle,
    containerClass: "border-slate-200 bg-slate-50",
    iconClass: "bg-slate-200 text-slate-700",
  },
  pending: {
    label: "Pendiente de revisión",
    description: "El equipo de AXI está revisando tus documentos.",
    icon: Clock3,
    containerClass: "border-amber-200 bg-amber-50",
    iconClass: "bg-amber-200 text-amber-800",
  },
  approved: {
    label: "Solicitud aprobada",
    description: "Tu cuenta ya puede continuar como conductor.",
    icon: BadgeCheck,
    containerClass: "border-emerald-200 bg-emerald-50",
    iconClass: "bg-emerald-200 text-emerald-800",
  },
  rejected: {
    label: "Solicitud rechazada",
    description: "Revisa tus datos y vuelve a enviar los documentos.",
    icon: XCircle,
    containerClass: "border-red-200 bg-red-50",
    iconClass: "bg-red-200 text-red-800",
  },
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

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
        setStatus(data.status as Status);
      }

      setLoading(false);
    }

    void loadApplication();
  }, [router]);

  const selectedDocuments = useMemo(
    () => Object.values(files).filter(Boolean).length,
    [files]
  );

  const completionPercentage = Math.round(
    (selectedDocuments / documentConfiguration.length) * 100
  );

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
    const path = `${userId}/${documentName}.${extension}`;

    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      throw new Error(
        `Error subiendo ${documentName}: ${error.message}`
      );
    }

    return path;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!licenseNumber.trim() || !licenseExpiration) {
      setMessage(
        "Completa el número y vencimiento de la licencia."
      );
      return;
    }

    const expirationDate = new Date(
      `${licenseExpiration}T23:59:59`
    );

    if (expirationDate.getTime() <= Date.now()) {
      setMessage(
        "La fecha de vencimiento de la licencia debe ser futura."
      );
      return;
    }

    const allDocumentsSelected =
      files.profilePhoto &&
      files.selfie &&
      files.licenseFront &&
      files.licenseBack &&
      files.identification;

    if (!allDocumentsSelected) {
      setMessage(
        "Debes seleccionar todos los documentos y fotografías."
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
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.";

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function updateFile(
    field: DocumentField,
    file: File | null
  ) {
    if (file && file.size > 10 * 1024 * 1024) {
      setMessage(
        "Cada archivo debe pesar menos de 10 MB."
      );
      return;
    }

    setMessage("");

    setFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[1fr_0.42fr]">
          <div className="h-[650px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[450px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  const currentStatus = statusContent[status];
  const StatusIcon = currentStatus.icon;
  const formDisabled =
    saving || status === "approved" || status === "pending";

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <CarIcon />
              Registro de conductor
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Conduce y crece con AXI
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Completa tus datos, sube documentos vigentes y envía tu
              solicitud para comenzar el proceso de verificación.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ShieldCheck size={18} className="text-yellow-400" />
                Revisión segura
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <LockKeyhole size={18} className="text-yellow-400" />
                Documentos protegidos
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Progreso de documentos
                </p>

                <p className="mt-2 text-4xl font-black">
                  {selectedDocuments}/{documentConfiguration.length}
                </p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <FileCheck2 size={26} />
              </span>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                style={{
                  width: `${completionPercentage}%`,
                }}
              />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-300">
              {completionPercentage}% completado
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 rounded-[2rem] border p-5 sm:flex-row sm:items-center",
          currentStatus.containerClass
        )}
      >
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
            currentStatus.iconClass
          )}
        >
          <StatusIcon size={25} />
        </span>

        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Estado de tu solicitud
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            {currentStatus.label}
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            {currentStatus.description}
          </p>
        </div>

        {status === "approved" && (
          <Link
            href="/dashboard/driver/status"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 font-black text-white transition hover:bg-emerald-800"
          >
            Ir al panel
            <ArrowRight size={18} />
          </Link>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 xl:grid-cols-[1fr_0.38fr]"
      >
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Paso 1
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Información de licencia
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  La licencia debe estar vigente y coincidir con tus
                  documentos oficiales.
                </p>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <IdCard size={23} />
              </span>
            </div>

            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="license-number"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  Número de licencia
                </label>

                <div className="relative">
                  <IdCard
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="license-number"
                    value={licenseNumber}
                    onChange={(event) =>
                      setLicenseNumber(event.target.value)
                    }
                    disabled={formDisabled}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Ejemplo: PUE123456"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="license-expiration"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  Vencimiento de la licencia
                </label>

                <div className="relative">
                  <CalendarDays
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="license-expiration"
                    type="date"
                    value={licenseExpiration}
                    onChange={(event) =>
                      setLicenseExpiration(event.target.value)
                    }
                    disabled={formDisabled}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Paso 2
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Fotografías y documentos
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Sube archivos claros, completos y sin reflejos. Cada
                  archivo puede pesar hasta 10 MB.
                </p>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <UploadCloud size={23} />
              </span>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {documentConfiguration.map((document) => {
                const selectedFile = files[document.field];

                return (
                  <DocumentInput
                    key={document.field}
                    title={document.title}
                    description={document.description}
                    accept={document.accept}
                    icon={document.icon}
                    file={selectedFile}
                    disabled={formDisabled}
                    onChange={(file) =>
                      updateFile(document.field, file)
                    }
                  />
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-28">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Resumen
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Verificación
                </h2>
              </div>

              <ShieldCheck size={25} className="text-yellow-600" />
            </div>

            <div className="mt-7 space-y-3">
              {documentConfiguration.map((document) => {
                const selected = Boolean(files[document.field]);

                return (
                  <div
                    key={document.field}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        selected
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {selected ? (
                        <Check size={17} />
                      ) : (
                        <FileText size={17} />
                      )}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">
                      {document.title}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-3xl bg-[#0B0F19] p-5 text-white">
              <div className="flex items-start gap-3">
                <LockKeyhole
                  size={20}
                  className="mt-0.5 shrink-0 text-yellow-400"
                />

                <div>
                  <p className="font-black">
                    Información protegida
                  </p>

                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    Tus documentos se guardan en el almacenamiento
                    privado de AXI para revisión administrativa.
                  </p>
                </div>
              </div>
            </div>

            {message && (
              <div
                className={cn(
                  "mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold",
                  message.toLowerCase().includes("enviada")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                )}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={formDisabled}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                  Subiendo documentos...
                </>
              ) : status === "approved" ? (
                <>
                  <CheckCircle2 size={19} />
                  Solicitud aprobada
                </>
              ) : status === "pending" ? (
                <>
                  <Clock3 size={19} />
                  En revisión
                </>
              ) : (
                <>
                  Enviar solicitud
                  <ArrowRight size={19} />
                </>
              )}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Al enviar, confirmas que la información proporcionada es
              verdadera y está vigente.
            </p>
          </Card>
        </div>
      </form>
    </section>
  );
}

function DocumentInput({
  title,
  description,
  accept,
  icon: Icon,
  file,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  accept: string;
  icon: typeof Camera;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputId = title
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("—", "-");

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "group relative flex min-h-52 cursor-pointer flex-col rounded-[1.7rem] border-2 border-dashed p-5 transition",
        file
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-slate-50 hover:border-yellow-400 hover:bg-yellow-50",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.files?.[0] ?? null)
        }
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl transition",
            file
              ? "bg-emerald-200 text-emerald-800"
              : "bg-white text-slate-700 shadow-sm group-hover:bg-yellow-400 group-hover:text-black"
          )}
        >
          {file ? (
            <FileCheck2 size={22} />
          ) : (
            <Icon size={22} />
          )}
        </span>

        {file && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200 px-3 py-1 text-xs font-black text-emerald-800">
            <Check size={13} />
            Listo
          </span>
        )}
      </div>

      <div className="mt-5">
        <p className="font-black text-slate-950">
          {title}
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <div className="mt-auto pt-5">
        {file ? (
          <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
            <p className="truncate text-xs font-black text-slate-700">
              {file.name}
            </p>

            <p className="mt-1 text-[11px] text-slate-500">
              {formatFileSize(file.size)}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-black text-slate-500 group-hover:text-slate-950">
            <UploadCloud size={16} />
            Seleccionar archivo
          </div>
        )}
      </div>
    </label>
  );
}

function CarIcon() {
  return <BadgeCheck size={15} />;
}
