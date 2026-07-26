create or replace function public.finance_get_user_directory(
  requested_user_ids uuid[] default null,
  requested_role text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.profiles caller
    where caller.id = auth.uid()
      and caller.role::text in ('admin', 'finance')
      and caller.account_active = true
      and caller.blocked = false
  ) then
    raise exception
      'No tienes permiso para consultar el directorio financiero'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.full_name,
    auth_user.email::text,
    profile.role::text
  from public.profiles profile
  join auth.users auth_user
    on auth_user.id = profile.id
  where (
    requested_user_ids is null
    or profile.id = any(requested_user_ids)
  )
  and (
    requested_role is null
    or profile.role::text = requested_role
  )
  order by
    profile.full_name nulls last,
    auth_user.email;
end;
$function$;

revoke all
on function public.finance_get_user_directory(uuid[], text)
from public;

grant execute
on function public.finance_get_user_directory(uuid[], text)
to authenticated;
