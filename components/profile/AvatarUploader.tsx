"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  ImagePlus,
  LoaderCircle,
  Trash2,
  UserRound,
  X,
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
  const menuRef = useRef<HTMLDivElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    currentAvatarUrl ?? null
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentAvatarUrl ?? null
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const busy = uploading || removing;

  useEffect(() => {
    setAvatarUrl(currentAvatarUrl ?? null);
    setPreviewUrl(currentAvatarUrl ?? null);
  }, [currentAvatarUrl]);

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [message]);

  function openFilePicker() {
    if (busy) return;

    setMenuOpen(false);
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
        text: "Foto actualizada.",
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

    setMenuOpen(false);

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
    <div
      ref={menuRef}
      className="relative h-32 w-32 shrink-0"
    >
      <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white/15 bg-slate-800 shadow-2xl ring-1 ring-white/10">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Foto de perfil"
            className="h-full w-full object-cover"
          />
        ) : fullName ? (
          <span className="text-3xl font-black text-white">
            {getInitials(fullName)}
          </span>
        ) : (
          <UserRound className="h-12 w-12 text-slate-400" />
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65">
            <LoaderCircle className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={captureCamera ? "user" : undefined}
        onChange={uploadAvatar}
        disabled={busy}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        disabled={busy}
        aria-label="Opciones de fotografía"
        aria-expanded={menuOpen}
        className="absolute right-0 top-0 z-20 flex h-10 w-10 -translate-y-1 translate-x-1 items-center justify-center rounded-full border-4 border-[#0B0F19] bg-yellow-400 text-slate-950 shadow-lg transition hover:scale-105 hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {menuOpen ? (
          <X className="h-4 w-4" strokeWidth={3} />
        ) : (
          <Camera className="h-5 w-5" strokeWidth={2.5} />
        )}
      </button>

      {menuOpen && (
        <div className="absolute left-1/2 top-12 z-40 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-950 shadow-2xl sm:left-full sm:ml-3 sm:translate-x-0">
          <button
            type="button"
            onClick={openFilePicker}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition hover:bg-slate-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
              <ImagePlus className="h-5 w-5" />
            </span>

            Elegir de biblioteca
          </button>

          {avatarUrl && (
            <button
              type="button"
              onClick={removeAvatar}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <Trash2 className="h-5 w-5" />
              </span>

              Eliminar fotografía
            </button>
          )}
        </div>
      )}

      {message && (
        <div
          className={`absolute left-1/2 top-full z-50 mt-4 w-max max-w-[260px] -translate-x-1/2 rounded-xl px-4 py-2.5 text-center text-xs font-bold shadow-xl ${
            message.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
