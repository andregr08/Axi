create extension if not exists pgcrypto;

create table if not exists public.trip_security (
  trip_id uuid primary key
    references public.trips(id)
    on delete cascade,

  security_pin text not null
    check (security_pin ~ '^[0-9]{4}$'),

  failed_attempts integer not null default 0
    check (failed_attempts >= 0),

  verified_at timestamptz,
  verified_by uuid
    references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_security
enable row level security;

revoke all on table public.trip_security
from anon, authenticated;

create or replace function public.create_trip_security_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_pin text;
begin
  if new.driver_id is not null
     and (
       old.driver_id is null
       or old.driver_id is distinct from new.driver_id
     )
  then
    generated_pin :=
      lpad(
        floor(random() * 10000)::integer::text,
        4,
        '0'
      );

    insert into public.trip_security (
      trip_id,
      security_pin,
      failed_attempts,
      verified_at,
      verified_by,
      created_at,
      updated_at
    )
    values (
      new.id,
      generated_pin,
      0,
      null,
      null,
      now(),
      now()
    )
    on conflict (trip_id)
    do update set
      security_pin = excluded.security_pin,
      failed_attempts = 0,
      verified_at = null,
      verified_by = null,
      updated_at = now();
  end if;

  if new.driver_id is null
     and old.driver_id is not null
  then
    delete from public.trip_security
    where trip_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists
trg_create_trip_security_pin
on public.trips;

create trigger trg_create_trip_security_pin
after update of driver_id
on public.trips
for each row
execute function public.create_trip_security_pin();

create or replace function public.get_trip_security_pin(
  p_trip_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  trip_passenger_id uuid;
  trip_status text;
  result_pin text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select
    passenger_id,
    status::text
  into
    trip_passenger_id,
    trip_status
  from public.trips
  where id = p_trip_id;

  if not found then
    raise exception 'Viaje no encontrado.';
  end if;

  if trip_passenger_id is distinct from current_user_id then
    raise exception 'Solo el pasajero puede consultar este PIN.';
  end if;

  if trip_status not in (
    'accepted',
    'driver_arriving',
    'driver_arrived'
  ) then
    return null;
  end if;

  select security_pin
  into result_pin
  from public.trip_security
  where trip_id = p_trip_id;

  return result_pin;
end;
$$;

create or replace function public.verify_trip_pin_and_start(
  p_trip_id uuid,
  p_security_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  assigned_driver_id uuid;
  current_status text;
  stored_pin text;
  attempts integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_security_pin is null
     or p_security_pin !~ '^[0-9]{4}$'
  then
    raise exception 'Ingresa un PIN válido de 4 dígitos.';
  end if;

  select
    driver_id,
    status::text
  into
    assigned_driver_id,
    current_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Viaje no encontrado.';
  end if;

  if assigned_driver_id is null
     or assigned_driver_id is distinct from current_user_id
  then
    raise exception 'No eres el conductor asignado a este viaje.';
  end if;

  if current_status <> 'driver_arrived' then
    raise exception 'El viaje debe estar en estado Conductor llegó.';
  end if;

  select
    security_pin,
    failed_attempts
  into
    stored_pin,
    attempts
  from public.trip_security
  where trip_id = p_trip_id
  for update;

  if not found then
    raise exception 'El PIN de seguridad todavía no está disponible.';
  end if;

  if attempts >= 5 then
    raise exception 'PIN bloqueado por demasiados intentos. Contacta a soporte.';
  end if;

  if stored_pin <> p_security_pin then
    update public.trip_security
    set
      failed_attempts = failed_attempts + 1,
      updated_at = now()
    where trip_id = p_trip_id;

    raise exception
      'PIN incorrecto. Intentos restantes: %.',
      greatest(0, 4 - attempts);
  end if;

  update public.trip_security
  set
    verified_at = now(),
    verified_by = current_user_id,
    updated_at = now()
  where trip_id = p_trip_id;

  update public.trips
  set
    status = 'in_progress',
    started_at = coalesce(started_at, now())
  where id = p_trip_id;

  return jsonb_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'status', 'in_progress',
    'verified_at', now()
  );
end;
$$;

revoke all on function
public.get_trip_security_pin(uuid)
from public;

revoke all on function
public.verify_trip_pin_and_start(uuid, text)
from public;

grant execute on function
public.get_trip_security_pin(uuid)
to authenticated;

grant execute on function
public.verify_trip_pin_and_start(uuid, text)
to authenticated;

-- Generar PIN para viajes que ya tengan conductor asignado.
insert into public.trip_security (
  trip_id,
  security_pin
)
select
  id,
  lpad(
    floor(random() * 10000)::integer::text,
    4,
    '0'
  )
from public.trips
where driver_id is not null
  and status::text in (
    'accepted',
    'driver_arriving',
    'driver_arrived'
  )
on conflict (trip_id)
do nothing;
