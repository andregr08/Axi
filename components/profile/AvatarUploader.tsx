"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import {
  Camera,
  ImagePlus,
  LoaderCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AvatarUploaderProps = {
  userId: string;
  fullName?: string | null;
  currentAvatarUrl?: string | null;
  required?: boolean;
  captureCamera?: boolean;
  onUploaded?: (avatarUrl: string | null) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getInitials(name?: string | null) {
  if (!name?.trim()) return "AX";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getExtension(file: File) {
  const extensionFromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  if (
    extensionFromName === "jpg" ||
    extensionFromName === "jpeg" ||
    extensionFromName === "png" ||
    extensionFromName === "webp"
  ) {
    return extensionFromName === "jpeg"
      ? "jpg"
      : extensionFromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

function getStoragePathFromUrl(url?: string | null) {
  if (!url) return null;

  const marker = "/storage/v1/object/public/avatars/";
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) return null;

  const path = url.slice(markerIndex + marker.length);

  return decodeURIComponent(path.split("?")[0]);
}

export default function AvatarUploader({
  userId,
  fullName,
  currentAvatarUrl,
  required = false,
  captureCamera = false,
  onUploaded,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    currentAvatarUrl ?? null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentAvatarUrl ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const busy = uploading || removing;

  function openFilePicker() {
    if (busy) return;

    inputRef.current?.click();
  }

  async function uploadAvatar(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setMessage(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({
        type: "error",
        text: "Selecciona una imagen JPG, PNG o WebP.",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessage({
        type: "error",
        text: "La imagen no puede pesar más de 5 MB.",
      });
      return;
    }

    const temporaryPreview = URL.createObjectURL(file);
    setPreviewUrl(temporaryPreview);
    setUploading(true);

    const previousStoragePath =
      getStoragePathFromUrl(avatarUrl);

    try {
      const extension = getExtension(file);
      const filePath =
        `${userId}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: newAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) {
        await supabase.storage
          .from("avatars")
          .remove([filePath]);

        throw profileError;
      }

      if (
        previousStoragePath &&
        previousStoragePath !== filePath
      ) {
        await supabase.storage
          .from("avatars")
          .remove([previousStoragePath]);
      }

      setAvatarUrl(newAvatarUrl);
      setPreviewUrl(newAvatarUrl);
      onUploaded?.(newAvatarUrl);

      setMessage({
        type: "success",
        text: "Foto de perfil actualizada.",
      });
    } catch (error) {
      console.error("Error subiendo foto:", error);

      setPreviewUrl(avatarUrl);

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo subir la fotografía.",
      });
    } finally {
      URL.revokeObjectURL(temporaryPreview);
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (!avatarUrl || busy) return;

    const confirmed = window.confirm(
      required
        ? "Esta fotografía es obligatoria. ¿Seguro que deseas eliminarla?"
        : "¿Seguro que deseas eliminar tu foto de perfil?"
    );

    if (!confirmed) return;

    setRemoving(true);
    setMessage(null);

    try {
      const storagePath =
        getStoragePathFromUrl(avatarUrl);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      if (storagePath) {
        const { error: storageError } =
          await supabase.storage
            .from("avatars")
            .remove([storagePath]);

        if (storageError) {
          console.warn(
            "La referencia se eliminó, pero el archivo no:",
            storageError
          );
        }
      }

      setAvatarUrl(null);
      setPreviewUrl(null);
      onUploaded?.(null);

      setMessage({
        type: "success",
        text: "Foto eliminada.",
      });
    } catch (error) {
      console.error("Error eliminando foto:", error);

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la fotografía.",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            className="group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg ring-1 ring-slate-200 transition hover:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Cambiar foto de perfil"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : fullName ? (
              <span className="text-3xl font-bold text-slate-600">
                {getInitials(fullName)}
              </span>
            ) : (
              <UserRound className="h-12 w-12 text-slate-400" />
            )}

            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
              <Camera className="h-8 w-8 text-white" />
            </span>

            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/75">
                <LoaderCircle className="h-9 w-9 animate-spin text-slate-900" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Seleccionar fotografía"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="text-lg font-semibold text-slate-950">
              Foto de perfil
            </h2>

            {required && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                Obligatoria
              </span>
            )}
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Usa una fotografía clara donde se pueda reconocer tu
            rostro. Formatos JPG, PNG o WebP, máximo 5 MB.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture={captureCamera ? "user" : undefined}
            onChange={uploadAvatar}
            className="hidden"
          />

          <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}

              {avatarUrl
                ? "Cambiar fotografía"
                : "Agregar fotografía"}
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}

                Eliminar
              </button>
            )}
          </div>

          {message && (
            <p
              className={`mt-3 text-sm font-medium ${
                message.type === "success"
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {message.text}
            </p>
          )}

          {required && !avatarUrl && (
            <p className="mt-3 text-sm font-medium text-amber-700">
              Debes agregar una fotografía antes de poder
              recibir viajes.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
