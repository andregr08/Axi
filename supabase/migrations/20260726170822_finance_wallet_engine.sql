begin;

-- =========================================================
-- MOTOR FINANCIERO DE AXI
-- 100% cobrado por AXI / 80% conductor / 20% plataforma
-- =========================================================

alter table public.driver_wallets
  add column if not exists reserved_balance numeric(12,2)
  not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_wallets_reserved_balance_check'
      and conrelid = 'public.driver_wallets'::regclass
  ) then
    alter table public.driver_wallets
      add constraint driver_wallets_reserved_balance_check
      check (reserved_balance >= 0);
  end if;
end;
$$;

alter table public.payment_transactions
  add column if not exists wallet_released_at timestamptz,
  add column if not exists wallet_reversed_at timestamptz,
  add column if not exists earnings_counted_at timestamptz;

alter table public.withdraw_requests
  add column if not exists reserved_at timestamptz,
  add column if not exists provider_reference text,
  add column if not exists failure_reason text;

alter table public.withdraw_requests
  drop constraint if exists withdraw_requests_status_check;

alter table public.withdraw_requests
  add constraint withdraw_requests_status_check
  check (
    status in (
      'pending',
      'approved',
      'processing',
      'paid',
      'failed',
      'rejected',
      'cancelled'
    )
  );

-- Movimientos históricos ya aplicados.
update public.payment_transactions
set earnings_counted_at = wallet_applied_at
where wallet_applied_at is not null
  and earnings_counted_at is null;

-- Los retiros pendientes antiguos ya habían sido descontados
-- del saldo disponible. Se reflejan como saldo reservado.
with pending_to_reserve as (
  select
    wallet_id,
    sum(amount)::numeric(12,2) as total_amount
  from public.withdraw_requests
  where status = 'pending'
    and reserved_at is null
  group by wallet_id
)
update public.driver_wallets wallet
set
  reserved_balance =
    wallet.reserved_balance + pending.total_amount,
  updated_at = now()
from pending_to_reserve pending
where wallet.id = pending.wallet_id;

update public.withdraw_requests
set
  reserved_at = coalesce(requested_at, created_at, now()),
  updated_at = now()
where status = 'pending'
  and reserved_at is null;


-- =========================================================
-- FUNCIÓN: apply_wallet_movement
-- =========================================================

