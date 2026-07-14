"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TripData = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
};

type TripMessage = {
  id: string;
  trip_id: string;
  sender_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

type Attachment = {
  id: string;
  message_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
};

type TypingPresence = {
  user_id: string;
  typing: boolean;
};

const ACTIVE_CHAT_STATUSES = [
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
];

export default function TripChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const channelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [trip, setTrip] = useState<TripData | null>(null);
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [signedUrls, setSignedUrls] = useState<
    Record<string, string>
  >({});

  const [currentUserId, setCurrentUserId] = useState("");
  const [otherUserName, setOtherUserName] =
    useState("Usuario AXI");

  const [otherUserTyping, setOtherUserTyping] =
    useState(false);

  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function loadMessages() {
    const { data, error } = await supabase
      .from("trip_messages")
      .select(
        "id, trip_id, sender_id, message, read_at, created_at"
      )
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(
        `Error cargando mensajes: ${error.message}`
      );
      return;
    }

    setMessages((data ?? []) as TripMessage[]);
  }

  async function loadAttachments() {
    const { data, error } = await supabase
      .from("trip_message_attachments")
      .select(
        "id, message_id, storage_path, file_name, mime_type"
      )
      .eq("trip_id", tripId);

    if (error) {
      setMessage(
        `Error cargando imágenes: ${error.message}`
      );
      return;
    }

    const loadedAttachments =
      (data ?? []) as Attachment[];

    setAttachments(loadedAttachments);

    const urls: Record<string, string> = {};

    await Promise.all(
      loadedAttachments.map(async (attachment) => {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("trip-chat-media")
            .createSignedUrl(
              attachment.storage_path,
              3600
            );

        if (!signedError && signedData?.signedUrl) {
          urls[attachment.id] =
            signedData.signedUrl;
        }
      })
    );

    setSignedUrls(urls);
  }

  async function markReceivedAsRead(
    userId: string
  ) {
    await supabase
      .from("trip_messages")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("trip_id", tripId)
      .neq("sender_id", userId)
      .is("read_at", null);
  }

  function refreshTypingState(
    channel: ReturnType<typeof supabase.channel>,
    userId: string
  ) {
    const presenceState =
      channel.presenceState<TypingPresence>();

    const otherPresence = Object.values(
      presenceState
    )
      .flat()
      .find(
        (presence) =>
          presence.user_id !== userId
      );

    setOtherUserTyping(
      Boolean(otherPresence?.typing)
    );
  }

  async function updateTypingStatus(
    typing: boolean
  ) {
    const channel = channelRef.current;

    if (!channel || !currentUserId) {
      return;
    }

    await channel.track({
      user_id: currentUserId,
      typing,
    });
  }

  function handleTextChange(value: string) {
    setText(value);

    void updateTypingStatus(
      value.trim().length > 0
    );

    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(
        typingTimeoutRef.current
      );
    }

    typingTimeoutRef.current =
      window.setTimeout(() => {
        void updateTypingStatus(false);
      }, 1500);
  }

  function handleImageSelected(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("La imagen supera 5 MB.");
      event.target.value = "";
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setMessage(
        "Solo se permiten imágenes JPG, PNG o WEBP."
      );
      event.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImage(file);
    setPreviewUrl(
      URL.createObjectURL(file)
    );
    setMessage("");
  }

  function clearSelectedImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImage(null);
    setPreviewUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function sendSelectedImage() {
    if (
      !trip ||
      !selectedImage ||
      !currentUserId
    ) {
      return;
    }

    setSending(true);
    setMessage("");

    await updateTypingStatus(false);

    const originalExtension =
      selectedImage.name
        .split(".")
        .pop()
        ?.toLowerCase();

    const extension =
      originalExtension &&
      ["jpg", "jpeg", "png", "webp"].includes(
        originalExtension
      )
        ? originalExtension
        : "jpg";

    const generatedFileName =
      `${crypto.randomUUID()}.${extension}`;

    const storagePath =
      `${trip.id}/${currentUserId}/${generatedFileName}`;

    const { error: uploadError } =
      await supabase.storage
        .from("trip-chat-media")
        .upload(
          storagePath,
          selectedImage,
          {
            contentType: selectedImage.type,
            cacheControl: "3600",
            upsert: false,
          }
        );

    if (uploadError) {
      setSending(false);
      setMessage(
        `Error subiendo imagen: ${uploadError.message}`
      );
      return;
    }

    const { error: imageError } =
      await supabase.rpc(
        "send_trip_image",
        {
          requested_trip_id: trip.id,
          storage_path_value: storagePath,
          file_name_value:
            selectedImage.name,
          mime_type_value:
            selectedImage.type,
          file_size_value:
            selectedImage.size,
          caption_value:
            text.trim() || null,
        }
      );

    if (imageError) {
      await supabase.storage
        .from("trip-chat-media")
        .remove([storagePath]);

      setSending(false);
      setMessage(
        `Error enviando imagen: ${imageError.message}`
      );
      return;
    }

    clearSelectedImage();
    setText("");

    await loadMessages();
    await loadAttachments();

    setSending(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (selectedImage) {
      await sendSelectedImage();
      return;
    }

    const cleanText = text.trim();

    if (!trip || !cleanText) {
      return;
    }

    if (cleanText.length > 1000) {
      setMessage(
        "El mensaje no puede superar 1000 caracteres."
      );
      return;
    }

    setSending(true);
    setMessage("");

    await updateTypingStatus(false);

    const { error } = await supabase.rpc(
      "send_trip_message",
      {
        requested_trip_id: trip.id,
        message_value: cleanText,
      }
    );

    if (error) {
      setSending(false);
      setMessage(
        `Error enviando mensaje: ${error.message}`
      );
      return;
    }

    setText("");
    await loadMessages();

    setSending(false);
  }

  useEffect(() => {
    let channel:
      ReturnType<typeof supabase.channel> | null = null;

    let cancelled = false;

    const timer = window.setTimeout(
      async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || cancelled) {
          router.replace("/login");
          return;
        }

        setCurrentUserId(
          session.user.id
        );

        const {
          data: tripData,
          error: tripError,
        } = await supabase
          .from("trips")
          .select(
            "id, passenger_id, driver_id, status"
          )
          .eq("id", tripId)
          .single();

        if (
          tripError ||
          !tripData
        ) {
          setMessage(
            `No fue posible cargar el viaje: ${
              tripError?.message ??
              "Viaje no encontrado"
            }`
          );

          setLoading(false);
          return;
        }

        const isPassenger =
          tripData.passenger_id ===
          session.user.id;

        const isDriver =
          tripData.driver_id ===
          session.user.id;

        if (
          !isPassenger &&
          !isDriver
        ) {
          setMessage(
            "No tienes permiso para abrir este chat."
          );

          setLoading(false);
          return;
        }

        if (
          !ACTIVE_CHAT_STATUSES.includes(
            tripData.status
          )
        ) {
          setMessage(
            "El chat no está disponible para este viaje."
          );

          setLoading(false);
          return;
        }

        setTrip(
          tripData as TripData
        );

        const otherUserId =
          isPassenger
            ? tripData.driver_id
            : tripData.passenger_id;

        if (otherUserId) {
          const {
            data: otherProfile,
          } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", otherUserId)
            .single();

          setOtherUserName(
            otherProfile?.full_name ||
            "Usuario AXI"
          );
        }

        await loadMessages();
        await loadAttachments();

        await markReceivedAsRead(
          session.user.id
        );

        if (cancelled) {
          return;
        }

        channel = supabase.channel(
          `trip-chat-${tripId}-${crypto.randomUUID()}`,
          {
            config: {
              presence: {
                key: session.user.id,
              },
            },
          }
        );

        channel
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "trip_messages",
              filter:
                `trip_id=eq.${tripId}`,
            },
            async () => {
              await loadMessages();

              await markReceivedAsRead(
                session.user.id
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table:
                "trip_message_attachments",
              filter:
                `trip_id=eq.${tripId}`,
            },
            async () => {
              await loadAttachments();
            }
          )
          .on(
            "presence",
            {
              event: "sync",
            },
            () => {
              if (channel) {
                refreshTypingState(
                  channel,
                  session.user.id
                );
              }
            }
          )
          .on(
            "presence",
            {
              event: "join",
            },
            () => {
              if (channel) {
                refreshTypingState(
                  channel,
                  session.user.id
                );
              }
            }
          )
          .on(
            "presence",
            {
              event: "leave",
            },
            () => {
              if (channel) {
                refreshTypingState(
                  channel,
                  session.user.id
                );
              }
            }
          )
          .subscribe(
            async (status) => {
              if (
                status !==
                "SUBSCRIBED"
              ) {
                return;
              }

              if (!channel) {
                return;
              }

              await channel.track({
                user_id:
                  session.user.id,
                typing: false,
              });
            }
          );

        channelRef.current =
          channel;

        setLoading(false);
      },
      0
    );

    return () => {
      cancelled = true;

      window.clearTimeout(timer);

      if (
        typingTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          typingTimeoutRef.current
        );
      }

      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );
      }

      if (channel) {
        void channel.untrack();

        void supabase.removeChannel(
          channel
        );
      }

      channelRef.current = null;
    };
  }, [router, tripId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages,
    attachments,
    otherUserTyping,
  ]);

  function getAttachmentForMessage(
    messageId: string
  ) {
    return attachments.find(
      (attachment) =>
        attachment.message_id ===
        messageId
    );
  }

  function formatTime(
    value: string
  ) {
    return new Date(
      value
    ).toLocaleTimeString(
      "es-MX",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  if (loading) {
    return <p>Cargando chat...</p>;
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible abrir el chat."}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">
            Chat del viaje
          </p>

          <h1 className="mt-1 text-2xl font-bold">
            {otherUserName}
          </h1>

          {otherUserTyping && (
            <p className="mt-1 text-sm text-green-600">
              Escribiendo...
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(`/dashboard/trips/${trip.id}`)
          }
          className="rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
        >
          Volver al viaje
        </button>
      </div>

      <div className="flex h-[650px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="font-semibold text-gray-700">
                  Todavía no hay mensajes
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Escribe el primero para coordinar el viaje.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((chatMessage) => {
                const isMine =
                  chatMessage.sender_id === currentUserId;

                const attachment =
                  getAttachmentForMessage(chatMessage.id);

                const imageUrl = attachment
                  ? signedUrls[attachment.id]
                  : null;

                const onlyImage =
                  attachment &&
                  chatMessage.message === "Imagen";

                return (
                  <div
                    key={chatMessage.id}
                    className={`flex ${
                      isMine
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[78%] overflow-hidden rounded-2xl ${
                        isMine
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {attachment && imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              imageUrl,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="block w-full"
                          aria-label={`Abrir ${attachment.file_name}`}
                        >
                          <img
                            src={imageUrl}
                            alt={attachment.file_name}
                            className="max-h-80 w-full object-cover"
                          />
                        </button>
                      )}

                      <div className="px-4 py-3">
                        {!onlyImage && (
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {chatMessage.message}
                          </p>
                        )}

                        <div
                          className={`mt-2 flex items-center gap-2 text-xs ${
                            isMine
                              ? "text-gray-300"
                              : "text-gray-500"
                          }`}
                        >
                          <span>
                            {formatTime(chatMessage.created_at)}
                          </span>

                          {isMine && (
                            <span>
                              {chatMessage.read_at
                                ? "Leído"
                                : "Enviado"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {otherUserTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500">
                    Escribiendo...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {previewUrl && selectedImage && (
          <div className="border-t bg-gray-50 p-4">
            <div className="flex items-start gap-4 rounded-xl bg-white p-3">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="h-24 w-24 rounded-xl object-cover"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {selectedImage.name}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                </p>

                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="mt-3 text-sm font-semibold text-red-600"
                >
                  Quitar imagen
                </button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="border-t bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t p-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleImageSelected}
            className="hidden"
          />

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={sending}
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border text-xl hover:bg-gray-50 disabled:opacity-50"
              aria-label="Adjuntar imagen"
            >
              +
            </button>

            <textarea
              value={text}
              onChange={(event) =>
                handleTextChange(event.target.value)
              }
              maxLength={1000}
              rows={2}
              placeholder={
                selectedImage
                  ? "Agrega un comentario opcional..."
                  : "Escribe un mensaje..."
              }
              className="min-h-12 flex-1 resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
            />

            <button
              type="submit"
              disabled={
                sending ||
                (!text.trim() && !selectedImage)
              }
              className="h-12 rounded-xl bg-black px-6 font-semibold text-white disabled:opacity-50"
            >
              {sending
                ? "Enviando..."
                : selectedImage
                  ? "Enviar foto"
                  : "Enviar"}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
            <span>
              JPG, PNG o WEBP. Máximo 5 MB.
            </span>

            <span>
              {text.length}/1000
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
