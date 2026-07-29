-- ============================================================
-- AXI: confirmación y liberación de pagos digitales
-- ============================================================

-- Cuenta donde se reconoce el dinero ya liquidado por el proveedor.
insert into public.financial_accounts (
  code,
  name,
  description,
  account_type,
  owner_type,
  owner_id,
  normal_balance,
  currency,
  status,
  allows_negative_balance,
  metadata
)
values (
  'asset.cash_and_bank',
  'Efectivo y bancos',
  'Fondos disponibles de AXI en cuentas bancarias',
  'asset',
  'platform',
  null,
  'debit',
  'MXN',
  'active',
  false,
  jsonb_build_object(
    'system_account', true,
    'source', 'digital_payment_settlement'
  )
)
on conflict (code)
do update set
  name = excluded.name,
  description = excluded.description,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  currency = excluded.currency,
  status = 'active',
  updated_at = now();


-- ============================================================
-- CONFIRMAR PAGO DIGITAL
-- ============================================================

create or replace function public.confirm_trip_payment(
  p_payment_id uuid,
  p_provider_reference text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_payment public.payment_transactions%rowtype;

  v_bank_account_id uuid;
  v_provider_account_id uuid;

  v_ledger_transaction_id uuid;
  v_external_amount numeric(18,2);
  v_driver_net_earnings numeric(18,2);
begin
  -- Solamente Finanzas o el backend con service_role.
  if not public.is_axi_finance()
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado para confirmar pagos';
  end if;

  if p_payment_id is null then
    raise exception 'El identificador del pago es obligatorio';
  end if;

  if nullif(btrim(p_provider_reference), '') is null then
    raise exception 'La referencia del proveedor es obligatoria';
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'El pago no existe';
  end if;

  if v_payment.method not in ('card', 'mercado_pago') then
    raise exception
      'El pago % no corresponde a un método digital',
      p_payment_id;
  end if;

  /*
    Idempotencia funcional:
    si ya fue confirmado y liberado, devolvemos la transacción
    contable existente sin volver a mover saldos.
  */
  if v_payment.status = 'paid'
     and v_payment.wallet_released_at is not null then

    select id
    into v_ledger_transaction_id
    from public.financial_transactions
    where idempotency_key =
      'trip-payment-settlement:' || p_payment_id::text || ':v1';

    return v_ledger_transaction_id;
  end if;

  if v_payment.status not in ('pending', 'processing') then
    raise exception
      'El pago no puede confirmarse desde el estado %',
      v_payment.status;
  end if;

  if v_payment.wallet_applied_at is null then
    raise exception
      'El pago todavía no fue aplicado al wallet del conductor';
  end if;

  if v_payment.wallet_reversed_at is not null then
    raise exception
      'El movimiento del conductor ya fue revertido';
  end if;

  v_external_amount :=
    round(coalesce(v_payment.external_amount, 0), 2);

  v_driver_net_earnings :=
    round(coalesce(v_payment.driver_net_earnings, 0), 2);

  if v_external_amount <= 0 then
    raise exception
      'El pago no tiene un importe externo válido';
  end if;

  select id
  into v_bank_account_id
  from public.financial_accounts
  where code = 'asset.cash_and_bank'
    and status = 'active';

  select id
  into v_provider_account_id
  from public.financial_accounts
  where code = 'asset.provider_clearing'
    and status = 'active';

  if v_bank_account_id is null
     or v_provider_account_id is null then
    raise exception
      'Faltan cuentas contables para liquidar el pago digital';
  end if;

  /*
    El conductor tenía el ingreso en pending_balance.
    Al confirmarse el proveedor:
      1. se elimina de pending;
      2. se agrega a available;
      3. se contabiliza como ingreso de vida una sola vez.
  */
  if v_driver_net_earnings > 0 then
    perform public.apply_wallet_movement(
      p_driver_id =>
        v_payment.driver_id,

      p_balance_type =>
        'pending',

      p_amount =>
        -v_driver_net_earnings,

      p_transaction_type =>
        'digital_earning_released_from_pending',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_transaction_id =>
        v_payment.id,

      p_description =>
        'Ganancia digital liberada del saldo pendiente',

      p_metadata =>
        jsonb_build_object(
          'provider', v_payment.provider,
          'provider_reference', btrim(p_provider_reference),
          'driver_net_earnings', v_driver_net_earnings,
          'settlement_stage', 'remove_pending'
        ),

      p_lifetime_earnings_delta =>
        0,

      p_total_withdrawn_delta =>
        0
    );

    perform public.apply_wallet_movement(
      p_driver_id =>
        v_payment.driver_id,

      p_balance_type =>
        'available',

      p_amount =>
        v_driver_net_earnings,

      p_transaction_type =>
        'digital_earning_available',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_transaction_id =>
        v_payment.id,

      p_description =>
        'Ganancia digital disponible para el conductor',

      p_metadata =>
        jsonb_build_object(
          'provider', v_payment.provider,
          'provider_reference', btrim(p_provider_reference),
          'driver_net_earnings', v_driver_net_earnings,
          'settlement_stage', 'add_available'
        ),

      p_lifetime_earnings_delta =>
        v_driver_net_earnings,

      p_total_withdrawn_delta =>
        0
    );
  end if;

  /*
    Contabilidad de liquidación:
      Débito  Efectivo y bancos
      Crédito Fondos pendientes en proveedor
  */
  v_ledger_transaction_id :=
    public.post_financial_transaction(
      p_transaction_type =>
        'trip_payment_settlement',

      p_description =>
        format(
          'Liquidación del pago %s del viaje %s',
          v_payment.id,
          v_payment.trip_id
        ),

      p_entries =>
        jsonb_build_array(
          jsonb_build_object(
            'account_id', v_bank_account_id,
            'direction', 'debit',
            'amount', v_external_amount,
            'description',
              'Fondos recibidos del proveedor de pagos',
            'driver_id', v_payment.driver_id,
            'passenger_id', v_payment.passenger_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          ),
          jsonb_build_object(
            'account_id', v_provider_account_id,
            'direction', 'credit',
            'amount', v_external_amount,
            'description',
              'Liberación de fondos pendientes del proveedor',
            'driver_id', v_payment.driver_id,
            'passenger_id', v_payment.passenger_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          )
        ),

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'trip-payment-settlement:' ||
        v_payment.id::text ||
        ':v1',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_id =>
        v_payment.id,

      p_provider =>
        v_payment.provider,

      p_provider_reference =>
        btrim(p_provider_reference),

      p_metadata =>
        jsonb_build_object(
          'payment_method', v_payment.method,
          'external_amount', v_external_amount,
          'driver_net_earnings', v_driver_net_earnings,
          'provider_payload',
            coalesce(p_provider_payload, '{}'::jsonb),
          'integration_version', 1
        ),

      p_created_by =>
        auth.uid(),

      p_effective_at =>
        now()
    );

  update public.payment_transactions
  set
    status = 'paid',
    provider_payment_id = btrim(p_provider_reference),
    paid_at = coalesce(paid_at, now()),
    wallet_released_at = now(),
    earnings_counted_at =
      case
        when v_driver_net_earnings > 0
          then now()
        else earnings_counted_at
      end,
    failure_reason = null,
    updated_at = now()
  where id = v_payment.id;

  update public.trips
  set
    payment_status = 'paid',
    payment_reference = btrim(p_provider_reference),
    paid_at = coalesce(paid_at, now()),
    updated_at = now()
  where id = v_payment.trip_id;

  insert into public.trip_events (
    trip_id,
    status,
    description,
    created_by
  )
  values (
    v_payment.trip_id,
    'completed',
    format(
      'Pago digital confirmado. Proveedor: %s. Referencia: %s. Neto liberado al conductor: $%s',
      coalesce(v_payment.provider, v_payment.method),
      btrim(p_provider_reference),
      v_driver_net_earnings
    ),
    auth.uid()
  );

  return v_ledger_transaction_id;
end;
$function$;


revoke all
on function public.confirm_trip_payment(uuid, text, jsonb)
from public;

revoke all
on function public.confirm_trip_payment(uuid, text, jsonb)
from anon;

grant execute
on function public.confirm_trip_payment(uuid, text, jsonb)
to authenticated;

grant execute
on function public.confirm_trip_payment(uuid, text, jsonb)
to service_role;