CREATE OR REPLACE FUNCTION public.apply_wallet_movement(p_driver_id uuid, p_balance_type text, p_amount numeric, p_transaction_type text, p_trip_id uuid DEFAULT NULL::uuid, p_payment_transaction_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_lifetime_earnings_delta numeric DEFAULT 0, p_total_withdrawn_delta numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_wallet public.driver_wallets%rowtype;
  v_before numeric(12,2);
  v_after numeric(12,2);
  v_lifetime_after numeric(12,2);
  v_withdrawn_after numeric(12,2);
  v_transaction_id uuid;
begin
  if p_driver_id is null then
    raise exception 'El conductor es obligatorio';
  end if;

  if p_balance_type not in (
    'available',
    'pending',
    'cash_debt',
    'reserved'
  ) then
    raise exception
      'Tipo de saldo inválido: %',
      p_balance_type;
  end if;

  if p_transaction_type is null
    or btrim(p_transaction_type) = '' then
    raise exception
      'El tipo de movimiento es obligatorio';
  end if;

  if coalesce(p_amount, 0) = 0
    and coalesce(p_lifetime_earnings_delta, 0) = 0
    and coalesce(p_total_withdrawn_delta, 0) = 0 then
    raise exception
      'El movimiento no puede estar vacío';
  end if;

  insert into public.driver_wallets (
    driver_id
  )
  values (
    p_driver_id
  )
  on conflict (driver_id)
  do nothing;

  select *
  into v_wallet
  from public.driver_wallets
  where driver_id = p_driver_id
  for update;

  if not found then
    raise exception
      'No fue posible obtener el wallet';
  end if;

  v_before :=
    case p_balance_type
      when 'available'
        then coalesce(v_wallet.available_balance, 0)

      when 'pending'
        then coalesce(v_wallet.pending_balance, 0)

      when 'cash_debt'
        then coalesce(v_wallet.cash_debt, 0)

      when 'reserved'
        then coalesce(v_wallet.reserved_balance, 0)
    end;

  v_after :=
    round(
      v_before + coalesce(p_amount, 0),
      2
    );

  v_lifetime_after :=
    round(
      coalesce(v_wallet.lifetime_earnings, 0)
      + coalesce(p_lifetime_earnings_delta, 0),
      2
    );

  v_withdrawn_after :=
    round(
      coalesce(v_wallet.total_withdrawn, 0)
      + coalesce(p_total_withdrawn_delta, 0),
      2
    );

  if v_after < 0 then
    raise exception
      'Saldo insuficiente. Tipo: %, saldo: %, movimiento: %',
      p_balance_type,
      v_before,
      p_amount;
  end if;

  if v_lifetime_after < 0 then
    raise exception
      'Las ganancias históricas no pueden ser negativas';
  end if;

  if v_withdrawn_after < 0 then
    raise exception
      'Los retiros históricos no pueden ser negativos';
  end if;

  update public.driver_wallets
  set
    available_balance =
      case
        when p_balance_type = 'available'
          then v_after
        else available_balance
      end,

    pending_balance =
      case
        when p_balance_type = 'pending'
          then v_after
        else pending_balance
      end,

    cash_debt =
      case
        when p_balance_type = 'cash_debt'
          then v_after
        else cash_debt
      end,

    reserved_balance =
      case
        when p_balance_type = 'reserved'
          then v_after
        else reserved_balance
      end,

    lifetime_earnings = v_lifetime_after,
    total_withdrawn = v_withdrawn_after,
    updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_transactions (
    wallet_id,
    driver_id,
    trip_id,
    payment_transaction_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    created_by,
    balance_type,
    metadata
  )
  values (
    v_wallet.id,
    p_driver_id,
    p_trip_id,
    p_payment_transaction_id,
    p_transaction_type,
    round(coalesce(p_amount, 0), 2),
    v_before,
    v_after,
    coalesce(
      nullif(btrim(p_description), ''),
      'Movimiento de wallet'
    ),
    auth.uid(),
    p_balance_type,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_transaction_id;

  return v_transaction_id;
end;
$function$;

-- =========================================================
-- FUNCIÓN: approve_withdrawal
-- =========================================================

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request public.withdraw_requests%rowtype;
begin
  if not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  select *
  into v_request
  from public.withdraw_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Retiro no encontrado';
  end if;

  if v_request.status <> 'pending' then
    raise exception
      'El retiro no está pendiente. Estado actual: %',
      v_request.status;
  end if;

  update public.withdraw_requests
  set
    status = 'processing',
    approved_by = auth.uid(),
    approved_at = now(),
    failure_reason = null,
    updated_at = now()
  where id = p_request_id;

  perform public.log_finance_event(
    v_request.driver_id,
    'withdrawal_processing',
    'withdraw_request',
    v_request.id,
    v_request.amount,

    jsonb_build_object(
      'approved_by',
      auth.uid()
    )
  );

  return p_request_id;
end;
$function$;

-- =========================================================
-- FUNCIÓN: complete_withdrawal
-- =========================================================

CREATE OR REPLACE FUNCTION public.complete_withdrawal(p_request_id uuid, p_provider_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request public.withdraw_requests%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  select *
  into v_request
  from public.withdraw_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Retiro no encontrado';
  end if;

  if v_request.status = 'paid' then
    return v_request.id;
  end if;

  if v_request.status not in (
    'pending',
    'approved',
    'processing'
  ) then
    raise exception
      'El retiro no puede pagarse desde el estado: %',
      v_request.status;
  end if;

  perform public.apply_wallet_movement(
    p_driver_id =>
      v_request.driver_id,

    p_balance_type =>
      'reserved',

    p_amount =>
      -v_request.amount,

    p_transaction_type =>
      'withdrawal_paid',

    p_description =>
      'Transferencia confirmada por el proveedor',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request.id,

        'provider_reference',
        p_provider_reference
      ),

    p_lifetime_earnings_delta =>
      0,

    p_total_withdrawn_delta =>
      v_request.amount
  );

  update public.withdraw_requests
  set
    status = 'paid',

    provider_reference =
      coalesce(
        nullif(
          btrim(p_provider_reference),
          ''
        ),
        provider_reference
      ),

    paid_at = now(),
    failure_reason = null,
    updated_at = now()
  where id = p_request_id;

  perform public.log_finance_event(
    v_request.driver_id,
    'withdrawal_paid',
    'withdraw_request',
    v_request.id,
    v_request.amount,

    jsonb_build_object(
      'provider_reference',
      p_provider_reference
    )
  );

  return v_request.id;
end;
$function$;

-- =========================================================
-- FUNCIÓN: create_trip_payment
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_trip_payment(requested_trip_id uuid, selected_method text DEFAULT 'cash'::text, selected_tip numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_trip public.trips%rowtype;
  v_existing public.payment_transactions%rowtype;

  v_transaction_id uuid;
  v_wallet_applied_at timestamptz;

  v_total numeric(12,2);
  v_driver_earnings numeric(12,2);
  v_platform_commission numeric(12,2);
begin
  if selected_method not in (
    'cash',
    'card',
    'mercado_pago'
  ) then
    raise exception
      'Método de pago inválido';
  end if;

  if selected_tip < 0 then
    raise exception
      'La propina no puede ser negativa';
  end if;

  select *
  into v_trip
  from public.trips
  where id = requested_trip_id
  for update;

  if not found then
    raise exception
      'El viaje no existe';
  end if;

  if v_trip.status <> 'completed' then
    raise exception
      'El viaje todavía no está completado';
  end if;

  if v_trip.driver_id is null then
    raise exception
      'El viaje no tiene conductor';
  end if;

  if v_trip.passenger_id <> auth.uid()
    and not public.is_axi_finance()
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'No autorizado';
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

  select *
  into v_existing
  from public.payment_transactions
  where trip_id = requested_trip_id
  for update;

  if found
    and v_existing.wallet_applied_at is not null then

    if v_existing.method <> selected_method
      or round(v_existing.tip_amount, 2)
        <> round(selected_tip, 2)
      or round(v_existing.driver_earnings, 2)
        <> v_driver_earnings
      or round(v_existing.platform_commission, 2)
        <> v_platform_commission then

      raise exception
        'El pago ya fue aplicado al wallet y no puede modificarse';
    end if;

    return v_existing.id;
  end if;

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
    provider,
    paid_at
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
    round(selected_tip, 2),
    v_total,
    v_platform_commission,
    v_driver_earnings,

    case
      when selected_method = 'mercado_pago'
        then 'mercado_pago'

      when selected_method = 'card'
        then 'card_provider'

      else 'cash'
    end,

    case
      when selected_method = 'cash'
        then now()
      else null
    end
  )
  on conflict (trip_id)
  do update set
    method = excluded.method,
    status = excluded.status,
    tip_amount = excluded.tip_amount,
    total_amount = excluded.total_amount,
    platform_commission = excluded.platform_commission,
    driver_earnings = excluded.driver_earnings,
    provider = excluded.provider,
    paid_at = excluded.paid_at,
    updated_at = now()
  returning
    id,
    wallet_applied_at
  into
    v_transaction_id,
    v_wallet_applied_at;

  insert into public.driver_wallets (
    driver_id
  )
  values (
    v_trip.driver_id
  )
  on conflict (driver_id)
  do nothing;

  if v_wallet_applied_at is null then

    if selected_method = 'cash' then

      perform public.apply_wallet_movement(
        p_driver_id =>
          v_trip.driver_id,

        p_balance_type =>
          'cash_debt',

        p_amount =>
          v_platform_commission,

        p_transaction_type =>
          'cash_trip_commission',

        p_trip_id =>
          v_trip.id,

        p_payment_transaction_id =>
          v_transaction_id,

        p_description =>
          'Participación de AXI por viaje pagado en efectivo',

        p_metadata =>
          jsonb_build_object(
            'payment_method',
            selected_method,

            'platform_commission',
            v_platform_commission,

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
          'digital_earning_pending',

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

            'total_collected',
            v_total,

            'platform_commission',
            v_platform_commission,

            'driver_earnings',
            v_driver_earnings
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );

      update public.payment_transactions
      set
        wallet_applied_at = now(),
        updated_at = now()
      where id = v_transaction_id;

    end if;
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

    tip_amount = round(selected_tip, 2),
    amount_due = v_total,

    paid_at =
      case
        when selected_method = 'cash'
          then now()
        else null
      end,

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
      'Pago generado. Método: %s. Total: $%s',
      selected_method,
      v_total
    ),

    auth.uid()
  );

  return v_transaction_id;
end;
$function$;

-- =========================================================
-- FUNCIÓN: fail_withdrawal
-- =========================================================

CREATE OR REPLACE FUNCTION public.fail_withdrawal(p_request_id uuid, p_failure_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request public.withdraw_requests%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  select *
  into v_request
  from public.withdraw_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Retiro no encontrado';
  end if;

  if v_request.status = 'failed' then
    return v_request.id;
  end if;

  if v_request.status not in (
    'pending',
    'approved',
    'processing'
  ) then
    raise exception
      'El retiro no puede fallar desde el estado: %',
      v_request.status;
  end if;

  perform public.apply_wallet_movement(
    p_driver_id =>
      v_request.driver_id,

    p_balance_type =>
      'reserved',

    p_amount =>
      -v_request.amount,

    p_transaction_type =>
      'withdrawal_failed',

    p_description =>
      'Transferencia fallida',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request.id,

        'failure_reason',
        p_failure_reason
      )
  );

  perform public.apply_wallet_movement(
    p_driver_id =>
      v_request.driver_id,

    p_balance_type =>
      'available',

    p_amount =>
      v_request.amount,

    p_transaction_type =>
      'withdrawal_returned',

    p_description =>
      'Saldo devuelto por transferencia fallida',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request.id,

        'failure_reason',
        p_failure_reason
      )
  );

  update public.withdraw_requests
  set
    status = 'failed',

    failure_reason =
      coalesce(
        nullif(
          btrim(p_failure_reason),
          ''
        ),
        'La transferencia no pudo completarse'
      ),

    updated_at = now()
  where id = p_request_id;

  return v_request.id;
