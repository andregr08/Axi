import { supabase } from "@/lib/supabaseClient";

export type RideType =
  | "economy"
  | "comfort";

export type DynamicPricingContext = {
  originAddress?: string;
  originLatitude?: number;
  originLongitude?: number;

  destinationAddress?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;

  trafficRatio?: number | null;
  trafficDelayMinutes?: number | null;

  weatherAvailable?: boolean;
  weatherConditionType?: string | null;
  precipitationProbability?: number | null;
  precipitationMm?: number | null;
  thunderstormProbability?: number | null;
  windSpeedKph?: number | null;
};

export type DynamicFareEstimate = {
  distance_km: number;
  duration_minutes: number;
  ride_type: RideType;

  quote_id: string | null;
  quote_expires_at: string | null;
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

  period_multiplier: number;
  demand_multiplier: number;
  weather_multiplier: number;
  traffic_multiplier: number;

  subtotal: number;
  estimated_price: number;

  commission_rate: number;
  platform_commission: number;
  driver_earnings: number;

  waiting_trips: number;
  online_drivers: number;
  demand_ratio: number;

  local_radius_km: number;
  location_freshness_minutes: number;
  demand_window_minutes: number;
  used_local_zone: boolean;

  traffic_ratio: number;
  traffic_delay_minutes: number;
  traffic_already_in_duration: boolean;

  weather_available: boolean;
  weather_condition_type: string | null;
  precipitation_probability: number | null;
  precipitation_mm: number | null;
  thunderstorm_probability: number | null;
  wind_speed_kph: number | null;
  weather_reason: string;

  calculated_at: string;
};

export type CreatePricedTripInput = {
  quoteId?: string;
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

  trafficRatio?: number | null;
  trafficDelayMinutes?: number | null;

  weatherAvailable?: boolean;
  weatherConditionType?: string | null;
  precipitationProbability?: number | null;
  precipitationMm?: number | null;
  thunderstormProbability?: number | null;
  windSpeedKph?: number | null;
};

function optionalNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function optionalText(
  value: unknown
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value
    : null;
}

function parseFareEstimate(
  value: unknown
): DynamicFareEstimate {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Supabase no devolviÃ³ una tarifa vÃ¡lida."
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

    quote_id:
      optionalText(
        fare.quote_id
      ),

    quote_expires_at:
      optionalText(
        fare.quote_expires_at
      ),

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
      fare.pricing_period === "rush_hour"
        ? fare.pricing_period
        : "standard",

    period_multiplier: Number(
      fare.period_multiplier ?? 1
    ),

    demand_multiplier: Number(
      fare.demand_multiplier ?? 1
    ),

    weather_multiplier: Number(
      fare.weather_multiplier ?? 1
    ),

    traffic_multiplier: Number(
      fare.traffic_multiplier ?? 1
    ),

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

    demand_ratio: Number(
      fare.demand_ratio ?? 0
    ),

    local_radius_km: Number(
      fare.local_radius_km ?? 5
    ),

    location_freshness_minutes:
      Number(
        fare.location_freshness_minutes ??
          3
      ),

    demand_window_minutes: Number(
      fare.demand_window_minutes ?? 15
    ),

    used_local_zone:
      fare.used_local_zone === true,

    traffic_ratio: Number(
      fare.traffic_ratio ?? 1
    ),

    traffic_delay_minutes: Number(
      fare.traffic_delay_minutes ?? 0
    ),

    traffic_already_in_duration:
      fare.traffic_already_in_duration !==
      false,

    weather_available:
      fare.weather_available === true,

    weather_condition_type:
      optionalText(
        fare.weather_condition_type
      ),

    precipitation_probability:
      optionalNumber(
        fare.precipitation_probability
      ),

    precipitation_mm:
      optionalNumber(
        fare.precipitation_mm
      ),

    thunderstorm_probability:
      optionalNumber(
        fare.thunderstorm_probability
      ),

    wind_speed_kph:
      optionalNumber(
        fare.wind_speed_kph
      ),

    weather_reason:
      optionalText(
        fare.weather_reason
      ) ?? "normal",

    calculated_at: String(
      fare.calculated_at ?? ""
    ),
  };
}

