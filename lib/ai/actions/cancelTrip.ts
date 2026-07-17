import { createClient } from "@supabase/supabase-js";
import type { AIActionInput } from "./types";

const ACTIVE_STATUSES = [
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "driver_arrived",
] as const;

function createSupabaseClient(
  accessToken: string
) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan las variables públicas de Supabase."
    );
  }

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasConfirmation(message: string) {
  const text = normalize(message);

  return [
    "confirmo cancelar",
    "confirmo la cancelacion",
    "si cancelalo",
    "si cancela el viaje",
    "cancelalo ahora",
    "cancela mi viaje ahora",
  ].some((phrase) => text.includes(phrase));
}

export async function cancelTrip({
  context,
  accessToken,
  message,
}: AIActionInput) {
  if (context.role !== "passenger") {
    return {
      success: false,
      code: "ROLE_NOT_ALLOWED",
      message:
        "Por ahora esta acción solo está disponible para pasajeros.",
    };
  }

  if (!hasConfirmation(message)) {
    return {
      success: false,
      requiresConfirmation: true,
      code: "CONFIRMATION_REQUIRED",
      message:
        'Para cancelar tu viaje escribe: "Confirmo cancelar mi viaje".',
    };
  }

  const supabase =
    createSupabaseClient(accessToken);

  const { data: trip, error: tripError } =
    await supabase
      .from("trips")
      .select(`
        id,
        origin_address,
        destination_address,
        status
      `)
      .eq("passenger_id", context.userId)
      .in("status", [...ACTIVE_STATUSES])
      .order("requested_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (tripError) {
    throw new Error(tripError.message);
  }

  if (!trip) {
    return {
      success: false,
      code: "NO_ACTIVE_TRIP",
      message:
        "No tienes ningún viaje activo que se pueda cancelar.",
    };
  }

  const { error: updateError } =
    await supabase
      .from("trips")
      .update({
        status: "cancelled",
      })
      .eq("id", trip.id)
      .eq("passenger_id", context.userId)
      .in("status", [...ACTIVE_STATUSES]);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    success: true,
    code: "TRIP_CANCELLED",
    message:
      "El viaje fue cancelado correctamente.",
    trip: {
      origin: trip.origin_address,
      destination: trip.destination_address,
      previousStatus: trip.status,
      status: "cancelled",
    },
  };
}
