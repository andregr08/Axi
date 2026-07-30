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
  12.91,
  5.34,
  0.00,
  42.00,
  0.2000,
  1.15,
  1.10,
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
  night_multiplier = excluded.night_multiplier,
  rush_hour_multiplier =
    excluded.rush_hour_multiplier,
  maximum_surge_multiplier =
    excluded.maximum_surge_multiplier,
  updated_at = now();