end;
$function$;

-- =========================================================
-- FUNCIÓN: reject_withdrawal
-- =========================================================

CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdraw_request_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request public.withdraw_requests%rowtype;
begin
  if not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  select *
  into v_request
  from public.withdraw_requests
  where id = p_withdraw_request_id
  for update;

  if not found then
    raise exception
      'Retiro no encontrado';
  end if;

  if v_request.status = 'rejected' then
    return;
  end if;

  if v_request.status not in (
    'pending',
    'approved',
    'processing'
  ) then
    raise exception
      'El retiro no puede rechazarse desde el estado: %',
      v_request.status;
  end if;

  perform public.apply_wallet_movement(
    p_driver_id =>
      v_request.driver_id,

    p_balance_type =>
      'reserved',

    p_amount =>
      -v_request.amount,

    p_transaction_type =>
      'withdrawal_rejected',

    p_description =>
      'Retiro rechazado',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request.id,

        'reason',
        p_reason
      )
  );

  perform public.apply_wallet_movement(
    p_driver_id =>
      v_request.driver_id,

    p_balance_type =>
      'available',

    p_amount =>
      v_request.amount,

    p_transaction_type =>
      'withdrawal_returned',

    p_description =>
      'Saldo devuelto por retiro rechazado',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request.id,

        'reason',
        p_reason
      )
  );

  update public.withdraw_requests
  set
    status = 'rejected',

    notes =
      nullif(
        btrim(p_reason),
        ''
      ),

    failure_reason =
      nullif(
        btrim(p_reason),
        ''
      ),

    updated_at = now()
  where id = p_withdraw_request_id;

  return;
