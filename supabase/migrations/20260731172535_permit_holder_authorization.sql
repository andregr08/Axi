-- =========================================================
-- AXI: autorización del titular del permiso o concesión
-- Esta migración no modifica el flujo existente del conductor.
-- =========================================================

-- La columna queda nullable para no afectar solicitudes anteriores.
alter table public.driver_applications
  add column if not exists is_concession_holder boolean,
  add column if not exists vehicle_plate text;

comment on column public.driver_applications.is_concession_holder is
  'Indica si el conductor solicitante es titular del permiso o concesión. NULL representa una solicitud anterior a este flujo.';

-- =========================================================
-- AUTORIZACIÓN DEL PERMISIONARIO
-- =========================================================

create table if not exists public.permit_holder_authorizations (
  id uuid primary key default gen_random_uuid(),

  driver_application_id uuid not null unique
    references public.driver_applications(id)
    on delete cascade,

  holder_name text not null,
  holder_email text,
  holder_phone text,
  relationship_to_driver text not null,

  authorization_expires_on date,
  no_expiration boolean not null default false,

  status text not null default 'pending',

  authorization_token uuid not null
    default gen_random_uuid(),

  holder_identification_url text,
  holder_concession_document_url text,

  authorized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint permit_holder_authorizations_status_check
    check (
      status in (
        'pending',
        'authorized',
        'expired',
        'revoked'
      )
    ),

  constraint permit_holder_authorizations_contact_check
    check (
      nullif(btrim(holder_email), '') is not null
      or nullif(btrim(holder_phone), '') is not null
    ),

  constraint permit_holder_authorizations_expiration_check
    check (
      (
        no_expiration is true
        and authorization_expires_on is null
      )
      or
      (
        no_expiration is false
        and authorization_expires_on is not null
      )
    )
);

create unique index if not exists
  permit_holder_authorizations_token_key
on public.permit_holder_authorizations (
  authorization_token
);

create index if not exists
  permit_holder_authorizations_status_idx
on public.permit_holder_authorizations (
  status
);

comment on table public.permit_holder_authorizations is
  'Autorizaciones otorgadas por titulares de permisos o concesiones a conductores de AXI.';

comment on column public.permit_holder_authorizations.authorization_token is
  'Token aleatorio utilizado en el enlace privado enviado al permisionario.';

-- =========================================================
-- UPDATED_AT
-- =========================================================

create or replace function
  public.touch_permit_holder_authorization_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists
  permit_holder_authorizations_updated_at
on public.permit_holder_authorizations;

create trigger
  permit_holder_authorizations_updated_at
before update
on public.permit_holder_authorizations
for each row
execute function
  public.touch_permit_holder_authorization_updated_at();

-- =========================================================
-- FUNCIONES DE SEGURIDAD
-- =========================================================

create or replace function
  public.is_axi_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role::text = 'admin'
  );
$function$;

create or replace function
  public.owns_driver_application(
    application_id_value uuid
  )
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.driver_applications application
    where application.id = application_id_value
      and application.user_id = auth.uid()
  );
$function$;

revoke all on function
  public.is_axi_admin_user()
from public, anon;

revoke all on function
  public.owns_driver_application(uuid)
from public, anon;

grant execute on function
  public.is_axi_admin_user()
to authenticated, service_role;

grant execute on function
  public.owns_driver_application(uuid)
to authenticated, service_role;

-- =========================================================
-- RLS
-- =========================================================

alter table public.permit_holder_authorizations
  enable row level security;

drop policy if exists
  "Drivers and admins can read permit authorizations"
on public.permit_holder_authorizations;

create policy
  "Drivers and admins can read permit authorizations"
on public.permit_holder_authorizations
for select
to authenticated
using (
  public.is_axi_admin_user()
  or public.owns_driver_application(
    driver_application_id
  )
);

revoke all
on public.permit_holder_authorizations
from anon;

grant select
on public.permit_holder_authorizations
to authenticated;

grant all
on public.permit_holder_authorizations
to service_role;

-- =========================================================
-- CONDUCTOR: REGISTRAR DATOS DEL PERMISIONARIO
-- =========================================================

create or replace function
  public.upsert_permit_holder_authorization(
    p_application_id uuid,
    p_holder_name text,
    p_holder_email text,
    p_holder_phone text,
    p_relationship_to_driver text,
    p_authorization_expires_on date,
    p_no_expiration boolean
  )
