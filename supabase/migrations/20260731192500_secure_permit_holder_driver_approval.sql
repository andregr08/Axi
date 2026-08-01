-- =========================================================
-- AXI: BLOQUEO DE APROBACIÓN PARA CONDUCTORES
-- QUE TRABAJAN CON UN PERMISIONARIO
-- =========================================================

create or replace function
  public.approve_driver_application(
    application_id uuid
  )
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  application_record
    public.driver_applications%rowtype;

  authorization_record
    public.permit_holder_authorizations%rowtype;
begin
  if public.get_current_user_role() <> 'admin' then
    raise exception
      'No tienes permiso para aprobar conductores';
  end if;

  select *
  into application_record
  from public.driver_applications
  where id = application_id
  for update;

  if not found then
    raise exception
      'La solicitud no existe';
  end if;

  if application_record.status <> 'pending' then
    raise exception
      'La solicitud ya fue revisada';
  end if;

  if application_record.documents_complete is not true then
    raise exception
      'Los documentos están incompletos';
  end if;

  if application_record.face_match_status <> 'matched' then
    raise exception
      'Primero debes confirmar que el rostro coincide';
  end if;

  -- =====================================================
  -- AUTORIZACIÓN EXTERNA DEL PERMISIONARIO
  --
  -- Solo se exige cuando el conductor declaró
  -- expresamente que NO es titular.
  --
  -- Las solicitudes anteriores, cuyo valor sea NULL,
  -- conservan el comportamiento existente.
  -- =====================================================

  if application_record.is_concession_holder is false then
    select *
    into authorization_record
    from public.permit_holder_authorizations
    where driver_application_id = application_id
    for update;

    if not found then
      raise exception
        'Falta la autorización del permisionario';
    end if;

    if authorization_record.status <> 'authorized' then
      raise exception
        'El permisionario todavía no ha autorizado al conductor';
    end if;

    if authorization_record.authorized_at is null then
      raise exception
        'La autorización del permisionario no tiene fecha de confirmación';
    end if;

    if nullif(
      btrim(
        coalesce(
          authorization_record.holder_identification_url,
          ''
        )
      ),
      ''
    ) is null then
      raise exception
        'Falta la identificación oficial del permisionario';
    end if;

    if nullif(
      btrim(
        coalesce(
          authorization_record.holder_concession_document_url,
          ''
        )
      ),
      ''
    ) is null then
      raise exception
        'Falta el permiso o concesión del permisionario';
    end if;

    if authorization_record.no_expiration is not true then
      if authorization_record.authorization_expires_on is null then
        raise exception
          'La autorización del permisionario no tiene vigencia';
      end if;

      if authorization_record.authorization_expires_on < current_date then
        raise exception
          'La autorización del permisionario está vencida';
      end if;
    end if;
  end if;

  -- =====================================================
  -- APROBACIÓN ORIGINAL DE AXI
  -- =====================================================

  insert into public.drivers (
    id,
    license_number,
    license_expiration,
    status,
    verified,
    online
  )
  values (
    application_record.user_id,
    application_record.license_number,
    application_record.license_expiration,
    'active',
    true,
    false
  )
  on conflict (id) do update
  set
    license_number =
      excluded.license_number,

    license_expiration =
      excluded.license_expiration,

    status = 'active',

    verified = true,

    updated_at = now();

  update public.profiles
  set
    role = 'driver',

    avatar_url =
      application_record.profile_photo_url,

    updated_at = now()
  where id =
    application_record.user_id;

  update public.driver_applications
  set
    status = 'approved',

    reviewed_by = auth.uid(),

    reviewed_at = now(),

    rejection_reason = null,

    updated_at = now()
  where id = application_id;
end;
$function$;