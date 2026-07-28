-- ============================================================
-- AXI: NÚCLEO DE FACTURACIÓN
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- PERFIL FISCAL DEL PASAJERO
-- ============================================================

create table if not exists public.passenger_billing_profiles (
  id uuid primary key default gen_random_uuid(),

  passenger_id uuid not null
    references public.profiles(id)
    on delete cascade,

  taxpayer_name text not null,
  rfc text not null,
  tax_regime text not null,
  fiscal_postal_code text not null,

  cfdi_use text not null default 'G03',
  email text null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint passenger_billing_profiles_passenger_unique
    unique (passenger_id),

  constraint passenger_billing_profiles_rfc_format_check
    check (
      upper(rfc) ~
      '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
    ),

  constraint passenger_billing_profiles_postal_code_check
    check (
      fiscal_postal_code ~ '^[0-9]{5}$'
    ),

  constraint passenger_billing_profiles_cfdi_use_check
    check (
      cfdi_use in (
        'G01',
        'G02',
        'G03',
        'I01',
        'I02',
        'I03',
        'I04',
        'I05',
        'I06',
        'I07',
        'I08',
        'D01',
        'D02',
        'D03',
        'D04',
        'D05',
        'D06',
        'D07',
        'D08',
        'D09',
        'D10',
        'S01',
        'CP01',
        'CN01'
      )
    )
);

create unique index if not exists
  passenger_billing_profiles_rfc_unique_idx
on public.passenger_billing_profiles (upper(rfc))
where is_active = true;

create index if not exists
  passenger_billing_profiles_passenger_idx
on public.passenger_billing_profiles (passenger_id);

-- ============================================================
-- SOLICITUDES Y FACTURAS
-- ============================================================

create table if not exists public.invoice_requests (
  id uuid primary key default gen_random_uuid(),

  payment_transaction_id uuid not null
    references public.payment_transactions(id)
    on delete restrict,

  trip_id uuid not null
    references public.trips(id)
    on delete restrict,

  passenger_id uuid not null
    references public.profiles(id)
    on delete restrict,

  status text not null default 'pending',

  -- Snapshot fiscal inmutable de la solicitud
  taxpayer_name text not null,
  rfc text not null,
  tax_regime text not null,
  fiscal_postal_code text not null,
  cfdi_use text not null,
  billing_email text null,

  currency text not null default 'MXN',

  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,

  payment_method text null,

  provider text null,
  provider_request_id text null,
  provider_response jsonb not null default '{}'::jsonb,

  series text null,
  folio text null,
  uuid_fiscal text null,

  xml_url text null,
  pdf_url text null,

  error_code text null,
  error_message text null,

  requested_at timestamptz not null default now(),
  processing_started_at timestamptz null,
  issued_at timestamptz null,
  failed_at timestamptz null,
  cancelled_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_requests_payment_unique
    unique (payment_transaction_id),

  constraint invoice_requests_status_check
    check (
      status in (
        'pending',
        'processing',
        'issued',
        'failed',
        'cancelled'
      )
    ),

  constraint invoice_requests_amounts_check
    check (
      subtotal >= 0
      and tax_amount >= 0
      and total_amount >= 0
    ),

  constraint invoice_requests_rfc_format_check
    check (
      upper(rfc) ~
      '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
    ),

  constraint invoice_requests_postal_code_check
    check (
      fiscal_postal_code ~ '^[0-9]{5}$'
    ),

  constraint invoice_requests_currency_check
    check (
      currency = 'MXN'
    )
);

create index if not exists
  invoice_requests_passenger_idx
on public.invoice_requests (passenger_id, created_at desc);

create index if not exists
  invoice_requests_status_idx
on public.invoice_requests (status, created_at desc);

create index if not exists
  invoice_requests_trip_idx
on public.invoice_requests (trip_id);

create unique index if not exists
  invoice_requests_uuid_fiscal_unique_idx
on public.invoice_requests (uuid_fiscal)
where uuid_fiscal is not null;

-- ============================================================
-- NORMALIZACIÓN
-- ============================================================

create or replace function public.normalize_passenger_billing_profile()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.taxpayer_name := nullif(btrim(new.taxpayer_name), '');
  new.rfc := upper(nullif(btrim(new.rfc), ''));
  new.tax_regime := nullif(btrim(new.tax_regime), '');
  new.fiscal_postal_code :=
    nullif(btrim(new.fiscal_postal_code), '');
  new.cfdi_use :=
    upper(coalesce(nullif(btrim(new.cfdi_use), ''), 'G03'));
  new.email :=
    lower(nullif(btrim(new.email), ''));
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  normalize_passenger_billing_profile_trigger
on public.passenger_billing_profiles;

create trigger
  normalize_passenger_billing_profile_trigger
before insert or update
on public.passenger_billing_profiles
for each row
execute function
  public.normalize_passenger_billing_profile();

-- ============================================================
-- PROTECCIÓN DE CAMPOS TIMBRADOS
-- ============================================================

