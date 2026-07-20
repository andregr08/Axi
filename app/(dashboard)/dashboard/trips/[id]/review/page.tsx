"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

type Trip = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
};

type ExperienceCategory =
  | "Puntualidad"
  | "Trato amable"
  | "Manejo seguro"
  | "Vehículo limpio"
  | "Buena comunicación"
  | "Me sentí seguro";

const EXPERIENCE_CATEGORIES: Array<{
  value: ExperienceCategory;
  icon: typeof Clock3;
}> = [
  {
    value: "Puntualidad",
    icon: Clock3,
  },
  {
    value: "Trato amable",
    icon: UserRound,
  },
  {
    value: "Manejo seguro",
    icon: CarFront,
  },
  {
    value: "Vehículo limpio",
    icon: Sparkles,
  },
  {
    value: "Buena comunicación",
    icon: MessageSquareText,
  },
  {
    value: "Me sentí seguro",
    icon: ShieldCheck,
  },
];

const ratingMessages: Record<number, string> = {
  1: "Muy mala experiencia",
  2: "Podría mejorar mucho",
  3: "Experiencia regular",
  4: "Muy buena experiencia",
  5: "Experiencia excelente",
};

export default function TripReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] =
    useState<Trip | null>(null);

  const [reviewedName, setReviewedName] =
    useState("");

  const [rating, setRating] =
    useState(5);

  const [comment, setComment] =
    useState("");

  const [categories, setCategories] =
    useState<ExperienceCategory[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [alreadyReviewed, setAlreadyReviewed] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadReviewData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

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

    if (tripError || !tripData) {
      setMessage(
        `No fue posible cargar el viaje: ${
          tripError?.message ??
          "Viaje no encontrado"
        }`
      );
      setLoading(false);
      return;
    }

    if (tripData.status !== "completed") {
      setMessage(
        "Solo puedes calificar un viaje completado."
      );
      setLoading(false);
      return;
    }

    const isPassenger =
      session.user.id ===
      tripData.passenger_id;

    const isDriver =
      session.user.id ===
      tripData.driver_id;

    if (!isPassenger && !isDriver) {
      setMessage(
        "No tienes permiso para calificar este viaje."
      );
      setLoading(false);
      return;
    }

    const reviewedUserId =
      isPassenger
        ? tripData.driver_id
        : tripData.passenger_id;

    if (!reviewedUserId) {
      setMessage(
        "No existe un usuario para calificar."
      );
      setLoading(false);
      return;
    }

    setTrip(tripData as Trip);

    const { data: reviewedProfile } =
      await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", reviewedUserId)
        .single();

    setReviewedName(
      reviewedProfile?.full_name ||
      "Usuario de AXI"
    );

    const {
      data: existingReview,
      error: reviewError,
    } = await supabase
      .from("trip_reviews")
      .select("rating, comment")
      .eq("trip_id", tripId)
      .eq(
        "reviewer_id",
        session.user.id
      )
      .maybeSingle();

    if (reviewError) {
      setMessage(
        `Error cargando calificación: ${reviewError.message}`
      );
    } else if (existingReview) {
      setRating(existingReview.rating);
      setComment(
        existingReview.comment ?? ""
      );
      setAlreadyReviewed(true);
    }

    setLoading(false);
  }, [router, tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReviewData();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [loadReviewData]);

  function toggleCategory(
    category: ExperienceCategory
  ) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter(
            (item) => item !== category
          )
        : [...current, category]
    );
  }

  async function handleSubmit() {
    if (!trip) return;

    setSaving(true);
    setMessage("");

    const structuredComment = [
      categories.length > 0
        ? `Aspectos destacados: ${categories.join(
            ", "
          )}.`
        : null,
      comment.trim() || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { error } = await supabase.rpc(
      "submit_trip_review",
      {
        p_trip_id: trip.id,
        p_rating: rating,
        p_comment:
          structuredComment || null,
      }
    );

    setSaving(false);

    if (error) {
      setMessage(
        `Error guardando calificación: ${error.message}`
      );
      return;
    }

    setAlreadyReviewed(true);
    setSubmitted(true);
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200" />
        <div className="h-[560px] animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  if (!trip) {
    return (
      <section className="mx-auto flex min-h-[65vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center">
          <Star
            size={38}
            className="mx-auto text-red-700"
          />

          <h1 className="mt-5 text-2xl font-black text-red-900">
            No fue posible calificar
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-700">
            {message}
          </p>

          <Link
            href={`/dashboard/trips/${tripId}`}
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white"
          >
            <ArrowLeft size={18} />
            Volver al viaje
          </Link>
        </div>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-12">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={36} />
          </span>

          <h1 className="mt-7 text-3xl font-black text-slate-950">
            Gracias por calificar
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            Tu opinión ayuda a mejorar la seguridad y calidad de los
            viajes en AXI.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/trips/${trip.id}`
              )
            }
            className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 font-black text-black"
          >
            Volver al viaje
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <Link
        href={`/dashboard/trips/${trip.id}`}
        className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-950 hover:text-white"
      >
        <ArrowLeft size={18} />
        Volver al viaje
      </Link>

      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-10 sm:py-11">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
            <Star size={16} />
            Viaje completado
          </span>

          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            ¿Cómo fue tu experiencia?
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Califica tu viaje con{" "}
            <strong className="text-white">
              {reviewedName}
            </strong>
            . Tu opinión ayuda a mantener un servicio seguro y confiable.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-9">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">
            Calificación general
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {ratingMessages[rating]}
          </h2>

          <div className="mt-7 flex justify-center gap-2 sm:gap-4">
            {[1, 2, 3, 4, 5].map(
              (star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() =>
                    setRating(star)
                  }
                  aria-label={`${star} estrella${
                    star === 1 ? "" : "s"
                  }`}
                  aria-pressed={
                    star <= rating
                  }
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl transition sm:h-16 sm:w-16",
                    star <= rating
                      ? "scale-105 bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                      : "bg-slate-100 text-slate-300 hover:bg-yellow-50 hover:text-yellow-500"
                  )}
                >
                  <Star
                    size={29}
                    fill={
                      star <= rating
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              )
            )}
          </div>

          <p className="mt-4 text-sm font-bold text-slate-500">
            {rating} de 5 estrellas
          </p>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-9">
          <div className="flex items-center gap-3">
            <ThumbsUp
              size={22}
              className="text-yellow-600"
            />

            <div>
              <h2 className="text-xl font-black text-slate-950">
                ¿Qué salió bien?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Puedes seleccionar varios aspectos.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPERIENCE_CATEGORIES.map(
              (item) => {
                const Icon = item.icon;
                const selected =
                  categories.includes(
                    item.value
                  );

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      toggleCategory(
                        item.value
                      )
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-yellow-300 hover:bg-yellow-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        selected
                          ? "bg-yellow-400 text-black"
                          : "bg-white text-slate-500"
                      )}
                    >
                      <Icon size={19} />
                    </span>

                    <span className="text-sm font-black">
                      {item.value}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-9">
          <label
            htmlFor="comment"
            className="text-xl font-black text-slate-950"
          >
            Cuéntanos más
          </label>

          <p className="mt-1 text-sm text-slate-500">
            Este comentario es opcional.
          </p>

          <textarea
            id="comment"
            value={comment}
            onChange={(event) =>
              setComment(
                event.target.value
              )
            }
            rows={6}
            maxLength={500}
            placeholder="Escribe cualquier detalle que pueda ayudarnos a mejorar..."
            className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 outline-none transition focus:border-yellow-400 focus:bg-white"
          />

          <div className="mt-2 flex justify-end text-xs text-slate-400">
            {comment.length}/500
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/trips/${trip.id}`
              )
            }
            className="h-14 rounded-2xl border border-slate-200 font-black text-slate-600 transition hover:bg-slate-50"
          >
            Calificar después
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 font-black text-black transition hover:bg-yellow-300 disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : alreadyReviewed
                ? "Actualizar calificación"
                : "Enviar calificación"}

            {!saving && (
              <ArrowRight size={18} />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
