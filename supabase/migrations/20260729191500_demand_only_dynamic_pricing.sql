insert into public.pricing_settings (
  id,
  base_fare,
  price_per_km,
  price_per_minute,
  booking_fee,
  minimum_fare,
  platform_commission_rate,
  night_multiplier,
  rush_hour_multiplier,
  maximum_surge_multiplier,
  updated_at
)
values (
  true,
  21.00,
  9.75,
  4.00,
  0.00,
  42.00,
  0.2000,
  1.00,
  1.00,
  1.35,
  now()
)
on conflict (id)
do update set
  base_fare = excluded.base_fare,
  price_per_km = excluded.price_per_km,
  price_per_minute = excluded.price_per_minute,
  booking_fee = excluded.booking_fee,
  minimum_fare = excluded.minimum_fare,
  platform_commission_rate =
    excluded.platform_commission_rate,
  night_multiplier = 1.00,
  rush_hour_multiplier = 1.00,
  maximum_surge_multiplier = 1.35,
  updated_at = now();


create or replace function public.get_ride_multiplier(
  requested_ride_type text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case requested_ride_type
    when 'comfort' then 1.80
    else 1.00
  end;
$$;


create or replace function public.calculate_dynamic_trip_fare(
  requested_distance_km numeric,
  requested_duration_minutes integer,
  requested_ride_type text default 'economy'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.pricing_settings%rowtype;

  safe_distance numeric;
  safe_duration integer;
  safe_ride_type text;

  ride_multiplier_value numeric := 1.00;

  waiting_trips integer := 0;
  online_drivers integer := 0;
  demand_ratio numeric := 0;
  demand_multiplier numeric := 1.00;

  period_name text := 'standard';
  final_surge_multiplier numeric := 1.00;

  base_fare_value numeric;
  distance_fare_value numeric;
  time_fare_value numeric;
  pre_multiplier_subtotal numeric;

  category_minimum_fare_value numeric;
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

  select count(*)
  into waiting_trips
  from public.trips
  where status in (
    'requested',
    'searching'
  )
  and requested_at >=
    now() - interval '15 minutes';

  select count(*)
  into online_drivers
  from public.drivers
  where online is true;

  if waiting_trips = 0 then
    demand_ratio := 0;
    demand_multiplier := 1.00;

  elsif online_drivers <= 0 then
    demand_ratio := waiting_trips;
    demand_multiplier := 1.35;

  else
    demand_ratio :=
      waiting_trips::numeric /
      greatest(online_drivers, 1);

    demand_multiplier :=
      case
        when demand_ratio >= 3.00
          then 1.35
        when demand_ratio >= 1.50
          then 1.18
        when demand_ratio >= 0.75
          then 1.08
        else 1.00
      end;
  end if;

  final_surge_multiplier :=
    least(
      1.35,
      settings.maximum_surge_multiplier,
      greatest(
        1.00,
        round(demand_multiplier, 2)
      )
    );

  period_name :=
    case
      when final_surge_multiplier > 1.00
        then 'rush_hour'
      else 'standard'
    end;

  base_fare_value :=
    round(settings.base_fare, 2);

  distance_fare_value :=
    round(
      safe_distance *
      settings.price_per_km,
      2
    );

  time_fare_value :=
    round(
      safe_duration *
      settings.price_per_minute,
      2
    );

  pre_multiplier_subtotal :=
    base_fare_value +
    distance_fare_value +
    time_fare_value;

  category_minimum_fare_value :=
    round(
      settings.minimum_fare *
      ride_multiplier_value,
      2
    );

  fare_before_booking :=
    round(
      pre_multiplier_subtotal *
      ride_multiplier_value *
      final_surge_multiplier,
      2
    );

  estimated_price_value :=
    greatest(
      category_minimum_fare_value,
      round(
        fare_before_booking +
        settings.booking_fee,
        2
      )
    );

  commissionable_amount :=
    greatest(
      estimated_price_value -
      settings.booking_fee,
      0
    );

  platform_commission_value :=
    round(
      settings.booking_fee +
      (
        commissionable_amount *
        settings.platform_commission_rate
      ),
      2
    );

  driver_earnings_value :=
    round(
      commissionable_amount *
      (
        1 -
        settings.platform_commission_rate
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
    'category_minimum_fare',
      category_minimum_fare_value,
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
    'demand_ratio',
      round(demand_ratio, 2),
    'calculated_at',
      now()
  );
end;
$$;


grant execute
on function public.get_ride_multiplier(text)
to authenticated;

grant execute
on function public.calculate_dynamic_trip_fare(
  numeric,
  integer,
  text
)
to authenticated;