"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Trip = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
};

export default function TripReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [reviewedName, setReviewedName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadReviewData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("id, passenger_id, driver_id, status")
        .eq("id", tripId)
        .single();

      if (tripError || !tripData) {
        setMessage(
          `No fue posible cargar el viaje: ${
            tripError?.message ?? "Viaje no encontrado"
          }`
        );
        setLoading(false);
        return;
      }

      if (tripData.status !== "completed") {
        setMessage("Solo puedes calificar un viaje completado.");
        setLoading(false);
        return;
      }

      const isPassenger = session.user.id === tripData.passenger_id;
      const isDriver = session.user.id === tripData.driver_id;

      if (!isPassenger && !isDriver) {
        setMessage("No tienes permiso para calificar este viaje.");
        setLoading(false);
        return;
      }

      const reviewedUserId = isPassenger
        ? tripData.driver_id
        : tripData.passenger_id;

      if (!reviewedUserId) {
        setMessage("No existe un usuario para calificar.");
        setLoading(false);
        return;
      }

      setTrip(tripData);

      const { data: reviewedProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", reviewedUserId)
        .single();

      setReviewedName(
        reviewedProfile?.full_name || "Usuario de AXI"
      );

      const { data: existingReview, error: reviewError } = await supabase
        .from("trip_reviews")
        .select("rating, comment")
        .eq("trip_id", tripId)
        .eq("reviewer_id", session.user.id)
        .maybeSingle();

      if (reviewError) {
        setMessage(`Error cargando calificación: ${reviewError.message}`);
      } else if (existingReview) {
        setRating(existingReview.rating);
        setComment(existingReview.comment ?? "");
        setAlreadyReviewed(true);
      }

      setLoading(false);
    }

    loadReviewData();
  }, [router, tripId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trip) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("submit_trip_review", {
      p_trip_id: trip.id,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });

    setSaving(false);

    if (error) {
      setMessage(`Error guardando calificación: ${error.message}`);
      return;
    }

    setAlreadyReviewed(true);
    setMessage("Calificación guardada correctamente.");
  }

  if (loading) {
    return <p>Cargando calificación...</p>;
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible abrir la calificación."}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Viaje completado
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Calificar viaje
        </h1>

        <p className="mt-2 text-gray-600">
          Comparte tu experiencia con {reviewedName}.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-8 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold text-gray-700">
            Calificación
          </p>

          <div className="mt-4 flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-5xl transition ${
                  star <= rating
                    ? "text-yellow-400"
                    : "text-gray-200"
                }`}
                aria-label={`${star} estrella${star === 1 ? "" : "s"}`}
              >
                ★
              </button>
            ))}
          </div>

          <p className="mt-3 text-center text-sm text-gray-500">
            {rating} de 5 estrellas
          </p>
        </div>

        <div className="mt-8">
          <label
            htmlFor="comment"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Comentario opcional
          </label>

          <textarea
            id="comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={5}
            maxLength={500}
            placeholder="Cuéntanos cómo fue tu experiencia..."
            className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
          />

          <p className="mt-2 text-right text-xs text-gray-400">
            {comment.length}/500
          </p>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-gray-100 p-4 text-sm">
            {message}
          </div>
        )}

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
            className="flex-1 rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
          >
            Volver
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : alreadyReviewed
                ? "Actualizar calificación"
                : "Enviar calificación"}
          </button>
        </div>
      </form>
    </section>
  );
}
