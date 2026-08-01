-- =========================================================
-- AXI: USO AUTOMÁTICO DEL SALDO DEL PASAJERO EN VIAJES
--
-- Reglas:
-- 1. El saldo AXI solo cubre la participación de AXI.
-- 2. Nunca reduce la ganancia del conductor.
-- 3. Nunca cubre la propina.
-- 4. En efectivo reduce la deuda que el conductor debe a AXI.
-- 5. En pagos digitales reduce lo que se cobra al proveedor.
-- 6. Si el pago digital falla, el saldo vuelve al pasajero.
-- =========================================================

alter table public.payment_transactions
  add column if not exists passenger_wallet_applied numeric(12,2)
  not null default 0;

alter table public.payment_transactions
  add column if not exists external_amount numeric(12,2)
  not null default 0;

alter table public.payment_transactions
  add column if not exists passenger_wallet_transaction_id uuid null
  references public.passenger_wallet_transactions(id)
  on delete set null;

alter table public.payment_transactions
  add column if not exists passenger_wallet_reversed_at timestamptz null;

alter table public.trips
  add column if not exists wallet_credit_used numeric(12,2)
  not null default 0;

update public.payment_transactions
set external_amount = total_amount
where external_amount = 0
  and total_amount > 0
  and passenger_wallet_applied = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'payment_transactions_passenger_wallet_applied_check'
      and conrelid =
        'public.payment_transactions'::regclass
  ) then
    alter table public.payment_transactions
      add constraint
        payment_transactions_passenger_wallet_applied_check
      check (passenger_wallet_applied >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'payment_transactions_external_amount_check'
      and conrelid =
        'public.payment_transactions'::regclass
  ) then
    alter table public.payment_transactions
      add constraint
        payment_transactions_external_amount_check
      check (external_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'payment_transactions_wallet_limit_check'
      and conrelid =
        'public.payment_transactions'::regclass
  ) then
    alter table public.payment_transactions
      add constraint
        payment_transactions_wallet_limit_check
      check (
        passenger_wallet_applied <= platform_commission
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'payment_transactions_external_total_check'
      and conrelid =
        'public.payment_transactions'::regclass
  ) then
    alter table public.payment_transactions
      add constraint
        payment_transactions_external_total_check
      check (
        round(
          external_amount + passenger_wallet_applied,
          2
        ) = round(total_amount, 2)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_wallet_credit_used_check'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_wallet_credit_used_check
      check (wallet_credit_used >= 0);
  end if;
end
$$;

create index if not exists
  payment_transactions_passenger_wallet_idx
on public.payment_transactions(
  passenger_id,
  passenger_wallet_applied
)
where passenger_wallet_applied > 0;

-- =========================================================
-- CREAR PAGO DEL VIAJE
-- =========================================================

create or replace function public.create_trip_payment(
  requested_trip_id uuid,
  selected_method text default 'cash'::text,
  selected_tip numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_trip public.trips%rowtype;
  v_existing public.payment_transactions%rowtype;
  v_passenger_wallet public.passenger_wallets%rowtype;

  v_existing_found boolean := false;
  v_is_retry boolean := false;

  v_transaction_id uuid;
  v_passenger_wallet_transaction_id uuid;

  v_total numeric(12,2);
  v_driver_earnings numeric(12,2);
  v_platform_commission numeric(12,2);

  v_passenger_wallet_applied numeric(12,2) := 0;
  v_external_amount numeric(12,2) := 0;
  v_cash_debt_created numeric(12,2) := 0;
begin
  if selected_method not in (
    'cash',
    'card',
    'mercado_pago'
  ) then
    raise exception 'Método de pago inválido';
  end if;

  selected_tip :=
    round(coalesce(selected_tip, 0)::numeric, 2);

  if selected_tip < 0 then
    raise exception 'La propina no puede ser negativa';
  end if;

  select *
  into v_trip
  from public.trips
  where id = requested_trip_id
  for update;

  if not found then
    raise exception 'El viaje no existe';
  end if;

  if v_trip.status <> 'completed' then
    raise exception 'El viaje todavía no está completado';
  end if;

  if v_trip.driver_id is null then
    raise exception 'El viaje no tiene conductor';
  end if;

  if v_trip.passenger_id <> auth.uid()
    and not public.is_axi_finance()
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;

  v_total :=
    round(
      coalesce(v_trip.final_price, 0)
      + selected_tip,
      2
    );

  v_platform_commission :=
    round(
      coalesce(v_trip.platform_commission, 0),
      2
    );

  v_driver_earnings :=
    round(
      coalesce(v_trip.driver_earnings, 0)
      + selected_tip,
      2
    );

  insert into public.passenger_wallets (
    passenger_id
  )
  values (
    v_trip.passenger_id
  )
  on conflict (passenger_id)
  do nothing;

  select *
  into v_passenger_wallet
  from public.passenger_wallets
  where passenger_id = v_trip.passenger_id
  for update;

  select *
  into v_existing
  from public.payment_transactions
  where trip_id = requested_trip_id
  for update;

  v_existing_found := found;

  if v_existing_found
    and v_existing.wallet_applied_at is not null
    and v_existing.status not in (
      'failed',
      'cancelled'
    ) then

    if v_existing.method <> selected_method
      or round(v_existing.tip_amount, 2)
        <> selected_tip
      or round(v_existing.driver_earnings, 2)
        <> v_driver_earnings
      or round(v_existing.platform_commission, 2)
        <> v_platform_commission then

      raise exception
        'El pago ya fue aplicado al wallet y no puede modificarse';
    end if;

    return v_existing.id;
  end if;

  v_is_retry :=
    v_existing_found
    and v_existing.status in (
      'failed',
      'cancelled'
    );

  v_passenger_wallet_applied :=
    round(
      least(
        coalesce(
          v_passenger_wallet.available_balance,
          0
        ),
        v_platform_commission
      ),
      2
    );

  v_external_amount :=
    round(
      v_total - v_passenger_wallet_applied,
      2
    );

  v_cash_debt_created :=
    round(
      greatest(
        v_platform_commission
        - v_passenger_wallet_applied,
        0
      ),
      2
    );

  insert into public.payment_transactions (
    trip_id,
    passenger_id,
    driver_id,
    method,
    status,
    subtotal,
    booking_fee,
    tip_amount,
    total_amount,
    platform_commission,
    driver_earnings,
    passenger_wallet_applied,
    external_amount,
    passenger_wallet_transaction_id,
    passenger_wallet_reversed_at,
    provider,
    provider_payment_id,
    failure_reason,
    paid_at,
    refunded_at,
    wallet_applied_at,
    wallet_released_at,
    wallet_reversed_at,
    earnings_counted_at
  )
  values (
    v_trip.id,
    v_trip.passenger_id,
    v_trip.driver_id,
    selected_method,

    case
      when selected_method = 'cash'
        then 'paid'
      else 'pending'
    end,

    coalesce(v_trip.fare_subtotal, 0),
    coalesce(v_trip.booking_fee, 0),
    selected_tip,
    v_total,
    v_platform_commission,
    v_driver_earnings,
    v_passenger_wallet_applied,
    v_external_amount,
    null,
    null,

    case
      when selected_method = 'mercado_pago'
        then 'mercado_pago'
      when selected_method = 'card'
        then 'card_provider'
      else 'cash'
    end,

    null,
    null,

    case
      when selected_method = 'cash'
        then now()
      else null
    end,

    null,
    null,
    null,
    null,
    null
  )
  on conflict (trip_id)
  do update set
    method = excluded.method,
    status = excluded.status,
    subtotal = excluded.subtotal,
    booking_fee = excluded.booking_fee,
    tip_amount = excluded.tip_amount,
    total_amount = excluded.total_amount,
    platform_commission =
      excluded.platform_commission,
    driver_earnings = excluded.driver_earnings,
    passenger_wallet_applied =
      excluded.passenger_wallet_applied,
    external_amount = excluded.external_amount,
    passenger_wallet_transaction_id = null,
    passenger_wallet_reversed_at = null,
    provider = excluded.provider,
    provider_payment_id = null,
    failure_reason = null,
    paid_at = excluded.paid_at,
    refunded_at = null,
    wallet_applied_at = null,
    wallet_released_at = null,
    wallet_reversed_at = null,
    earnings_counted_at = null,
    updated_at = now()
  returning id
  into v_transaction_id;

  if v_passenger_wallet_applied > 0 then
    v_passenger_wallet_transaction_id :=
      public.apply_passenger_wallet_movement(
        p_passenger_id =>
          v_trip.passenger_id,

        p_amount =>
          -v_passenger_wallet_applied,

        p_transaction_type =>
          'trip_payment',

        p_description =>
          'Saldo AXI utilizado en un viaje',

        p_trip_id =>
          v_trip.id,

        p_refund_request_id =>
          null,

        p_metadata =>
          jsonb_build_object(
            'payment_transaction_id',
            v_transaction_id,

            'gross_total',
            v_total,

            'wallet_applied',
            v_passenger_wallet_applied,

            'external_amount',
            v_external_amount,

            'platform_commission',
            v_platform_commission,

            'driver_earnings',
            v_driver_earnings,

            'tip_amount',
            selected_tip,

            'retry',
            v_is_retry
          )
      );

    update public.payment_transactions
    set
      passenger_wallet_transaction_id =
        v_passenger_wallet_transaction_id,
      updated_at = now()
    where id = v_transaction_id;
  end if;

  insert into public.driver_wallets (
    driver_id
  )
  values (
    v_trip.driver_id
  )
  on conflict (driver_id)
  do nothing;

  if selected_method = 'cash' then
    perform public.apply_wallet_movement(
      p_driver_id =>
        v_trip.driver_id,

      p_balance_type =>
        'cash_debt',

      p_amount =>
        v_cash_debt_created,

      p_transaction_type =>
        'cash_trip_commission',

      p_trip_id =>
        v_trip.id,

      p_payment_transaction_id =>
        v_transaction_id,

      p_description =>
        case
          when v_passenger_wallet_applied > 0 then
            'Participación restante de AXI después de aplicar saldo del pasajero'
          else
            'Participación de AXI por viaje pagado en efectivo'
        end,

      p_metadata =>
        jsonb_build_object(
          'payment_method',
          selected_method,

          'gross_total',
          v_total,

          'external_amount',
          v_external_amount,

          'passenger_wallet_applied',
          v_passenger_wallet_applied,

          'original_platform_commission',
          v_platform_commission,

          'cash_debt_created',
          v_cash_debt_created,

          'driver_earnings',
          v_driver_earnings
        ),

      p_lifetime_earnings_delta =>
        v_driver_earnings,

      p_total_withdrawn_delta =>
        0
    );

    update public.payment_transactions
    set
      wallet_applied_at = now(),
      earnings_counted_at = now(),
      updated_at = now()
    where id = v_transaction_id;

  else
    perform public.apply_wallet_movement(
      p_driver_id =>
        v_trip.driver_id,

      p_balance_type =>
        'pending',

      p_amount =>
        v_driver_earnings,

      p_transaction_type =>
        case
          when v_is_retry
            then 'digital_earning_reopened'
          else 'digital_earning_pending'
        end,

      p_trip_id =>
        v_trip.id,

      p_payment_transaction_id =>
        v_transaction_id,

      p_description =>
        'Ganancia pendiente de confirmación del proveedor',

      p_metadata =>
        jsonb_build_object(
          'payment_method',
          selected_method,

          'gross_total',
          v_total,

          'external_amount',
          v_external_amount,

          'passenger_wallet_applied',
          v_passenger_wallet_applied,

          'platform_commission',
          v_platform_commission,

          'driver_earnings',
          v_driver_earnings,

          'retry',
          v_is_retry
        ),

      p_lifetime_earnings_delta =>
        0,

      p_total_withdrawn_delta =>
        0
    );

    update public.payment_transactions
    set
      wallet_applied_at = now(),
      wallet_reversed_at = null,
      updated_at = now()
    where id = v_transaction_id;
  end if;

  update public.trips
  set
    payment_method = selected_method,

    payment_status =
      case
        when selected_method = 'cash'
          then 'paid'
        else 'pending'
      end,

    tip_amount = selected_tip,
    wallet_credit_used =
      v_passenger_wallet_applied,
    amount_due = v_external_amount,

    paid_at =
      case
        when selected_method = 'cash'
          then now()
        else null
      end,

    payment_reference = null,
    updated_at = now()
  where id = requested_trip_id;

  insert into public.trip_events (
    trip_id,
    status,
    description,
    created_by
  )
  values (
    requested_trip_id,
    'completed',

    format(
      'Pago generado. Método: %s. Total: $%s. Saldo AXI: $%s. Restante: $%s',
      selected_method,
      v_total,
      v_passenger_wallet_applied,
      v_external_amount
    ),

    auth.uid()
  );

  return v_transaction_id;
end;
$function$;

-- =========================================================
-- IMPEDIR CONFIRMAR UN PAGO DESPUÉS DE DEVOLVER SU SALDO
-- Primero debe crearse un nuevo intento de pago.
-- =========================================================

create or replace function
public.guard_reversed_passenger_wallet_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'paid'
    and old.status is distinct from 'paid'
    and old.passenger_wallet_applied > 0
    and old.passenger_wallet_reversed_at is not null then

    raise exception
      'El saldo AXI de este intento ya fue devuelto. Genera un nuevo intento de pago.';
  end if;

  return new;
end;
$function$;

drop trigger if exists
  guard_reversed_passenger_wallet_payment_trigger
on public.payment_transactions;

create trigger
  guard_reversed_passenger_wallet_payment_trigger
before update of status
on public.payment_transactions
for each row
execute function
  public.guard_reversed_passenger_wallet_payment();

-- =========================================================
-- DEVOLVER SALDO AXI SI FALLA O SE CANCELA UN PAGO DIGITAL
-- =========================================================

create or replace function
public.restore_passenger_wallet_after_payment_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_reversal_transaction_id uuid;
begin
  if new.method not in (
      'card',
      'mercado_pago'
    )
    or new.status not in (
      'failed',
      'cancelled'
    )
    or old.status is not distinct from new.status
    or coalesce(new.passenger_wallet_applied, 0) <= 0
    or new.passenger_wallet_reversed_at is not null then

    return new;
  end if;

  v_reversal_transaction_id :=
    public.apply_passenger_wallet_movement(
      p_passenger_id =>
        new.passenger_id,

      p_amount =>
        new.passenger_wallet_applied,

      p_transaction_type =>
        'reversal',

      p_description =>
        'Devolución de saldo AXI por pago fallido o cancelado',

      p_trip_id =>
        new.trip_id,

      p_refund_request_id =>
        null,

      p_metadata =>
        jsonb_build_object(
          'payment_transaction_id',
          new.id,

          'original_wallet_transaction_id',
          new.passenger_wallet_transaction_id,

          'wallet_restored',
          new.passenger_wallet_applied,

          'payment_status',
          new.status,

          'failure_reason',
          new.failure_reason
        )
    );

  update public.payment_transactions
  set
    passenger_wallet_reversed_at = now(),
    updated_at = now()
  where id = new.id;

  update public.trips
  set
    wallet_credit_used = 0,
    amount_due =
      round(
        coalesce(final_price, 0)
        + coalesce(tip_amount, 0),
        2
      ),
    updated_at = now()
  where id = new.trip_id;

  perform public.log_finance_event(
    'passenger_wallet_payment_reversed',
    new.id::text,
    jsonb_build_object(
      'trip_id',
      new.trip_id,

      'passenger_id',
      new.passenger_id,

      'wallet_amount',
      new.passenger_wallet_applied,

      'wallet_reversal_transaction_id',
      v_reversal_transaction_id,

      'payment_status',
      new.status
    )
  );

  return new;
end;
$function$;

drop trigger if exists
  restore_passenger_wallet_after_payment_failure_trigger
on public.payment_transactions;

create trigger
  restore_passenger_wallet_after_payment_failure_trigger
after update of status
on public.payment_transactions
for each row
execute function
  public.restore_passenger_wallet_after_payment_failure();

revoke all
on function public.guard_reversed_passenger_wallet_payment()
from public, anon, authenticated;

revoke all
on function public.restore_passenger_wallet_after_payment_failure()
from public, anon, authenticated;

revoke all
on function public.create_trip_payment(
  uuid,
  text,
  numeric
)
from public, anon;

grant execute
on function public.create_trip_payment(
  uuid,
  text,
  numeric
)
to authenticated, service_role;