end;
$function$;

-- =========================================================
-- FUNCIÓN: request_withdrawal
-- =========================================================

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_bank_name text, p_account_holder text, p_clabe text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_wallet public.driver_wallets%rowtype;
  v_request_id uuid;
  v_debt_offset numeric(12,2);
begin
  if auth.uid() is null then
    raise exception
      'Sesión no válida';
  end if;

  if p_amount is null
    or p_amount <= 0 then
    raise exception
      'Monto inválido';
  end if;

  select *
  into v_wallet
  from public.driver_wallets
  where driver_id = auth.uid()
  for update;

  if not found then
    raise exception
      'Wallet no encontrada';
  end if;

  -- Antes de retirar, pagar deudas con el saldo disponible.

  v_debt_offset :=
    least(
      coalesce(v_wallet.available_balance, 0),
      coalesce(v_wallet.cash_debt, 0)
    );

  if v_debt_offset > 0 then

    perform public.apply_wallet_movement(
      p_driver_id =>
        auth.uid(),

      p_balance_type =>
        'available',

      p_amount =>
        -v_debt_offset,

      p_transaction_type =>
        'automatic_debt_offset_before_withdrawal',

      p_description =>
        'Descuento automático de deuda antes del retiro',

      p_metadata =>
        jsonb_build_object(
          'offset_amount',
          v_debt_offset
        )
    );

    perform public.apply_wallet_movement(
      p_driver_id =>
        auth.uid(),

      p_balance_type =>
        'cash_debt',

      p_amount =>
        -v_debt_offset,

      p_transaction_type =>
        'automatic_debt_payment_before_withdrawal',

      p_description =>
        'Pago automático de deuda antes del retiro',

      p_metadata =>
        jsonb_build_object(
          'offset_amount',
          v_debt_offset
        )
    );

  end if;

  select *
  into v_wallet
  from public.driver_wallets
  where driver_id = auth.uid()
  for update;

  if v_wallet.available_balance < p_amount then
    raise exception
      'Saldo disponible insuficiente. Disponible: $%',
      v_wallet.available_balance;
  end if;

  insert into public.withdraw_requests (
    driver_id,
    wallet_id,
    amount,
    status,
    bank_name,
    account_holder,
    clabe,
    reserved_at,
    metadata
  )
  values (
    auth.uid(),
    v_wallet.id,
    round(p_amount, 2),
    'pending',

    nullif(
      btrim(p_bank_name),
      ''
    ),

    nullif(
      btrim(p_account_holder),
      ''
    ),

    nullif(
      btrim(p_clabe),
      ''
    ),

    now(),

    jsonb_build_object(
      'created_from',
      'driver_wallet'
    )
  )
  returning id
  into v_request_id;

  perform public.apply_wallet_movement(
    p_driver_id =>
      auth.uid(),

    p_balance_type =>
      'available',

    p_amount =>
      -round(p_amount, 2),

    p_transaction_type =>
      'withdrawal_reserved',

    p_description =>
      'Saldo reservado para retiro',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request_id
      )
  );

  perform public.apply_wallet_movement(
    p_driver_id =>
      auth.uid(),

    p_balance_type =>
      'reserved',

    p_amount =>
      round(p_amount, 2),

    p_transaction_type =>
      'withdrawal_reserved',

    p_description =>
      'Saldo apartado para transferencia',

    p_metadata =>
      jsonb_build_object(
        'withdraw_request_id',
        v_request_id
      )
  );

  return v_request_id;
