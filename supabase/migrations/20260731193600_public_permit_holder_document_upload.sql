-- =========================================================
-- AXI: CARGA PUBLICA SEGURA DE DOCUMENTOS DEL PERMISIONARIO
-- SIN UTILIZAR SUPABASE_SERVICE_ROLE_KEY
-- =========================================================

-- Bucket privado y exclusivo para los dos documentos
-- entregados por el titular del permiso o concesion.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'permit-holder-documents',
  'permit-holder-documents',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- =========================================================
-- VALIDACION DEL NOMBRE Y TOKEN DEL ARCHIVO
--
-- Solamente permite exactamente estas dos rutas:
--
-- <token>/identification
-- <token>/concession
--
-- El token debe pertenecer a una autorizacion pendiente
-- cuya vigencia no haya terminado.
-- =========================================================

create or replace function
  public.can_upload_permit_holder_document(
    p_object_name text
  )
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_token_text text;
  v_document_name text;
begin
  if p_object_name is null then
    return false;
  end if;

  if p_object_name !~ '^[^/]+/[^/]+$' then
    return false;
  end if;

  v_token_text :=
    split_part(
      p_object_name,
      '/',
      1
    );

  v_document_name :=
    split_part(
      p_object_name,
      '/',
      2
    );

  if v_token_text !~* (
    '^[0-9a-f]{8}-'
    || '[0-9a-f]{4}-'
    || '[1-5][0-9a-f]{3}-'
    || '[89ab][0-9a-f]{3}-'
    || '[0-9a-f]{12}$'
  ) then
    return false;
  end if;

  if v_document_name not in (
    'identification',
    'concession'
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.permit_holder_authorizations
    where authorization_token::text =
      v_token_text

      and status = 'pending'

      and (
        no_expiration is true

        or (
          authorization_expires_on
            is not null

          and authorization_expires_on
            >= current_date
        )
      )
  );
end;
$function$;

revoke all
on function
  public.can_upload_permit_holder_document(text)
from public;

grant execute
on function
  public.can_upload_permit_holder_document(text)
to anon, authenticated;


-- =========================================================
-- POLITICAS DEL BUCKET PRIVADO
-- =========================================================

drop policy if exists
  "Permit holders upload authorization documents"
on storage.objects;

create policy
  "Permit holders upload authorization documents"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id =
    'permit-holder-documents'

  and public
    .can_upload_permit_holder_document(
      name
    )
);


drop policy if exists
  "Permit holders replace pending authorization documents"
on storage.objects;

create policy
  "Permit holders replace pending authorization documents"
on storage.objects
for update
to anon, authenticated
using (
  bucket_id =
    'permit-holder-documents'

  and public
    .can_upload_permit_holder_document(
      name
    )
)
with check (
  bucket_id =
    'permit-holder-documents'

  and public
    .can_upload_permit_holder_document(
      name
    )
);


drop policy if exists
  "Permit holders delete pending authorization documents"
on storage.objects;

create policy
  "Permit holders delete pending authorization documents"
on storage.objects
for delete
to anon, authenticated
using (
  bucket_id =
    'permit-holder-documents'

  and public
    .can_upload_permit_holder_document(
      name
    )
);


drop policy if exists
  "Admins view permit holder documents"
on storage.objects;

create policy
  "Admins view permit holder documents"
on storage.objects
for select
to authenticated
using (
  bucket_id =
    'permit-holder-documents'

  and public
    .get_current_user_role()::text =
      'admin'
);


-- =========================================================
-- CONFIRMACION PUBLICA DE LA AUTORIZACION
--
-- La funcion comprueba:
-- 1. Token existente y pendiente.
-- 2. Vigencia valida.
-- 3. Rutas pertenecientes al mismo token.
-- 4. Existencia real de ambos objetos en Storage.
-- =========================================================

create or replace function
  public.authorize_permit_holder_public(
    p_token uuid,
    p_identification_path text,
    p_concession_document_path text,
    p_declaration_accepted boolean
  )
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_authorization
    public.permit_holder_authorizations%rowtype;

  v_expected_identification_path text;
  v_expected_concession_path text;
begin
  if p_declaration_accepted is not true then
    raise exception
      'Debes aceptar la declaracion de autorizacion';
  end if;

  select *
  into v_authorization
  from public.permit_holder_authorizations
  where authorization_token =
    p_token
  for update;

  if not found then
    raise exception
      'La autorizacion no existe';
  end if;

  if v_authorization.status <>
    'pending' then
    raise exception
      'La autorizacion ya no esta pendiente';
  end if;

  if (
    v_authorization.no_expiration
      is not true

    and (
      v_authorization
        .authorization_expires_on
          is null

      or v_authorization
        .authorization_expires_on
          < current_date
    )
  ) then
    update public
      .permit_holder_authorizations
    set
      status = 'expired',
      updated_at = now()
    where id =
      v_authorization.id;

    raise exception
      'La autorizacion esta vencida';
  end if;

  v_expected_identification_path :=
    p_token::text
    || '/identification';

  v_expected_concession_path :=
    p_token::text
    || '/concession';

  if p_identification_path <>
    v_expected_identification_path then
    raise exception
      'La ruta de la identificacion no es valida';
  end if;

  if p_concession_document_path <>
    v_expected_concession_path then
    raise exception
      'La ruta de la concesion no es valida';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id =
      'permit-holder-documents'

      and name =
        v_expected_identification_path
  ) then
    raise exception
      'No se encontro la identificacion oficial';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id =
      'permit-holder-documents'

      and name =
        v_expected_concession_path
  ) then
    raise exception
      'No se encontro el permiso o concesion';
  end if;

  update public
    .permit_holder_authorizations
  set
    holder_identification_url =
      v_expected_identification_path,

    holder_concession_document_url =
      v_expected_concession_path,

    status = 'authorized',

    authorized_at = now(),

    updated_at = now()
  where id =
    v_authorization.id;
end;
$function$;

revoke all
on function
  public.authorize_permit_holder_public(
    uuid,
    text,
    text,
    boolean
  )
from public;

grant execute
on function
  public.authorize_permit_holder_public(
    uuid,
    text,
    text,
    boolean
  )
to anon, authenticated;