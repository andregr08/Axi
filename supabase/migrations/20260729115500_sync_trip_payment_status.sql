-- ============================================================
-- AXI
-- Sincronización payment_transactions -> trips
--
-- Solo la transacción más reciente de cada viaje puede modificar
-- el estado de pago del viaje. Esto evita que un intento antiguo
-- fallido sobrescriba un pago posterior exitoso.
-- ============================================================

create or replace function public.sync_trip_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_latest_payment_id uuid;
begin
  if new.trip_id is null then
    return new;
  end if;

  /*
    Obtenemos la transacción más reciente del viaje.
    El ID sirve como desempate si dos registros tienen la misma fecha.
  */
  select pt.id
  into v_latest_payment_id
  from public.payment_transactions pt
  where pt.trip_id = new.trip_id
  order by pt.created_at desc, pt.id desc
  limit 1;

  /*
    Una transacción anterior no debe cambiar el estado actual del viaje.
  */
  if v_latest_payment_id is distinct from new.id then
    return new;
  end if;

  update public.trips
  set
    payment_method = new.method,

    payment_status =
      case new.status
        when 'pending' then 'pending'
        when 'processing' then 'processing'
        when 'paid' then 'paid'
        when 'failed' then 'failed'
        when 'refunded' then 'refunded'
        when 'cancelled' then 'cancelled'
        else payment_status
      end,

    payment_reference =
      coalesce(
        new.provider_payment_id,
        payment_reference
      ),

    paid_at =
      case
        when new.status = 'paid'
          then coalesce(new.paid_at, paid_at, now())
        when new.status in ('failed', 'cancelled')
          then null
        else paid_at
      end,

    updated_at = now()
  where id = new.trip_id;

  return new;
end;
$function$;

drop trigger if exists trg_sync_trip_payment_status
on public.payment_transactions;

create trigger trg_sync_trip_payment_status
after insert or update of
  status,
  method,
  provider_payment_id,
  paid_at
on public.payment_transactions
for each row
execute function public.sync_trip_payment_status();

comment on function public.sync_trip_payment_status() is
  'Sincroniza el estado del pago del viaje utilizando únicamente su transacción de pago más reciente.';

-- ============================================================
-- BACKFILL
-- Corrige los viajes existentes utilizando su pago más reciente.
-- ============================================================

with latest_payments as (
  select distinct on (pt.trip_id)
    pt.trip_id,
    pt.method,
    pt.status,
    pt.provider_payment_id,
    pt.paid_at
  from public.payment_transactions pt
  where pt.trip_id is not null
  order by
    pt.trip_id,
    pt.created_at desc,
    pt.id desc
)
update public.trips t
set
  payment_method = lp.method,

  payment_status =
    case lp.status
      when 'pending' then 'pending'
      when 'processing' then 'processing'
      when 'paid' then 'paid'
      when 'failed' then 'failed'
      when 'refunded' then 'refunded'
      when 'cancelled' then 'cancelled'
      else t.payment_status
    end,

  payment_reference =
    coalesce(
      lp.provider_payment_id,
      t.payment_reference
    ),

  paid_at =
    case
      when lp.status = 'paid'
        then coalesce(lp.paid_at, t.paid_at, now())
      when lp.status in ('failed', 'cancelled')
        then null
      else t.paid_at
    end,

  updated_at = now()
from latest_payments lp
where t.id = lp.trip_id
  and (
    t.payment_method is distinct from lp.method
    or t.payment_status is distinct from lp.status
    or (
      lp.status = 'paid'
      and t.paid_at is null
    )
  );

revoke all
on function public.sync_trip_payment_status()
from public;

grant execute
on function public.sync_trip_payment_status()
to authenticated, service_role;
