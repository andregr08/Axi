begin;

create table if not exists public.pricing_settings (
  id boolean primary key default true check (id = true),
  base_fare numeric(10,2) not null default 35,
  price_per_km numeric(10,2) not null default 12,
  price_per_minute numeric(10,2) not null default 1.50,
  booking_fee numeric(10,2) not null default 8,
  minimum_fare numeric(10,2) not null default 55,
  platform_commission_rate numeric(5,4) not null default 0.20,
  night_multiplier numeric(5,2) not null default 1.15,
  rush_hour_multiplier numeric(5,2) not null default 1.10,
  maximum_surge_multiplier numeric(5,2) not null default 1.80,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

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
  maximum_surge_multiplier
)
values (
  true,
  35,
  12,
  1.50,
  8,
  55,
  0.20,
  1.15,
  1.10,
  1.80
)
on conflict (id) do nothing;

alter table public.pricing_settings enable row level security;

drop policy if exists "pricing_settings_read_authenticated"
on public.pricing_settings;

create policy "pricing_settings_read_authenticated"
on public.pricing_settings
for select
to authenticated
using (true);

alter table public.trips
  add column if not exists base_fare numeric(10,2),
  add column if not exists distance_fare numeric(10,2),
  add column if not exists time_fare numeric(10,2),
  add column if not exists subtotal numeric(10,2),
  add column if not exists ride_type text,
  add column if not exists ride_multiplier numeric(5,2),
  add column if not exists surge_multiplier numeric(5,2),
  add column if not exists pricing_period text,
  add column if not exists commission_rate numeric(5,4),
  add column if not exists fare_breakdown jsonb,
  add column if not exists pricing_calculated_at timestamptz;

alter table public.trips
  drop constraint if exists trips_ride_type_check;

alter table public.trips
  add constraint trips_ride_type_check
  check (
    ride_type is null
    or ride_type in ('economy', 'comfort')
  );

create or replace function public.get_ride_multiplier(
  requested_ride_type text
)
returns numeric
language sql
immutable
as $$
  select case requested_ride_type
    when 'comfort' then 1.25
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
    raise exception 'La configuración de precios no existe.';
  end if;

  safe_distance := greatest(coalesce(requested_distance_km, 0), 0);
  safe_duration := greatest(coalesce(requested_duration_minutes, 0), 0);

  safe_ride_type :=
    case requested_ride_type
      when 'comfort' then 'comfort'
      else 'economy'
    end;

  ride_multiplier_value :=
    public.get_ride_multiplier(safe_ride_type);

  current_hour :=
    extract(
      hour from timezone('America/Mexico_City', now())
    )::integer;

  if current_hour >= 22 or current_hour < 6 then
    period_name := 'night';
    period_multiplier := settings.night_multiplier;
  elsif current_hour between 7 and 9
     or current_hour between 17 and 20 then
    period_name := 'rush_hour';
    period_multiplier := settings.rush_hour_multiplier;
  else
    period_name := 'standard';
    period_multiplier := 1.00;
  end if;

  select count(*)
  into waiting_trips
  from public.trips
  where status in ('requested', 'searching')
    and requested_at >= now() - interval '15 minutes';

  select count(*)
  into online_drivers
  from public.drivers
  where online = true
    and status in ('available', 'active');

  if online_drivers <= 0 then
    demand_multiplier := 1.20;
  else
    demand_ratio :=
      waiting_trips::numeric / greatest(online_drivers, 1);

    demand_multiplier :=
      case
        when demand_ratio >= 3 then 1.20
        when demand_ratio >= 2 then 1.15
        when demand_ratio >= 1 then 1.10
        when demand_ratio >= 0.50 then 1.05
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
          period_multiplier * demand_multiplier,
          2
        )
      )
    );

  base_fare_value :=
    round(settings.base_fare, 2);

  distance_fare_value :=
    round(
      safe_distance * settings.price_per_km,
      2
    );

  time_fare_value :=
    round(
      safe_duration * settings.price_per_minute,
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
        fare_before_booking + settings.booking_fee,
        2
      )
    );

  commissionable_amount :=
    greatest(
      estimated_price_value - settings.booking_fee,
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
      * (1 - settings.platform_commission_rate),
      2
    );

  return jsonb_build_object(
    'distance_km', round(safe_distance, 2),
    'duration_minutes', safe_duration,
    'ride_type', safe_ride_type,
    'base_fare', base_fare_value,
    'distance_fare', distance_fare_value,
    'time_fare', time_fare_value,
    'booking_fee', round(settings.booking_fee, 2),
    'ride_multiplier', ride_multiplier_value,
    'surge_multiplier', final_surge_multiplier,
    'pricing_period', period_name,
    'subtotal', round(pre_multiplier_subtotal, 2),
    'estimated_price', estimated_price_value,
    'commission_rate', settings.platform_commission_rate,
    'platform_commission', platform_commission_value,
    'driver_earnings', driver_earnings_value,
    'waiting_trips', waiting_trips,
    'online_drivers', online_drivers,
    'calculated_at', now()
  );