end;
$function$;

-- =========================================================
-- FUNCIÓN: update_payment_status
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_payment_status(transaction_id_value uuid, new_status_value text, provider_reference_value text DEFAULT NULL::text, failure_reason_value text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_payment public.payment_transactions%rowtype;
  v_wallet public.driver_wallets%rowtype;

  v_debt_offset numeric(12,2) := 0;
  v_available_credit numeric(12,2) := 0;
  v_lifetime_delta numeric(12,2) := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_axi_finance() then

    raise exception
      'Solo Finanzas, Administración o el proveedor pueden actualizar pagos';
  end if;

  if new_status_value not in (
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled'
  ) then
    raise exception
      'Estado de pago inválido para esta función: %',
      new_status_value;
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = transaction_id_value
  for update;

  if not found then
    raise exception
      'La transacción no existe';
  end if;

  if v_payment.status = 'refunded' then
    raise exception
      'El pago ya fue reembolsado';
  end if;

  if v_payment.status = 'paid'
    and new_status_value <> 'paid' then
    raise exception
      'Un pago confirmado no puede marcarse como fallido o cancelado';
  end if;

  -- -------------------------------------------------------
  -- PAGO DIGITAL CONFIRMADO
  -- -------------------------------------------------------

  if v_payment.method in (
      'card',
      'mercado_pago'
    )
    and new_status_value = 'paid'
    and v_payment.wallet_released_at is null then

    if v_payment.driver_id is null then
      raise exception
        'El pago no tiene conductor';
    end if;

    insert into public.driver_wallets (
      driver_id
    )
    values (
      v_payment.driver_id
    )
    on conflict (driver_id)
    do nothing;

    -- Si el pago antes fue revertido, se vuelve a abrir
    -- primero el saldo pendiente.

    if v_payment.wallet_applied_at is null
      or v_payment.wallet_reversed_at is not null then

      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'pending',

        p_amount =>
          v_payment.driver_earnings,

        p_transaction_type =>
          'digital_earning_reopened',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Ganancia digital reactivada antes de confirmar el pago',

        p_metadata =>
          jsonb_build_object(
            'provider_reference',
            provider_reference_value
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );

      update public.payment_transactions
      set
        wallet_applied_at =
          coalesce(wallet_applied_at, now()),

        wallet_reversed_at = null,
        updated_at = now()
      where id = v_payment.id;

      v_payment.wallet_applied_at :=
        coalesce(
          v_payment.wallet_applied_at,
          now()
        );

      v_payment.wallet_reversed_at := null;
    end if;

    select *
    into v_wallet
    from public.driver_wallets
    where driver_id = v_payment.driver_id
    for update;

    v_debt_offset :=
      least(
        coalesce(v_wallet.cash_debt, 0),
        coalesce(v_payment.driver_earnings, 0)
      );

    v_available_credit :=
      round(
        v_payment.driver_earnings
        - v_debt_offset,
        2
      );

    -- Quitar el ingreso pendiente.

    perform public.apply_wallet_movement(
      p_driver_id =>
        v_payment.driver_id,

      p_balance_type =>
        'pending',

      p_amount =>
        -v_payment.driver_earnings,

      p_transaction_type =>
        'digital_earning_released',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_transaction_id =>
        v_payment.id,

      p_description =>
        'Pago confirmado por el proveedor',

      p_metadata =>
        jsonb_build_object(
          'provider_reference',
          provider_reference_value
        ),

      p_lifetime_earnings_delta =>
        0,

      p_total_withdrawn_delta =>
        0
    );

    -- Cubrir deuda en efectivo.

    if v_debt_offset > 0 then

      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'cash_debt',

        p_amount =>
          -v_debt_offset,

        p_transaction_type =>
          'automatic_cash_debt_offset',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Pago automático de deuda en efectivo',

        p_metadata =>
          jsonb_build_object(
            'provider_reference',
            provider_reference_value,

            'offset_amount',
            v_debt_offset
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );

    end if;

    v_lifetime_delta :=
      case
        when v_payment.earnings_counted_at is null
          then v_payment.driver_earnings
        else 0
      end;

    -- Liberar el saldo neto disponible.

    if v_available_credit <> 0
      or v_lifetime_delta <> 0 then

      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'available',

        p_amount =>
          v_available_credit,

        p_transaction_type =>
          'digital_earning_available',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Ganancia disponible después de descontar deudas',

        p_metadata =>
          jsonb_build_object(
            'provider_reference',
            provider_reference_value,

            'gross_driver_earnings',
            v_payment.driver_earnings,

            'cash_debt_offset',
            v_debt_offset,

            'net_available',
            v_available_credit
          ),

        p_lifetime_earnings_delta =>
          v_lifetime_delta,

        p_total_withdrawn_delta =>
          0
      );

    end if;

    update public.payment_transactions
    set
      wallet_released_at = now(),
      wallet_reversed_at = null,

      earnings_counted_at =
        coalesce(
          earnings_counted_at,
          now()
        ),

      updated_at = now()
    where id = v_payment.id;

  end if;

  -- -------------------------------------------------------
  -- PAGO DIGITAL FALLIDO O CANCELADO
  -- -------------------------------------------------------

  if v_payment.method in (
      'card',
      'mercado_pago'
    )
    and new_status_value in (
      'failed',
      'cancelled'
    )
    and v_payment.wallet_applied_at is not null
    and v_payment.wallet_released_at is null
    and v_payment.wallet_reversed_at is null then

    perform public.apply_wallet_movement(
      p_driver_id =>
        v_payment.driver_id,

      p_balance_type =>
        'pending',

      p_amount =>
        -v_payment.driver_earnings,

      p_transaction_type =>
        'digital_earning_reversed',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_transaction_id =>
        v_payment.id,

      p_description =>
        'Pago rechazado o cancelado por el proveedor',

      p_metadata =>
        jsonb_build_object(
          'failure_reason',
          failure_reason_value
        ),

      p_lifetime_earnings_delta =>
        0,

      p_total_withdrawn_delta =>
        0
    );

    update public.payment_transactions
    set
      wallet_reversed_at = now(),
      updated_at = now()
    where id = v_payment.id;

  end if;

  update public.payment_transactions
  set
    status = new_status_value,

    provider_payment_id =
      coalesce(
        nullif(
          btrim(provider_reference_value),
          ''
        ),
        provider_payment_id
      ),

    failure_reason =
      case
        when new_status_value = 'failed' then
          coalesce(
            nullif(
              btrim(failure_reason_value),
              ''
            ),
            'Pago rechazado'
          )
        else null
      end,

    paid_at =
      case
        when new_status_value = 'paid'
          then coalesce(paid_at, now())

        when new_status_value in (
          'failed',
          'cancelled'
        )
          then null

        else paid_at
      end,

    updated_at = now()
  where id = transaction_id_value;

  update public.trips
  set
    payment_status = new_status_value,

    payment_reference =
      coalesce(
        nullif(
          btrim(provider_reference_value),
          ''
        ),
        payment_reference
      ),

    paid_at =
      case
        when new_status_value = 'paid'
          then coalesce(paid_at, now())

        when new_status_value in (
          'failed',
          'cancelled'
        )
          then null

        else paid_at
      end,

    updated_at = now()
  where id = v_payment.trip_id;

  perform public.create_notification(
    v_payment.passenger_id,
    'payment',

    case new_status_value
      when 'paid'
        then 'Pago confirmado'

      when 'failed'
        then 'Pago rechazado'

      when 'processing'
        then 'Pago en proceso'

      when 'cancelled'
        then 'Pago cancelado'

      else 'Pago pendiente'
    end,

    case new_status_value
      when 'paid' then
        format(
          'Tu pago de $%s MXN fue confirmado.',
          v_payment.total_amount
        )

      when 'failed' then
        coalesce(
          nullif(
            btrim(failure_reason_value),
            ''
          ),
          'No fue posible procesar tu pago.'
        )

      when 'processing' then
        'Tu pago está siendo procesado.'

      when 'cancelled' then
        'La operación de pago fue cancelada.'

      else
        'Tu pago continúa pendiente.'
    end,

    v_payment.trip_id,
    null,

    jsonb_build_object(
      'transaction_id',
      v_payment.id,

      'payment_status',
      new_status_value,

      'total_amount',
      v_payment.total_amount
    )
  );

  if v_payment.driver_id is not null
    and new_status_value = 'paid' then

    perform public.create_notification(
      v_payment.driver_id,
      'payment',
      'Ganancia disponible',

      format(
        'Tu ganancia de $%s MXN fue confirmada.',
        v_payment.driver_earnings
      ),

      v_payment.trip_id,
      null,

      jsonb_build_object(
        'transaction_id',
        v_payment.id,

        'driver_earnings',
        v_payment.driver_earnings,

        'cash_debt_offset',
        v_debt_offset,

        'net_available',
        v_available_credit
      )
    );

  end if;
