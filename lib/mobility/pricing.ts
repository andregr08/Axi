import { supabase } from "@/lib/supabaseClient";

export type RideType =
  | "economy"
  | "comfort";

export type DynamicFareEstimate = {
  distance_km: number;
  duration_minutes: number;
  ride_type: RideType;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  booking_fee: number;
  ride_multiplier: number;
  surge_multiplier: number;
  pricing_period:
    | "standard"
    | "rush_hour"
    | "night";
  subtotal: number;
  estimated_price: number;
  commission_rate: number;
  platform_commission: number;
  driver_earnings: number;
  waiting_trips: number;
  online_drivers: number;
  calculated_at: string;
};

export type CreatePricedTripInput = {
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  distanceKm: number;
  durationMinutes: number;
  paymentMethod: "cash" | "card";
  rideType?: RideType;
};

function parseFareEstimate(
  value: unknown
): DynamicFareEstimate {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Supabase no devolvió una tarifa válida."
    );
  }

  const fare =
    value as Record<string, unknown>;

  return {
    distance_km: Number(
      fare.distance_km ?? 0
    ),
    duration_minutes: Number(
      fare.duration_minutes ?? 0
    ),
    ride_type:
      fare.ride_type === "comfort"
        ? "comfort"
        : "economy",
    base_fare: Number(
      fare.base_fare ?? 0
    ),
    distance_fare: Number(
      fare.distance_fare ?? 0
    ),
    time_fare: Number(
      fare.time_fare ?? 0
    ),
    booking_fee: Number(
      fare.booking_fee ?? 0
    ),
    ride_multiplier: Number(
      fare.ride_multiplier ?? 1
    ),
    surge_multiplier: Number(
      fare.surge_multiplier ?? 1
    ),
    pricing_period:
      fare.pricing_period === "night" ||
      fare.pricing_period ===
        "rush_hour"
        ? fare.pricing_period
        : "standard",
    subtotal: Number(
      fare.subtotal ?? 0
    ),
    estimated_price: Number(
      fare.estimated_price ?? 0
    ),
    commission_rate: Number(
      fare.commission_rate ?? 0.2
    ),
    platform_commission: Number(
      fare.platform_commission ?? 0
    ),
    driver_earnings: Number(
      fare.driver_earnings ?? 0
    ),
    waiting_trips: Number(
      fare.waiting_trips ?? 0
    ),
    online_drivers: Number(
      fare.online_drivers ?? 0
    ),
    calculated_at: String(
      fare.calculated_at ?? ""
    ),
  };
}

export async function getDynamicFareEstimate(
  distanceKm: number,
  durationMinutes: number,
  rideType: RideType = "economy"
): Promise<DynamicFareEstimate> {
  const { data, error } =
    await supabase.rpc(
      "calculate_dynamic_trip_fare",
      {
        requested_distance_km:
          Number(distanceKm.toFixed(2)),
        requested_duration_minutes:
          Math.round(durationMinutes),
        requested_ride_type: rideType,
      }
    );

  if (error) {
    throw new Error(error.message);
  }

  return parseFareEstimate(data);
}

export async function createPricedTrip(
  input: CreatePricedTripInput
): Promise<string> {
  const { data, error } =
    await supabase.rpc(
      "create_priced_trip",
      {
        requested_origin_address:
          input.originAddress.trim(),
        requested_origin_lat:
          input.originLatitude,
        requested_origin_lng:
          input.originLongitude,
        requested_destination_address:
          input.destinationAddress.trim(),
        requested_destination_lat:
          input.destinationLatitude,
        requested_destination_lng:
          input.destinationLongitude,
        requested_distance_km:
          Number(
            input.distanceKm.toFixed(2)
          ),
        requested_duration_minutes:
          Math.round(
            input.durationMinutes
          ),
        requested_payment_method:
          input.paymentMethod,
        requested_ride_type:
          input.rideType ?? "economy",
      }
    );

  if (error) {
    throw new Error(error.message);
  }

  if (
    typeof data !== "string" ||
    !data
  ) {
    throw new Error(
      "No se recibió el identificador del viaje."
    );
  }

  return data;
}

export function getPricingPeriodLabel(
  period:
    DynamicFareEstimate["pricing_period"]
) {
  if (period === "night") {
    return "Tarifa nocturna";
  }

  if (period === "rush_hour") {
    return "Horario de alta demanda";
  }

  return "Tarifa estándar";
}
