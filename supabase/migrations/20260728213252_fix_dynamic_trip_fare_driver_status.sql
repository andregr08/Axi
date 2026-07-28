create or replace function public.calculate_dynamic_trip_fare(
  requested_distance_km numeric,
  requested_duration_minutes integer,
  requested_ride_type text default 'economy'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  settings public.pricing_settings%rowtype;

  safe_distance numeric;
  safe_duration integer;
  safe_ride_type text;
  ride_multiplier_value numeric;

  current_hour integer;
  period_name text;
  period_multiplier numeric := 1.00;

  waiting_trips integer := 0;
  online_drivers integer := 0;
  demand_ratio numeric := 0;
  demand_multiplier numeric := 1.00;
  final_surge_multiplier numeric := 1.00;

  base_fare_value numeric;
  distance_fare_value numeric;
  time_fare_value numeric;
  pre_multiplier_subtotal numeric;
  fare_before_booking numeric;
  estimated_price_value numeric;

  commissionable_amount numeric;
  platform_commission_value numeric;
  driver_earnings_value numeric;
begin
  select *
  into settings
  from public.pricing_settings
  where id = true;

  if settings.id is null then
    raise exception
      'La configuración de precios no existe.';
  end if;

  safe_distance :=
    greatest(
      coalesce(requested_distance_km, 0),
      0
    );

  safe_duration :=
    greatest(
      coalesce(requested_duration_minutes, 0),
      0
    );

  safe_ride_type :=
    case requested_ride_type
      when 'comfort' then 'comfort'
      else 'economy'
    end;

  ride_multiplier_value :=
    public.get_ride_multiplier(
      safe_ride_type
    );

  current_hour :=
    extract(
      hour
      from timezone(
        'America/Mexico_City',
        now()
      )
    )::integer;

  if current_hour >= 22
    or current_hour < 6 then

    period_name := 'night';
    period_multiplier :=
      settings.night_multiplier;

  elsif current_hour between 7 and 9
    or current_hour between 17 and 20 then

    period_name := 'rush_hour';
    period_multiplier :=
      settings.rush_hour_multiplier;

  else
    period_name := 'standard';
    period_multiplier := 1.00;
  end if;

  select count(*)
  into waiting_trips
  from public.trips
  where status in (
    'requested',
    'searching'
  )
    and requested_at >=
      now() - interval '15 minutes';

  /*
    status representa el estado administrativo.
    operational_status representa la disponibilidad.
  */
  select count(*)
  into online_drivers
  from public.drivers
  where online is true
    and verified is true
    and status = 'active'
    and operational_status = 'available';

  if online_drivers <= 0 then
    demand_multiplier := 1.20;
  else
    demand_ratio :=
      waiting_trips::numeric
      / greatest(online_drivers, 1);

    demand_multiplier :=
      case
        when demand_ratio >= 3
          then 1.20
        when demand_ratio >= 2
          then 1.15
        when demand_ratio >= 1
          then 1.10
        when demand_ratio >= 0.50
          then 1.05
        else 1.00
      end;
  end if;

  final_surge_multiplier :=
    least(
      1.35,
      settings.maximum_surge_multiplier,
      greatest(
        1.00,
        round(
          period_multiplier
          * demand_multiplier,
          2
        )
      )
    );

  base_fare_value :=
    round(
      settings.base_fare,
      2
    );

  distance_fare_value :=
    round(
      safe_distance
      * settings.price_per_km,
      2
    );

  time_fare_value :=
    round(
      safe_duration
      * settings.price_per_minute,
      2
    );

  pre_multiplier_subtotal :=
    base_fare_value
    + distance_fare_value
    + time_fare_value;

  fare_before_booking :=
    round(
      pre_multiplier_subtotal
      * ride_multiplier_value
      * final_surge_multiplier,
      2
    );

  estimated_price_value :=
    greatest(
      settings.minimum_fare,
      round(
        fare_before_booking
        + settings.booking_fee,
        2
      )
    );

  commissionable_amount :=
    greatest(
      estimated_price_value
      - settings.booking_fee,
      0
    );

  platform_commission_value :=
    round(
      settings.booking_fee
      + (
        commissionable_amount
        * settings.platform_commission_rate
      ),
      2
    );

  driver_earnings_value :=
    round(
      commissionable_amount
      * (
        1
        - settings.platform_commission_rate
      ),
      2
    );

  return jsonb_build_object(
    'distance_km',
    round(safe_distance, 2),

    'duration_minutes',
    safe_duration,

    'ride_type',
    safe_ride_type,

    'base_fare',
    base_fare_value,

    'distance_fare',
    distance_fare_value,

    'time_fare',
    time_fare_value,

    'booking_fee',
    round(settings.booking_fee, 2),

    'ride_multiplier',
    ride_multiplier_value,

    'surge_multiplier',
    final_surge_multiplier,

    'pricing_period',
    period_name,

    'subtotal',
    round(pre_multiplier_subtotal, 2),

    'estimated_price',
    estimated_price_value,

    'commission_rate',
    settings.platform_commission_rate,

    'platform_commission',
    platform_commission_value,

    'driver_earnings',
    driver_earnings_value,

    'waiting_trips',
    waiting_trips,

    'online_drivers',
    online_drivers,

    'calculated_at',
    now()
  );
end;
$function$;