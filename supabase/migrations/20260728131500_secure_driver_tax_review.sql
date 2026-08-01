begin;

-- =========================================================
-- AXI: REVISIÓN FISCAL SEGURA DEL CONDUCTOR
-- =========================================================

create or replace function public.is_driver_tax_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role::text = 'admin'
  );
$function$;

revoke all
on function public.is_driver_tax_admin()
from public;

grant execute
on function public.is_driver_tax_admin()
to authenticated;

-- Evita que un conductor pueda marcar sus propios datos como verificados.
create or replace function public.protect_driver_tax_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  caller_is_admin boolean;
  fiscal_information_changed boolean;
begin
  caller_is_admin := public.is_driver_tax_admin();

  if caller_is_admin then
    return new;
  end if;

  if auth.uid() is null then
    raise exception
      'Debes iniciar sesión para modificar información fiscal'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception
      'No puedes modificar la información fiscal de otro conductor'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.tax_validation_status not in (
      'not_submitted',
      'pending'
    ) then
      raise exception
        'El estado fiscal inicial debe ser pendiente'
        using errcode = '42501';
    end if;

    new.tax_validated_at := null;
    new.tax_validated_by := null;
    new.tax_rejection_reason := null;

    return new;
  end if;

  fiscal_information_changed :=
    new.taxpayer_name is distinct from old.taxpayer_name
    or new.rfc is distinct from old.rfc
    or new.tax_regime is distinct from old.tax_regime
    or new.fiscal_postal_code is distinct from old.fiscal_postal_code
    or new.tax_document_url is distinct from old.tax_document_url;

  if fiscal_information_changed then
    new.tax_validation_status := 'pending';
    new.tax_validated_at := null;
    new.tax_validated_by := null;
    new.tax_rejection_reason := null;

    if new.tax_document_url is distinct from old.tax_document_url then
      new.tax_document_uploaded_at := now();
    end if;
  else
    -- Un conductor no puede cambiar los resultados de la revisión.
    new.tax_validation_status :=
      old.tax_validation_status;

    new.tax_validated_at :=
      old.tax_validated_at;

    new.tax_validated_by :=
      old.tax_validated_by;

    new.tax_rejection_reason :=
      old.tax_rejection_reason;
  end if;

  return new;
end;
$function$;

drop trigger if exists
  protect_driver_tax_review_fields_trigger
on public.driver_applications;

create trigger
  protect_driver_tax_review_fields_trigger
before insert or update
on public.driver_applications
for each row
execute function
  public.protect_driver_tax_review_fields();

-- RPC exclusiva de Administración para validar o rechazar.
create or replace function public.review_driver_tax_information(
  application_id uuid,
  review_status text,
  rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  application_record public.driver_applications%rowtype;
  clean_reason text;
begin
  if not public.is_driver_tax_admin() then
    raise exception
      'Solo Administración puede revisar información fiscal'
      using errcode = '42501';
  end if;

  if review_status not in ('verified', 'rejected') then
    raise exception
      'El resultado fiscal debe ser verified o rejected';
  end if;

  clean_reason := nullif(btrim(rejection_reason), '');

  if review_status = 'rejected'
     and clean_reason is null then
    raise exception
      'Debes indicar el motivo del rechazo fiscal';
  end if;

  select *
  into application_record
  from public.driver_applications
  where id = application_id
  for update;

  if not found then
    raise exception
      'La solicitud del conductor no existe';
  end if;

  if application_record.taxpayer_name is null
     or application_record.rfc is null
     or application_record.tax_regime is null
     or application_record.fiscal_postal_code is null
     or application_record.tax_document_url is null then
    raise exception
      'La información fiscal está incompleta';
  end if;

  update public.driver_applications
  set
    tax_validation_status = review_status,
    tax_validated_at = now(),
    tax_validated_by = auth.uid(),
    tax_rejection_reason = case
      when review_status = 'rejected'
        then clean_reason
      else null
    end
  where id = application_id;
end;
$function$;

revoke all
on function public.review_driver_tax_information(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.review_driver_tax_information(
  uuid,
  text,
  text
)
to authenticated;

-- Bloqueo definitivo: ni una RPC ni una edición directa puede
-- aprobar al conductor sin validación fiscal.
create or replace function public.require_verified_driver_tax_information()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'approved'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'approved'
     )
     and new.tax_validation_status is distinct from 'verified' then
    raise exception
      'No se puede aprobar al conductor sin validar su información fiscal';
  end if;

  return new;
end;
$function$;

drop trigger if exists
  require_verified_driver_tax_information_trigger
on public.driver_applications;

create trigger
  require_verified_driver_tax_information_trigger
before insert or update of status
on public.driver_applications
for each row
execute function
  public.require_verified_driver_tax_information();

commit;