export async function getDynamicFareEstimate(
  distanceKm: number,
  durationMinutes: number,
  rideType: RideType = "economy",
  context?: DynamicPricingContext
): Promise<DynamicFareEstimate> {
  const canCreateFrozenQuote =
    Boolean(
      context?.originAddress?.trim()
    ) &&
    Boolean(
      context?.destinationAddress?.trim()
    ) &&
    Number.isFinite(
      context?.originLatitude
    ) &&
    Number.isFinite(
      context?.originLongitude
    ) &&
    Number.isFinite(
      context?.destinationLatitude
    ) &&
    Number.isFinite(
      context?.destinationLongitude
    );

  if (canCreateFrozenQuote) {
    const { data, error } =
      await supabase.rpc(
        "create_trip_fare_quote_context",
        {
          requested_origin_address:
            context?.originAddress?.trim() ??
            "",

          requested_origin_lat:
            context?.originLatitude ?? 0,

          requested_origin_lng:
            context?.originLongitude ?? 0,

          requested_destination_address:
            context?.destinationAddress?.trim() ??
            "",

          requested_destination_lat:
            context?.destinationLatitude ?? 0,

          requested_destination_lng:
            context?.destinationLongitude ?? 0,

          requested_distance_km:
            Number(
              distanceKm.toFixed(2)
            ),

          requested_duration_minutes:
            Math.round(
              durationMinutes
            ),

          requested_ride_type:
            rideType,

          requested_traffic_ratio:
            context?.trafficRatio ?? null,

          requested_traffic_delay_minutes:
            context?.trafficDelayMinutes ??
            null,

          requested_weather_available:
            context?.weatherAvailable ??
            false,

          requested_weather_condition_type:
            context?.weatherConditionType ??
            null,

          requested_precipitation_probability:
            context
              ?.precipitationProbability ??
            null,

          requested_precipitation_mm:
            context?.precipitationMm ?? null,

          requested_thunderstorm_probability:
            context
              ?.thunderstormProbability ??
            null,

          requested_wind_speed_kph:
            context?.windSpeedKph ?? null,
        }
      );

    if (error) {
      throw new Error(error.message);
    }

    return parseFareEstimate(data);
  }

  const hasOriginContext =
    Number.isFinite(
      context?.originLatitude
    ) &&
    Number.isFinite(
      context?.originLongitude
    );

  if (hasOriginContext) {
    const { data, error } =
      await supabase.rpc(
        "calculate_dynamic_trip_fare_context",
        {
          requested_distance_km:
            Number(
              distanceKm.toFixed(2)
            ),

          requested_duration_minutes:
            Math.round(
              durationMinutes
            ),

          requested_ride_type:
            rideType,

          requested_origin_lat:
            context?.originLatitude ?? null,

          requested_origin_lng:
            context?.originLongitude ?? null,

          requested_traffic_ratio:
            context?.trafficRatio ?? null,

          requested_traffic_delay_minutes:
            context?.trafficDelayMinutes ??
            null,

          requested_weather_available:
            context?.weatherAvailable ??
            false,

          requested_weather_condition_type:
            context?.weatherConditionType ??
            null,

          requested_precipitation_probability:
            context
              ?.precipitationProbability ??
            null,

          requested_precipitation_mm:
            context?.precipitationMm ?? null,

          requested_thunderstorm_probability:
            context
              ?.thunderstormProbability ??
            null,

          requested_wind_speed_kph:
            context?.windSpeedKph ?? null,
        }
      );

    if (error) {
      throw new Error(error.message);
    }

    return parseFareEstimate(data);
  }

  const { data, error } =
    await supabase.rpc(
      "calculate_dynamic_trip_fare",
      {
        requested_distance_km:
          Number(
            distanceKm.toFixed(2)
          ),

        requested_duration_minutes:
          Math.round(
            durationMinutes
          ),

        requested_ride_type:
          rideType,
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
  if (input.quoteId) {
    const { data, error } =
      await supabase.rpc(
        "create_priced_trip_from_quote",
        {
          requested_quote_id:
            input.quoteId,

          requested_payment_method:
            input.paymentMethod,
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

  const containsDynamicContext =
    input.trafficRatio !== undefined ||
    input.trafficDelayMinutes !==
      undefined ||
    input.weatherAvailable !==
      undefined;

  if (containsDynamicContext) {
    throw new Error(
      "La cotización no está disponible. Vuelve a seleccionar el viaje."
    );
  }

  /*
    Compatibilidad temporal para pantallas
    que todavía no generan una cotización.
  */
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

  return "Tarifa estÃ¡ndar";
}