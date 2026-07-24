"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Home,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Star,
  Trash2,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { isPassenger } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

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

const EMPTY_STATS: PassengerStats = {
  completed_trips: 0,
  cancelled_trips: 0,
  trips_this_month: 0,
  total_spent: 0,
  spent_this_month: 0,
  average_rating: 0,
  rating_count: 0,
};

const placeTypeLabels: Record<PlaceType, string> = {
  home: "Casa",
  work: "Trabajo",
  favorite: "Favorito",
};

const placeTypeIcons: Record<PlaceType, LucideIcon> = {
  home: Home,
  work: BriefcaseBusiness,
  favorite: Star,
};

export default function PassengerProfilePage() {
  const router = useRouter();

  const [stats, setStats] =
    useState<PassengerStats>(EMPTY_STATS);

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

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  const loadPassengerProfile = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const [
        profileResult,
        statsResult,
        placesResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, role, avatar_url")
          .eq("id", session.user.id)
          .single(),

        supabase.rpc(
          "get_passenger_dashboard_stats"
        ),

        supabase
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
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (
        profileResult.error ||
        !profileResult.data ||
        !isPassenger(profileResult.data.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      setProfile({
        full_name:
          profileResult.data.full_name,
        phone:
          profileResult.data.phone,
      });

      if (statsResult.error) {
        setMessage(
          `Error cargando estadísticas: ${statsResult.error.message}`
        );
      } else {
        const resolvedStats =
          Array.isArray(statsResult.data)
            ? statsResult.data[0]
            : statsResult.data;

        setStats({
          ...EMPTY_STATS,
          ...(resolvedStats as
            | Partial<PassengerStats>
            | null),
        });
      }

      if (placesResult.error) {
        setMessage(
          `Error cargando lugares: ${placesResult.error.message}`
        );
      } else {
        setPlaces(
          (placesResult.data ?? []) as SavedPlace[]
        );
      }

      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPassengerProfile();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [loadPassengerProfile]);

  async function handleSavePlace(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanLabel = label.trim();
    const cleanAddress = address.trim();

    if (cleanLabel.length < 2) {
      setMessage(
        "La etiqueta debe tener al menos 2 caracteres."
      );
      return;
    }

    if (cleanAddress.length < 5) {
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
            cleanLabel,
          address_value:
            cleanAddress,
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

    await loadPassengerProfile(true);
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

      setMessage(
        "Lugar eliminado correctamente."
      );
    }

    setDeletingId(null);
  }

  function formatMoney(
    value: number
  ) {
    return new Intl.NumberFormat(
      "es-MX",
      {
        style: "currency",
        currency: "MXN",
      }
    ).format(Number(value ?? 0));
  }

  const successRate = useMemo(() => {
    const total =
      Number(stats.completed_trips) +
      Number(stats.cancelled_trips);

    if (total === 0) {
      return 100;
    }

    return Math.round(
      (Number(stats.completed_trips) /
        total) *
        100
    );
  }, [
    stats.cancelled_trips,
    stats.completed_trips,
  ]);

  const formProgress = useMemo(() => {
    const fields = [
      placeType,
      label.trim(),
      address.trim(),
    ];

    const completed =
      fields.filter(Boolean).length;

    return Math.round(
      (completed / fields.length) * 100
    );
  }, [address, label, placeType]);

  const primaryPlace =
    places.find(
      (place) => place.type === "home"
    ) ??
    places.find(
      (place) => place.type === "work"
    ) ??
    places[0] ??
    null;

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="h-[620px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[620px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="flex min-h-[65vh] items-center justify-center">
        <Card className="max-w-lg text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-red-100 text-red-700">
            <XCircle size={34} />
          </span>

          <h1 className="mt-6 text-3xl font-black">
            Perfil no disponible
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            {message ||
              "No fue posible cargar tu perfil de pasajero."}
          </p>

          <Link
            href="/dashboard"
            className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            Volver al inicio
            <ArrowRight size={18} />
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
            <Sparkles size={15} />
            Configuración
          </span>

          <h1 className="mt-6 whitespace-nowrap text-[1.45rem] font-black leading-tight tracking-tight sm:text-5xl">
            Administra tu cuenta
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Controla la seguridad de tu cuenta, tus métodos de pago y
            las herramientas disponibles para tus viajes.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
<Link
              href="/dashboard/payments"
              className="group rounded-[1.7rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-yellow-400/40 hover:bg-white/10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950">
                <WalletCards size={23} />
              </span>

              <h2 className="mt-5 text-xl font-black">
                Métodos de pago
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Administra las opciones que utilizas para pagar.
              </p>

              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-yellow-300">
                Administrar
                <ArrowRight
                  size={17}
                  className="transition group-hover:translate-x-1"
                />
              </span>
            </Link>

            <Link
              href="/dashboard/passenger/history"
              className="group rounded-[1.7rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-yellow-400/40 hover:bg-white/10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
                <Navigation size={23} />
              </span>

              <h2 className="mt-5 text-xl font-black">
                Herramientas del pasajero
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Viajes, pagos pendientes, historial y calificaciones.
              </p>

              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-yellow-300">
                Ver herramientas
                <ArrowRight
                  size={17}
                  className="transition group-hover:translate-x-1"
                />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message
              .toLowerCase()
              .includes("correctamente") ||
              message
                .toLowerCase()
                .includes("eliminado")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="h-fit xl:sticky xl:top-28">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Nueva dirección
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Guardar lugar
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Agrega una dirección frecuente para solicitar
                viajes más rápido.
              </p>
            </div>

            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-800">
              <Plus size={23} />
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-black text-slate-500">
              <span>Progreso</span>
              <span>{formProgress}%</span>
            </div>

            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                style={{
                  width: `${formProgress}%`,
                }}
              />
            </div>
          </div>

          <form
            onSubmit={handleSavePlace}
            className="mt-7 space-y-5"
          >
            <div>
              <p className="mb-3 text-sm font-black text-slate-700">
                Tipo de lugar
              </p>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    "home",
                    "work",
                    "favorite",
                  ] as PlaceType[]
                ).map((type) => {
                  const Icon =
                    placeTypeIcons[type];

                  const selected =
                    placeType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setPlaceType(type)
                      }
                      className={cn(
                        "flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center text-xs font-black transition",
                        selected
                          ? "border-yellow-400 bg-yellow-50 text-slate-950 ring-2 ring-yellow-400/20"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                      )}
                    >
                      <Icon size={21} />
                      {placeTypeLabels[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <ProfileInput
              label="Nombre del lugar"
              value={label}
              placeholder="Ejemplo: Casa de mis papás"
              icon={Bookmark}
              maxLength={80}
              onChange={setLabel}
            />

            <div>
              <label
                htmlFor="savedAddress"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Dirección completa
              </label>

              <div className="relative">
                <MapPin
                  size={18}
                  className="absolute left-4 top-4 text-slate-400"
                />

                <textarea
                  id="savedAddress"
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value
                    )
                  }
                  rows={5}
                  maxLength={300}
                  placeholder="Calle, número, colonia, ciudad..."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                />
              </div>

              <p className="mt-2 text-right text-xs text-slate-400">
                {address.length}/300
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <MapPin
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-700"
                />

                <p className="text-xs leading-6 text-blue-800">
                  Podrás utilizar este lugar como origen o destino
                  al solicitar futuros viajes.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus size={19} />
                  Guardar lugar
                </>
              )}
            </button>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Direcciones frecuentes
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Mis lugares guardados
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Usa estas direcciones para ahorrar tiempo al
              solicitar un viaje.
            </p>
          </div>

          {places.length === 0 ? (
            <div className="relative flex min-h-[580px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

              <div className="relative max-w-md text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                  <MapPin size={35} />
                </span>

                <h3 className="mt-7 text-3xl font-black">
                  Todavía no tienes lugares
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-500">
                  Guarda casa, trabajo u otra dirección frecuente
                  para preparar tus viajes más rápido.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 p-5 sm:p-7">
              {places.map((place) => (
                <SavedPlaceCard
                  key={place.id}
                  place={place}
                  deleting={
                    deletingId === place.id
                  }
                  onDelete={() =>
                    deletePlace(place.id)
                  }
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function SavedPlaceCard({
  place,
  deleting,
  onDelete,
}: {
  place: SavedPlace;
  deleting: boolean;
  onDelete: () => void;
}) {
  const Icon =
    placeTypeIcons[place.type];

  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className={cn(
          "h-1.5",
          place.type === "home" &&
            "bg-emerald-500",
          place.type === "work" &&
            "bg-blue-500",
          place.type === "favorite" &&
            "bg-yellow-400"
        )}
      />

      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem]",
            place.type === "home" &&
              "bg-emerald-100 text-emerald-700",
            place.type === "work" &&
              "bg-blue-100 text-blue-700",
            place.type === "favorite" &&
              "bg-yellow-100 text-yellow-700"
          )}
        >
          <Icon size={27} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-slate-950">
              {place.label}
            </h3>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {placeTypeLabels[place.type]}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {place.address}
          </p>

          {place.latitude !== null &&
            place.longitude !== null && (
              <p className="mt-2 text-xs font-semibold text-emerald-600">
                Ubicación exacta registrada
              </p>
            )}
        </div>

        <div className="flex gap-3 sm:flex-col">
          <Link
            href={`/dashboard/trips/new?destination=${encodeURIComponent(
              place.address
            )}`}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
          >
            <Navigation size={16} />
            Usar
          </Link>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
          >
            {deleting ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <Trash2 size={16} />
            )}

            {deleting
              ? "Eliminando"
              : "Eliminar"}
          </button>
        </div>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-2 text-xs font-semibold text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-110",
            iconClass
          )}
        >
          <Icon size={23} />
        </span>
      </div>
    </Card>
  );
}

function MetricBlock({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <Icon
        size={21}
        className={iconClass}
      />

      <p className="mt-5 text-3xl font-black text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-slate-500">
        {label}
      </p>
    </div>
  );
}

function ProfileInput({
  label,
  value,
  placeholder,
  icon: Icon,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: LucideIcon;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Icon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="text"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          maxLength={maxLength}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
        />
      </div>
    </div>
  );
}


