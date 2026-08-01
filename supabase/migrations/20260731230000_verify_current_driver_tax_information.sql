begin;

create or replace function
public.verify_driver_tax_information_current(
  application_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  application_record
    public.driver_applications%rowtype;
begin
  if not public.is_driver_tax_admin() then
    raise exception
      'Solo Administracion puede validar informacion fiscal'
      using errcode = '42501';
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

  if application_record.status <> 'pending' then
    raise exception
      'La solicitud ya fue procesada';
  end if;

  if nullif(
       btrim(application_record.rfc),
       ''
     ) is null
     or nullif(
       btrim(application_record.fiscal_name),
       ''
     ) is null
     or nullif(
       btrim(application_record.fiscal_postal_code),
       ''
     ) is null
     or nullif(
       btrim(application_record.tax_regime_code),
       ''
     ) is null
     or nullif(
       btrim(application_record.tax_certificate_url),
       ''
     ) is null then
    raise exception
      'La informacion fiscal esta incompleta';
  end if;

  update public.driver_applications
  set
    tax_validation_status =
      'verified',

    tax_validated_at =
      now(),

    tax_validated_by =
      auth.uid(),

    tax_rejection_reason =
      null

  where id = application_id;
end;
$function$;

revoke all
on function
public.verify_driver_tax_information_current(
  uuid
)
from public, anon, authenticated;

grant execute
on function
public.verify_driver_tax_information_current(
  uuid
)
to authenticated;

commit;