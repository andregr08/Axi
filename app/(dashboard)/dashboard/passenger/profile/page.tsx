"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PlaceType =
  | "home"
  | "work"
  | "favorite";

type PassengerStats = {
  completed_trips: number;
  cancelled_trips: number;
  trips_this_month: number;
  total_spent: number;
  spent_this_month: number;
  average_rating: number;
  rating_count: number;
};

type PassengerProfile = {
  full_name: string | null;
  phone: string | null;
};

type SavedPlace = {
  id: string;
  type: PlaceType;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

const placeTypeLabels: Record<
  PlaceType,
  string
> = {
  home: "Casa",
  work: "Trabajo",
  favorite: "Favorito",
};

export default function PassengerProfilePage() {
  const router = useRouter();

  const [stats, setStats] =
    useState<PassengerStats | null>(null);

  const [profile, setProfile] =
    useState<PassengerProfile | null>(null);

  const [places, setPlaces] =
    useState<SavedPlace[]>([]);

  const [placeType, setPlaceType] =
    useState<PlaceType>("favorite");

  const [label, setLabel] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  async function loadPassengerProfile() {
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
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "full_name, phone, role"
      )
      .eq("id", session.user.id)
      .single();

    if (
      profileError ||
      !profileData ||
      profileData.role !== "passenger"
    ) {
      router.replace("/dashboard");
      return;
    }

    setProfile({
      full_name:
        profileData.full_name,
      phone:
        profileData.phone,
    });

    const {
      data: statsData,
      error: statsError,
    } = await supabase.rpc(
      "get_passenger_dashboard_stats"
    );

    if (statsError) {
      setMessage(
        `Error cargando estadísticas: ${statsError.message}`
      );
      setLoading(false);
      return;
    }

    const statsResult =
      Array.isArray(statsData)
        ? statsData[0]
        : statsData;

    setStats(
      statsResult as PassengerStats
    );

    const {
      data: placesData,
      error: placesError,
    } = await supabase
      .from("saved_places")
      .select(`
        id,
        type,
        label,
        address,
        latitude,
        longitude,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (placesError) {
      setMessage(
        `Error cargando lugares: ${placesError.message}`
      );
    } else {
      setPlaces(
        (placesData ?? []) as SavedPlace[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadPassengerProfile();
      }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  async function handleSavePlace(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      label.trim().length < 2
    ) {
      setMessage(
        "La etiqueta debe tener al menos 2 caracteres."
      );
      return;
    }

    if (
      address.trim().length < 5
    ) {
      setMessage(
        "La dirección debe tener al menos 5 caracteres."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } =
      await supabase.rpc(
        "save_passenger_place",
        {
          place_type_value:
            placeType,
          label_value:
            label.trim(),
          address_value:
            address.trim(),
          latitude_value:
            null,
          longitude_value:
            null,
        }
      );

    setSaving(false);

    if (error) {
      setMessage(
        `Error guardando lugar: ${error.message}`
      );
      return;
    }

    setPlaceType("favorite");
    setLabel("");
    setAddress("");

    setMessage(
      "Lugar guardado correctamente."
    );

    await loadPassengerProfile();
  }

  async function deletePlace(
    placeId: string
  ) {
    const confirmed =
      window.confirm(
        "¿Seguro que quieres eliminar este lugar?"
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(placeId);
    setMessage("");

    const { error } =
      await supabase
        .from("saved_places")
        .delete()
        .eq("id", placeId);

    if (error) {
      setMessage(
        `Error eliminando lugar: ${error.message}`
      );
    } else {
      setPlaces((current) =>
        current.filter(
          (place) =>
            place.id !== placeId
        )
      );
    }

    setDeletingId(null);
  }

  function formatMoney(
    value: number
  ) {
    return `$${Number(
      value ?? 0
    ).toFixed(2)} MXN`;
  }

  if (loading) {
    return (
      <p>
        Cargando perfil del pasajero...
      </p>
    );
  }

  if (!stats || !profile) {
    return (
      <section>
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message ||
            "No fue posible cargar el perfil."}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Cuenta de pasajero
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          {profile.full_name ||
            "Pasajero AXI"}
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta tus viajes, gastos y lugares guardados.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-sm">
          {message}
        </div>
      )}

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">
            Gasto del mes
          </p>

          <p className="mt-3 text-3xl font-bold">
            {formatMoney(
              stats.spent_this_month
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Gasto total
          </p>

          <p className="mt-3 text-3xl font-bold">
            {formatMoney(
              stats.total_spent
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes este mes
          </p>

          <p className="mt-3 text-3xl font-bold">
            {stats.trips_this_month}
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes completados
          </p>

          <p className="mt-3 text-3xl font-bold">
            {stats.completed_trips}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes cancelados
          </p>

          <p className="mt-3 text-3xl font-bold">
            {stats.cancelled_trips}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Calificación
          </p>

          <div className="mt-3 flex items-center gap-2">
            <p className="text-3xl font-bold">
              {Number(
                stats.average_rating
              ).toFixed(2)}
            </p>

            <span className="text-2xl text-yellow-400">
              ★
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Reseñas recibidas
          </p>

          <p className="mt-3 text-3xl font-bold">
            {stats.rating_count}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[400px_1fr]">
        <form
          onSubmit={handleSavePlace}
          className="h-fit space-y-5 rounded-2xl bg-white p-7 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-bold">
              Guardar lugar
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Agrega casa, trabajo o una dirección frecuente.
            </p>
          </div>

          <div>
            <label
              htmlFor="placeType"
              className="mb-2 block text-sm font-semibold"
            >
              Tipo
            </label>

            <select
              id="placeType"
              value={placeType}
              onChange={(event) =>
                setPlaceType(
                  event.target.value as PlaceType
                )
              }
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="home">
                Casa
              </option>

              <option value="work">
                Trabajo
              </option>

              <option value="favorite">
                Favorito
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="label"
              className="mb-2 block text-sm font-semibold"
            >
              Nombre
            </label>

            <input
              id="label"
              value={label}
              onChange={(event) =>
                setLabel(
                  event.target.value
                )
              }
              maxLength={80}
              placeholder="Ejemplo: Casa de mis papás"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="mb-2 block text-sm font-semibold"
            >
              Dirección
            </label>

            <textarea
              id="address"
              value={address}
              onChange={(event) =>
                setAddress(
                  event.target.value
                )
              }
              rows={4}
              maxLength={300}
              placeholder="Escribe la dirección completa..."
              className="w-full resize-none rounded-xl border px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : "Guardar lugar"}
          </button>
        </form>

        <div>
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Mis lugares
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Usa estas direcciones al solicitar un viaje.
            </p>
          </div>

          {places.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="font-semibold text-gray-700">
                Todavía no tienes lugares guardados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {places.map((place) => (
                <article
                  key={place.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                        {
                          placeTypeLabels[
                            place.type
                          ]
                        }
                      </span>

                      <h3 className="mt-3 text-lg font-bold">
                        {place.label}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {place.address}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        deletePlace(
                          place.id
                        )
                      }
                      disabled={
                        deletingId ===
                        place.id
                      }
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      {deletingId ===
                      place.id
                        ? "Eliminando..."
                        : "Eliminar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