create or replace function public.protect_issued_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'issued' then
    if new.payment_transaction_id
         is distinct from old.payment_transaction_id
      or new.trip_id is distinct from old.trip_id
      or new.passenger_id is distinct from old.passenger_id
      or new.taxpayer_name is distinct from old.taxpayer_name
      or new.rfc is distinct from old.rfc
      or new.tax_regime is distinct from old.tax_regime
      or new.fiscal_postal_code
         is distinct from old.fiscal_postal_code
      or new.cfdi_use is distinct from old.cfdi_use
      or new.subtotal is distinct from old.subtotal
      or new.tax_amount is distinct from old.tax_amount
      or new.total_amount is distinct from old.total_amount
      or new.uuid_fiscal is distinct from old.uuid_fiscal
    then
      raise exception
        'Una factura emitida no puede modificar sus datos fiscales';
    end if;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  protect_issued_invoice_trigger
on public.invoice_requests;

create trigger
  protect_issued_invoice_trigger
before update
on public.invoice_requests
for each row
execute function public.protect_issued_invoice();

-- ============================================================
-- SOLICITAR FACTURA
-- ============================================================

create or replace function public.request_trip_invoice(
  p_payment_transaction_id uuid,
  p_taxpayer_name text,
  p_rfc text,
  p_tax_regime text,
  p_fiscal_postal_code text,
  p_cfdi_use text default 'G03',
  p_billing_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_trip public.trips%rowtype;
  v_invoice_id uuid;
  v_rfc text;
  v_postal_code text;
  v_cfdi_use text;
begin
  v_rfc := upper(nullif(btrim(p_rfc), ''));
  v_postal_code :=
    nullif(btrim(p_fiscal_postal_code), '');
  v_cfdi_use :=
    upper(coalesce(nullif(btrim(p_cfdi_use), ''), 'G03'));

  if nullif(btrim(p_taxpayer_name), '') is null
    or v_rfc is null
    or nullif(btrim(p_tax_regime), '') is null
    or v_postal_code is null
  then
    raise exception
      'La información fiscal está incompleta';
  end if;

  if v_rfc !~
    '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
  then
    raise exception 'RFC inválido';
  end if;

  if v_postal_code !~ '^[0-9]{5}$' then
    raise exception 'Código postal fiscal inválido';
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = p_payment_transaction_id
  for update;

  if not found then
    raise exception 'El pago no existe';
  end if;

  if v_payment.passenger_id <> auth.uid()
    and not public.is_axi_finance()
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No autorizado';
  end if;

  if v_payment.status <> 'paid' then
    raise exception
      'El pago todavía no está liquidado';
  end if;

  select *
  into v_trip
  from public.trips
  where id = v_payment.trip_id;

  if not found then
    raise exception
      'El viaje relacionado con el pago no existe';
  end if;

  if v_trip.status <> 'completed' then
    raise exception
      'El viaje todavía no está completado';
  end if;

  insert into public.passenger_billing_profiles (
    passenger_id,
    taxpayer_name,
    rfc,
    tax_regime,
    fiscal_postal_code,
    cfdi_use,
    email,
    is_active
  )
  values (
    v_payment.passenger_id,
    btrim(p_taxpayer_name),
    v_rfc,
    btrim(p_tax_regime),
    v_postal_code,
    v_cfdi_use,
    lower(nullif(btrim(p_billing_email), '')),
    true
  )
  on conflict (passenger_id)
  do update set
    taxpayer_name = excluded.taxpayer_name,
    rfc = excluded.rfc,
    tax_regime = excluded.tax_regime,
    fiscal_postal_code = excluded.fiscal_postal_code,
    cfdi_use = excluded.cfdi_use,
    email = excluded.email,
    is_active = true,
    updated_at = now();

  insert into public.invoice_requests (
    payment_transaction_id,
    trip_id,
    passenger_id,
    status,
    taxpayer_name,
    rfc,
    tax_regime,
    fiscal_postal_code,
    cfdi_use,
    billing_email,
    currency,
    subtotal,
    tax_amount,
    total_amount,
    payment_method
  )
  values (
    v_payment.id,
    v_payment.trip_id,
    v_payment.passenger_id,
    'pending',
    btrim(p_taxpayer_name),
    v_rfc,
    btrim(p_tax_regime),
    v_postal_code,
    v_cfdi_use,
    lower(nullif(btrim(p_billing_email), '')),
    'MXN',
    round(coalesce(v_payment.total_amount, 0), 2),
    0,
    round(coalesce(v_payment.total_amount, 0), 2),
    v_payment.method
  )
  on conflict (payment_transaction_id)
  do update set
    taxpayer_name = excluded.taxpayer_name,
    rfc = excluded.rfc,
    tax_regime = excluded.tax_regime,
    fiscal_postal_code = excluded.fiscal_postal_code,
    cfdi_use = excluded.cfdi_use,
    billing_email = excluded.billing_email,
    status =
      case
        when invoice_requests.status in (
          'failed',
          'cancelled'
        )
        then 'pending'
        else invoice_requests.status
      end,
    error_code = null,
    error_message = null,
    failed_at = null,
    cancelled_at = null,
    updated_at = now()
  returning id
  into v_invoice_id;

  return v_invoice_id;
end;
$$;

-- ============================================================
-- ACTUALIZAR FACTURA DESDE FINANZAS / PAC
-- ============================================================

create or replace function public.update_invoice_status(
  p_invoice_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_request_id text default null,
  p_series text default null,
  p_folio text default null,
  p_uuid_fiscal text default null,
  p_xml_url text default null,
  p_pdf_url text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_provider_response jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice_requests%rowtype;
begin
  if not public.is_axi_finance()
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No autorizado';
  end if;

  if p_status not in (
    'processing',
    'issued',
    'failed',
    'cancelled'
  ) then
    raise exception
      'Estado de factura inválido';
  end if;

  select *
  into v_invoice
  from public.invoice_requests
  where id = p_invoice_id
  for update;

  if not found then
    raise exception
      'La factura no existe';
  end if;

  if v_invoice.status = 'issued'
    and p_status <> 'cancelled'
  then
    raise exception
      'La factura ya fue emitida';
  end if;

  if p_status = 'issued'
    and (
      nullif(btrim(p_uuid_fiscal), '') is null
      or nullif(btrim(p_xml_url), '') is null
      or nullif(btrim(p_pdf_url), '') is null
    )
  then
    raise exception
      'UUID, XML y PDF son obligatorios al emitir';
  end if;

  update public.invoice_requests
  set
    status = p_status,

    provider =
      coalesce(nullif(btrim(p_provider), ''), provider),

    provider_request_id =
      coalesce(
        nullif(btrim(p_provider_request_id), ''),
        provider_request_id
      ),

    provider_response =
      coalesce(p_provider_response, '{}'::jsonb),

    series =
      coalesce(nullif(btrim(p_series), ''), series),

    folio =
      coalesce(nullif(btrim(p_folio), ''), folio),

    uuid_fiscal =
      coalesce(
        nullif(btrim(p_uuid_fiscal), ''),
        uuid_fiscal
      ),

    xml_url =
      coalesce(nullif(btrim(p_xml_url), ''), xml_url),

    pdf_url =
      coalesce(nullif(btrim(p_pdf_url), ''), pdf_url),

    error_code =
      case
        when p_status = 'failed'
          then nullif(btrim(p_error_code), '')
        else null
      end,

    error_message =
      case
        when p_status = 'failed'
          then nullif(btrim(p_error_message), '')
        else null
      end,

    processing_started_at =
      case
        when p_status = 'processing'
          then coalesce(processing_started_at, now())
        else processing_started_at
      end,

    issued_at =
      case
        when p_status = 'issued'
          then coalesce(issued_at, now())
        else issued_at
      end,

    failed_at =
      case
        when p_status = 'failed'
          then now()
        else null
      end,

    cancelled_at =
      case
        when p_status = 'cancelled'
          then now()
        else cancelled_at
      end,

    updated_at = now()

  where id = p_invoice_id;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.passenger_billing_profiles
  enable row level security;

alter table public.invoice_requests
  enable row level security;

drop policy if exists
  passenger_billing_profiles_select_policy
on public.passenger_billing_profiles;

create policy
  passenger_billing_profiles_select_policy
on public.passenger_billing_profiles
for select
using (
  passenger_id = auth.uid()
  or public.is_axi_finance()
);

drop policy if exists
  passenger_billing_profiles_insert_policy
on public.passenger_billing_profiles;

create policy
  passenger_billing_profiles_insert_policy
on public.passenger_billing_profiles
for insert
with check (
  passenger_id = auth.uid()
  or public.is_axi_finance()
);

drop policy if exists
  passenger_billing_profiles_update_policy
on public.passenger_billing_profiles;

create policy
  passenger_billing_profiles_update_policy
on public.passenger_billing_profiles
for update
using (
  passenger_id = auth.uid()
  or public.is_axi_finance()
)
with check (
  passenger_id = auth.uid()
  or public.is_axi_finance()
);

drop policy if exists
  invoice_requests_select_policy
on public.invoice_requests;

create policy
  invoice_requests_select_policy
on public.invoice_requests
for select
using (
  passenger_id = auth.uid()
  or public.is_axi_finance()
);

-- No se permite insertar o modificar facturas directamente.
-- Todo pasa por las RPC.

revoke all
on public.passenger_billing_profiles
from anon;

revoke all
on public.invoice_requests
from anon;

grant select
on public.passenger_billing_profiles
to authenticated;

grant select
on public.invoice_requests
to authenticated;

revoke all
on function public.request_trip_invoice(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function public.request_trip_invoice(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

revoke all
on function public.update_invoice_status(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public;

grant execute
on function public.update_invoice_status(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to authenticated;

comment on table public.passenger_billing_profiles is
  'Datos fiscales reutilizables del pasajero';

comment on table public.invoice_requests is
  'Solicitudes, procesamiento y resultado de facturas CFDI';

comment on function public.request_trip_invoice(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Solicita una factura para un pago liquidado y guarda un snapshot fiscal';

comment on function public.update_invoice_status(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) is
  'Actualiza el procesamiento de una factura desde Finanzas o service_role';
