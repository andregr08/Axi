"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  is_primary: boolean;
  created_at: string;
};

type ActiveTrip = {
  id: string;
  origin_address: string;
  destination_address: string;
  status: string;
};

export default function SecurityPage() {
  const router = useRouter();

  const [contacts, setContacts] =
    useState<EmergencyContact[]>([]);

  const [activeTrips, setActiveTrips] =
    useState<ActiveTrip[]>([]);

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [relationship, setRelationship] =
    useState("");

  const [isPrimary, setIsPrimary] =
    useState(false);

  const [selectedTripId, setSelectedTripId] =
    useState("");

  const [sosMessage, setSosMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [savingContact, setSavingContact] =
    useState(false);

  const [activatingSos, setActivatingSos] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  async function loadSecurityData() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const {
      data: contactsData,
      error: contactsError,
    } = await supabase
      .from("emergency_contacts")
      .select(`
        id,
        name,
        phone,
        relationship,
        is_primary,
        created_at
      `)
      .order("is_primary", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (contactsError) {
      setMessage(
        `Error cargando contactos: ${contactsError.message}`
      );
    } else {
      setContacts(
        (contactsData ?? []) as EmergencyContact[]
      );
    }

    const {
      data: tripsData,
      error: tripsError,
    } = await supabase
      .from("trips")
      .select(`
        id,
        origin_address,
        destination_address,
        status
      `)
      .in("status", [
        "accepted",
        "driver_arriving",
        "driver_arrived",
        "in_progress",
      ])
      .order("requested_at", {
        ascending: false,
      });

    if (tripsError) {
      setMessage(
        `Error cargando viajes activos: ${tripsError.message}`
      );
    } else {
      setActiveTrips(
        (tripsData ?? []) as ActiveTrip[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSecurityData();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  async function handleSaveContact(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setMessage(
        "El nombre debe tener al menos 2 caracteres."
      );
      return;
    }

    if (phone.trim().length < 8) {
      setMessage(
        "Escribe un teléfono válido."
      );
      return;
    }

    setSavingContact(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSavingContact(false);
      router.replace("/login");
      return;
    }

    if (isPrimary) {
      await supabase
        .from("emergency_contacts")
        .update({
          is_primary: false,
        })
        .eq("user_id", session.user.id);
    }

    const { error } = await supabase
      .from("emergency_contacts")
      .insert({
        user_id: session.user.id,
        name: name.trim(),
        phone: phone.trim(),
        relationship:
          relationship.trim() || null,
        is_primary: isPrimary,
      });

    setSavingContact(false);

    if (error) {
      setMessage(
        `Error guardando contacto: ${error.message}`
      );
      return;
    }

    setName("");
    setPhone("");
    setRelationship("");
    setIsPrimary(false);

    setMessage(
      "Contacto guardado correctamente."
    );

    await loadSecurityData();
  }

  async function deleteContact(
    contactId: string
  ) {
    const confirmed = window.confirm(
      "¿Eliminar este contacto de emergencia?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(contactId);
    setMessage("");

    const { error } = await supabase
      .from("emergency_contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      setMessage(
        `Error eliminando contacto: ${error.message}`
      );
    } else {
      setContacts((current) =>
        current.filter(
          (contact) =>
            contact.id !== contactId
        )
      );
    }

    setDeletingId(null);
  }

  async function activateSosWithLocation(
    latitude: number | null,
    longitude: number | null
  ) {
    const { error } = await supabase.rpc(
      "activate_sos",
      {
        related_trip_id:
          selectedTripId || null,
        latitude_value:
          latitude,
        longitude_value:
          longitude,
        message_value:
          sosMessage.trim() || null,
      }
    );

    setActivatingSos(false);

    if (error) {
      setMessage(
        `No fue posible activar SOS: ${error.message}`
      );
      return;
    }

    setSosMessage("");

    setMessage(
      "Alerta SOS activada correctamente. El equipo de AXI podrá verla."
    );
  }

  async function handleActivateSos() {
    const confirmed = window.confirm(
      "¿Confirmas que deseas activar una alerta SOS?"
    );

    if (!confirmed) {
      return;
    }

    setActivatingSos(true);
    setMessage("");

    if (!navigator.geolocation) {
      await activateSosWithLocation(
        null,
        null
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void activateSosWithLocation(
          position.coords.latitude,
          position.coords.longitude
        );
      },
      () => {
        void activateSosWithLocation(
          null,
          null
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  if (loading) {
    return <p>Cargando seguridad...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Protección AXI
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Seguridad
        </h1>

        <p className="mt-2 text-gray-600">
          Administra tus contactos de emergencia y activa una alerta SOS.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl p-4 text-sm ${
            message.includes("correctamente") ||
            message.includes("activada")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={handleSaveContact}
          className="h-fit space-y-5 rounded-2xl bg-white p-7 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-bold">
              Nuevo contacto
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Agrega a alguien de confianza para emergencias.
            </p>
          </div>

          <div>
            <label
              htmlFor="contactName"
              className="mb-2 block text-sm font-semibold"
            >
              Nombre
            </label>

            <input
              id="contactName"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={100}
              placeholder="Ejemplo: Mamá"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="contactPhone"
              className="mb-2 block text-sm font-semibold"
            >
              Teléfono
            </label>

            <input
              id="contactPhone"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              maxLength={25}
              placeholder="Ejemplo: 2221234567"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="relationship"
              className="mb-2 block text-sm font-semibold"
            >
              Relación
            </label>

            <input
              id="relationship"
              value={relationship}
              onChange={(event) =>
                setRelationship(event.target.value)
              }
              maxLength={80}
              placeholder="Ejemplo: Madre, amigo, pareja"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) =>
                setIsPrimary(event.target.checked)
              }
              className="h-4 w-4"
            />

            <span className="text-sm font-semibold">
              Marcar como contacto principal
            </span>
          </label>

          <button
            type="submit"
            disabled={savingContact}
            className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {savingContact
              ? "Guardando..."
              : "Guardar contacto"}
          </button>
        </form>

        <div className="space-y-8">
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold">
                Contactos de emergencia
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Mantén estos datos actualizados.
              </p>
            </div>

            {contacts.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                <p className="font-semibold text-gray-700">
                  Todavía no tienes contactos registrados.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <article
                    key={contact.id}
                    className="rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold">
                            {contact.name}
                          </h3>

                          {contact.is_primary && (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                              Principal
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-gray-600">
                          {contact.phone}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {contact.relationship ||
                            "Relación no especificada"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteContact(contact.id)
                        }
                        disabled={
                          deletingId === contact.id
                        }
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                      >
                        {deletingId === contact.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-7">
            <p className="text-sm font-semibold text-red-600">
              Emergencia
            </p>

            <h2 className="mt-2 text-2xl font-bold text-red-800">
              Activar alerta SOS
            </h2>

            <p className="mt-2 text-sm text-red-700">
              Usa esta opción solamente cuando exista una situación real de riesgo.
            </p>

            <div className="mt-6">
              <label
                htmlFor="activeTrip"
                className="mb-2 block text-sm font-semibold text-red-800"
              >
                Viaje relacionado
              </label>

              <select
                id="activeTrip"
                value={selectedTripId}
                onChange={(event) =>
                  setSelectedTripId(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 outline-none"
              >
                <option value="">
                  Sin viaje relacionado
                </option>

                {activeTrips.map((trip) => (
                  <option
                    key={trip.id}
                    value={trip.id}
                  >
                    {trip.origin_address} →{" "}
                    {trip.destination_address}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              <label
                htmlFor="sosMessage"
                className="mb-2 block text-sm font-semibold text-red-800"
              >
                Mensaje opcional
              </label>

              <textarea
                id="sosMessage"
                value={sosMessage}
                onChange={(event) =>
                  setSosMessage(
                    event.target.value
                  )
                }
                rows={4}
                maxLength={500}
                placeholder="Describe brevemente la emergencia..."
                className="w-full resize-none rounded-xl border border-red-200 bg-white px-4 py-3 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleActivateSos}
              disabled={activatingSos}
              className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-bold text-white disabled:opacity-50"
            >
              {activatingSos
                ? "Activando SOS..."
                : "ACTIVAR SOS"}
            </button>

            <p className="mt-3 text-center text-xs text-red-600">
              AXI intentará incluir tu ubicación actual.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
