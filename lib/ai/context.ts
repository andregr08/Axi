import { createClient } from "@supabase/supabase-js";
import type {
  AIContext,
  AITripContext,
  AIUserRole,
} from "./prompt";

type ProfileRow = {
  full_name: string | null;
  role: AIUserRole | null;
};

type TripRow = {
  id: string;
  origin_address: string;
  destination_address: string;
  status: string;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
};

export async function buildContext(
  accessToken: string
): Promise<AIContext> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan las variables públicas de Supabase."
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    throw new Error(
      "La sesión del usuario no es válida."
    );
  }

  const [
    profileResult,
    tripsResult,
    tripsCountResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("trips")
      .select(`
        id,
        origin_address,
        destination_address,
        status,
        estimated_price,
        final_price,
        requested_at
      `)
      .order("requested_at", {
        ascending: false,
      })
      .limit(5),

    supabase
      .from("trips")
      .select("id", {
        count: "exact",
        head: true,
      }),
  ]);

  if (profileResult.error) {
    console.error(
      "AXI AI profile error:",
      profileResult.error.message
    );
  }

  if (tripsResult.error) {
    console.error(
      "AXI AI trips error:",
      tripsResult.error.message
    );
  }

  const profile =
    profileResult.data as ProfileRow | null;

  const trips =
    (tripsResult.data ?? []) as TripRow[];

  const recentTrips: AITripContext[] =
    trips.map((trip) => ({
      id: trip.id,
      origin: trip.origin_address,
      destination: trip.destination_address,
      status: trip.status,
      estimatedPrice: trip.estimated_price,
      finalPrice: trip.final_price,
      requestedAt: trip.requested_at,
    }));

  return {
    userId: user.id,
    name:
      profile?.full_name ??
      user.user_metadata?.full_name ??
      null,
    email: user.email ?? null,
    role: profile?.role ?? "passenger",
    totalTrips:
      tripsCountResult.count ??
      recentTrips.length,
    recentTrips,
  };
}
