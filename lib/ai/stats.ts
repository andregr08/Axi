import { createClient } from "@supabase/supabase-js";

function getClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

export async function getPassengerStats(
  accessToken: string,
  userId: string
) {
  const supabase = getClient(accessToken);

  const { data, error } = await supabase
    .from("trips")
    .select(`
      final_price,
      estimated_price,
      payment_method,
      distance_km,
      status
    `)
    .eq("passenger_id", userId);

  if (error) throw error;

  const trips = data ?? [];

  const totalTrips = trips.length;

  const totalSpent = trips.reduce(
    (sum, trip) =>
      sum +
      Number(
        trip.final_price ??
        trip.estimated_price ??
        0
      ),
    0
  );

  const totalKm = trips.reduce(
    (sum, trip) =>
      sum + Number(trip.distance_km ?? 0),
    0
  );

  const paymentUsage: Record<string, number> = {};

  for (const trip of trips) {
    if (!trip.payment_method) continue;

    paymentUsage[trip.payment_method] =
      (paymentUsage[trip.payment_method] ?? 0) + 1;
  }

  const favoritePayment =
    Object.entries(paymentUsage)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  const activeTrip =
    trips.find(
      (trip) =>
        trip.status !== "completed" &&
        trip.status !== "cancelled"
    ) ?? null;

  return {
    totalTrips,
    totalSpent,
    totalKm,
    favoritePayment,
    hasActiveTrip: !!activeTrip,
  };
}