end;
$function$;

-- =========================================================
-- PERMISOS
-- =========================================================

revoke all on function public.apply_wallet_movement(
  uuid,
  text,
  numeric,
  text,
  uuid,
  uuid,
  text,
  jsonb,
  numeric,
  numeric
) from public, anon, authenticated;

revoke all on function public.create_trip_payment(
  uuid,
  text,
  numeric
) from public, anon, authenticated;

revoke all on function public.update_payment_status(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

revoke all on function public.request_withdrawal(
  numeric,
  text,
  text,
  text
) from public, anon, authenticated;

revoke all on function public.approve_withdrawal(
  uuid
) from public, anon, authenticated;

revoke all on function public.complete_withdrawal(
  uuid,
  text
) from public, anon, authenticated;

revoke all on function public.fail_withdrawal(
  uuid,
  text
) from public, anon, authenticated;

revoke all on function public.reject_withdrawal(
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.create_trip_payment(
  uuid,
  text,
  numeric
) to authenticated, service_role;

grant execute on function public.update_payment_status(
  uuid,
  text,
  text,
  text
) to authenticated, service_role;

grant execute on function public.request_withdrawal(
  numeric,
  text,
  text,
  text
) to authenticated;

grant execute on function public.approve_withdrawal(
  uuid
) to authenticated;

grant execute on function public.complete_withdrawal(
  uuid,
  text
) to authenticated, service_role;

grant execute on function public.fail_withdrawal(
  uuid,
  text
) to authenticated, service_role;

grant execute on function public.reject_withdrawal(
  uuid,
  text
) to authenticated;

commit;