returns table (
  authorization_id uuid,
  authorization_token uuid,
  authorization_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  application_record public.driver_applications%rowtype;
  authorization_record public.permit_holder_authorizations%rowtype;
  clean_name text;
  clean_email text;
  clean_phone text;
  clean_relationship text;
begin
  if auth.uid() is null then
    raise exception
      'Debes iniciar sesión para registrar al permisionario';
  end if;

  select *
  into application_record
  from public.driver_applications
  where id = p_application_id
    and user_id = auth.uid();

  if not found then
    raise exception
      'No tienes acceso a esta solicitud de conductor';
  end if;

  if application_record.status = 'approved' then
    raise exception
      'Una solicitud aprobada ya no puede modificarse';
  end if;

  clean_name := nullif(btrim(p_holder_name), '');
  clean_email := nullif(lower(btrim(p_holder_email)), '');
  clean_phone := nullif(btrim(p_holder_phone), '');
  clean_relationship :=
    nullif(btrim(p_relationship_to_driver), '');

  if clean_name is null then
    raise exception
      'El nombre del permisionario es obligatorio';
  end if;

  if clean_email is null and clean_phone is null then
    raise exception
      'Debes registrar un correo o teléfono del permisionario';
  end if;

  if clean_relationship is null then
    raise exception
      'La relación con el conductor es obligatoria';
  end if;

  if coalesce(p_no_expiration, false) is false
     and p_authorization_expires_on is null then
    raise exception
      'Debes indicar la vigencia de la autorización';
  end if;

  update public.driver_applications
  set
    is_concession_holder = false,
    updated_at = now()
  where id = p_application_id;

  insert into public.permit_holder_authorizations (
    driver_application_id,
    holder_name,
    holder_email,
    holder_phone,
    relationship_to_driver,
    authorization_expires_on,
    no_expiration,
    status,
    authorization_token,
    holder_identification_url,
    holder_concession_document_url,
    authorized_at
  )
  values (
    p_application_id,
    clean_name,
    clean_email,
    clean_phone,
    clean_relationship,
    case
      when coalesce(p_no_expiration, false)
        then null
      else p_authorization_expires_on
    end,
    coalesce(p_no_expiration, false),
    'pending',
    gen_random_uuid(),
    null,
    null,
    null
  )
  on conflict (driver_application_id)
  do update set
    holder_name =
      excluded.holder_name,

    holder_email =
      excluded.holder_email,

    holder_phone =
      excluded.holder_phone,

    relationship_to_driver =
      excluded.relationship_to_driver,

    authorization_expires_on =
      excluded.authorization_expires_on,

    no_expiration =
      excluded.no_expiration,

    status =
      'pending',

    authorization_token =
      gen_random_uuid(),

    holder_identification_url =
      null,

    holder_concession_document_url =
      null,

    authorized_at =
      null,

    updated_at =
      now()
  returning *
  into authorization_record;

  return query
  select
    authorization_record.id,
    authorization_record.authorization_token,
    authorization_record.status;
end;
$function$;

revoke all on function
  public.upsert_permit_holder_authorization(
    uuid,
    text,
    text,
    text,
    text,
    date,
    boolean
  )
from public, anon;

grant execute on function
  public.upsert_permit_holder_authorization(
    uuid,
    text,
    text,
    text,
    text,
    date,
    boolean
  )
to authenticated, service_role;

-- =========================================================
-- CONDUCTOR: INDICAR QUE ÉL ES EL TITULAR
-- =========================================================

create or replace function
  public.set_driver_as_concession_holder(
    p_application_id uuid
  )
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  application_status text;
begin
  if auth.uid() is null then
    raise exception
      'Debes iniciar sesión para actualizar la solicitud';
  end if;

  select status::text
  into application_status
  from public.driver_applications
  where id = p_application_id
    and user_id = auth.uid();

  if not found then
    raise exception
      'No tienes acceso a esta solicitud de conductor';
  end if;

  if application_status = 'approved' then
    raise exception
      'Una solicitud aprobada ya no puede modificarse';
  end if;

  update public.driver_applications
  set
    is_concession_holder = true,
    updated_at = now()
  where id = p_application_id;

  delete from public.permit_holder_authorizations
  where driver_application_id = p_application_id;
end;
$function$;

revoke all on function
  public.set_driver_as_concession_holder(uuid)
from public, anon;

grant execute on function
  public.set_driver_as_concession_holder(uuid)
to authenticated, service_role;

-- =========================================================
-- ENLACE PÚBLICO: INFORMACIÓN LIMITADA
-- No expone documentos, correo ni teléfono.
-- =========================================================

create or replace function
  public.get_permit_holder_authorization_public(
    p_token uuid
  )
returns table (
  authorization_id uuid,
  authorization_status text,
  holder_name text,
  driver_name text,
  taxi_number text,
  vehicle_plate text,
  concession_number text,
  authorization_expires_on date,
  no_expiration boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    holder_auth.id,
    holder_auth.status::text,
    holder_auth.holder_name,
    driver_profile.full_name,
    driver_application.taxi_number,
    driver_application.vehicle_plate,
    driver_application.concession_number,
    holder_auth.authorization_expires_on,
    holder_auth.no_expiration
  from public.permit_holder_authorizations as holder_auth
  join public.driver_applications as driver_application
    on driver_application.id =
       holder_auth.driver_application_id
  left join public.profiles as driver_profile
    on driver_profile.id =
       driver_application.user_id
  where holder_auth.authorization_token = p_token
  limit 1;
$function$;

revoke all on function
  public.get_permit_holder_authorization_public(uuid)
from public;

grant execute on function
  public.get_permit_holder_authorization_public(uuid)
to anon, authenticated, service_role;
