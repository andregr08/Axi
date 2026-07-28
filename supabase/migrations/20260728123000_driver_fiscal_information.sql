begin;

-- =========================================================
-- AXI: INFORMACIÓN FISCAL DEL CONDUCTOR
-- =========================================================

alter table public.driver_applications
  add column if not exists taxpayer_name text null,
  add column if not exists rfc text null,
  add column if not exists tax_regime text null,
  add column if not exists fiscal_postal_code text null,
  add column if not exists tax_document_url text null,
  add column if not exists tax_document_uploaded_at timestamptz null,
  add column if not exists tax_validation_status text
    not null default 'not_submitted',
  add column if not exists tax_validated_at timestamptz null,
  add column if not exists tax_validated_by uuid null
    references public.profiles(id)
    on delete set null,
  add column if not exists tax_rejection_reason text null;

-- Normalizar datos existentes antes de crear restricciones.
update public.driver_applications
set
  taxpayer_name = nullif(btrim(taxpayer_name), ''),
  rfc = upper(nullif(btrim(rfc), '')),
  tax_regime = nullif(btrim(tax_regime), ''),
  fiscal_postal_code = nullif(btrim(fiscal_postal_code), ''),
  tax_document_url = nullif(btrim(tax_document_url), ''),
  tax_rejection_reason = nullif(btrim(tax_rejection_reason), '');

-- Estado fiscal permitido.
alter table public.driver_applications
  drop constraint if exists
    driver_applications_tax_validation_status_check;

alter table public.driver_applications
  add constraint
    driver_applications_tax_validation_status_check
  check (
    tax_validation_status in (
      'not_submitted',
      'pending',
      'verified',
      'rejected'
    )
  );

-- RFC de persona física o moral: 12 o 13 caracteres.
alter table public.driver_applications
  drop constraint if exists
    driver_applications_rfc_format_check;

alter table public.driver_applications
  add constraint
    driver_applications_rfc_format_check
  check (
    rfc is null
    or rfc ~
      '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
  );

-- Código postal fiscal mexicano.
alter table public.driver_applications
  drop constraint if exists
    driver_applications_fiscal_postal_code_check;

alter table public.driver_applications
  add constraint
    driver_applications_fiscal_postal_code_check
  check (
    fiscal_postal_code is null
    or fiscal_postal_code ~ '^[0-9]{5}$'
  );

-- Evitar RFC duplicado entre solicitudes distintas.
create unique index if not exists
  driver_applications_rfc_unique_idx
on public.driver_applications (upper(rfc))
where rfc is not null;

create index if not exists
  driver_applications_tax_status_idx
on public.driver_applications (
  tax_validation_status,
  created_at desc
);

create index if not exists
  driver_applications_fiscal_search_idx
on public.driver_applications (
  upper(rfc),
  fiscal_postal_code
);

comment on column public.driver_applications.taxpayer_name is
  'Nombre o razón social registrado ante el SAT';

comment on column public.driver_applications.rfc is
  'RFC del conductor o contribuyente, normalizado en mayúsculas';

comment on column public.driver_applications.tax_regime is
  'Régimen fiscal indicado en la constancia de situación fiscal';

comment on column public.driver_applications.fiscal_postal_code is
  'Código postal del domicilio fiscal';

comment on column public.driver_applications.tax_document_url is
  'Ruta privada de la constancia de situación fiscal dentro de driver-documents';

comment on column public.driver_applications.tax_validation_status is
  'Estado de revisión fiscal: not_submitted, pending, verified o rejected';

commit;