end;
$$;

create or replace function public.create_priced_trip(
  requested_origin_address text,
  requested_origin_lat numeric,
  requested_origin_lng numeric,
  requested_destination_address text,
  requested_destination_lat numeric,
  requested_destination_lng numeric,
  requested_distance_km numeric,
  requested_duration_minutes integer,
  requested_payment_method text,
  requested_ride_type text default 'economy'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  fare jsonb;
  created_trip_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if coalesce(trim(requested_origin_address), '') = '' then
    raise exception 'El origen es obligatorio.';
  end if;

  if coalesce(trim(requested_destination_address), '') = '' then
    raise exception 'El destino es obligatorio.';
  end if;

  if requested_payment_method not in ('cash', 'card') then
    raise exception 'Método de pago inválido.';
  end if;

  fare :=
    public.calculate_dynamic_trip_fare(
      requested_distance_km,
      requested_duration_minutes,
      requested_ride_type
    );

  insert into public.trips (
    passenger_id,
    origin_address,
    origin_lat,
    origin_lng,
    destination_address,
    destination_lat,
    destination_lng,
    distance_km,
    duration_minutes,
    payment_method,
    status,
    base_fare,
    distance_fare,
    time_fare,
    booking_fee,
    subtotal,
    ride_type,
    ride_multiplier,
    surge_multiplier,
    pricing_period,
    estimated_price,
    commission_rate,
    platform_commission,
    driver_earnings,
    fare_breakdown,
    pricing_calculated_at
  )
  values (
    current_user_id,
    trim(requested_origin_address),
    requested_origin_lat,
    requested_origin_lng,
    trim(requested_destination_address),
    requested_destination_lat,
    requested_destination_lng,
    (fare ->> 'distance_km')::numeric,
    (fare ->> 'duration_minutes')::integer,
    requested_payment_method,
    'requested',
    (fare ->> 'base_fare')::numeric,
    (fare ->> 'distance_fare')::numeric,
    (fare ->> 'time_fare')::numeric,
    (fare ->> 'booking_fee')::numeric,
    (fare ->> 'subtotal')::numeric,
    fare ->> 'ride_type',
    (fare ->> 'ride_multiplier')::numeric,
    (fare ->> 'surge_multiplier')::numeric,
    fare ->> 'pricing_period',
    (fare ->> 'estimated_price')::numeric,
    (fare ->> 'commission_rate')::numeric,
    (fare ->> 'platform_commission')::numeric,
    (fare ->> 'driver_earnings')::numeric,
    fare,
    now()
  )
  returning id into created_trip_id;

  return created_trip_id;
end;
$$;

revoke all
on function public.calculate_dynamic_trip_fare(
  numeric,
  integer,
  text
)
from public;

grant execute
on function public.calculate_dynamic_trip_fare(
  numeric,
  integer,
  text
)
to authenticated;

revoke all
on function public.create_priced_trip(
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  text,
  text
)
from public;

grant execute
on function public.create_priced_trip(
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  text,
  text
)
to authenticated;

commit;
