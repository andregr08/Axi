-- ============================================================
-- AXI: CONTRACARGOS DE PAGOS DIGITALES CONFIRMADOS
-- ============================================================

alter table public.payment_transactions
  add column if not exists chargeback_at timestamptz,
  add column if not exists chargeback_reason text,
  add column if not exists chargeback_provider_reference text,
  add column if not exists chargeback_provider_payload jsonb
    not null default '{}'::jsonb,
  add column if not exists chargeback_available_recovered numeric(12,2)
    not null default 0,
  add column if not exists chargeback_driver_debt_created numeric(12,2)
    not null default 0,
  add column if not exists chargeback_passenger_wallet_restored numeric(12,2)
    not null default 0;

alter table public.payment_transactions
  drop constraint if exists
    payment_transactions_chargeback_available_recovered_check;

alter table public.payment_transactions
  add constraint
    payment_transactions_chargeback_available_recovered_check
  check (chargeback_available_recovered >= 0);

alter table public.payment_transactions
  drop constraint if exists
    payment_transactions_chargeback_driver_debt_created_check;

alter table public.payment_transactions
  add constraint
    payment_transactions_chargeback_driver_debt_created_check
  check (chargeback_driver_debt_created >= 0);

alter table public.payment_transactions
  drop constraint if exists
    payment_transactions_chargeback_passenger_wallet_restored_check;

alter table public.payment_transactions
  add constraint
    payment_transactions_chargeback_passenger_wallet_restored_check
  check (chargeback_passenger_wallet_restored >= 0);

alter table public.payment_transactions
  drop constraint if exists payment_transactions_status_check;

alter table public.payment_transactions
  add constraint payment_transactions_status_check
  check (
    status in (
      'pending',
      'processing',
      'paid',
      'failed',
      'refunded',
      'cancelled',
      'charged_back'
    )
  );

alter table public.trips
  drop constraint if exists trips_payment_status_check;

alter table public.trips
  add constraint trips_payment_status_check
  check (
    payment_status in (
      'pending',
      'processing',
      'paid',
      'failed',
      'refunded',
      'cancelled',
      'charged_back'
    )
  );

create index if not exists
  idx_payment_transactions_chargeback_at
on public.payment_transactions (
  chargeback_at
)
where chargeback_at is not null;

create index if not exists
  idx_payment_transactions_chargeback_reference
on public.payment_transactions (
  chargeback_provider_reference
)
where chargeback_provider_reference is not null;

create or replace function public.process_trip_payment_chargeback(
  p_payment_id uuid,
  p_chargeback_reason text,
  p_provider_reference text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_payment public.payment_transactions%rowtype;
  v_driver_wallet public.driver_wallets%rowtype;

  v_driver_amount numeric(12,2);
  v_available_recovered numeric(12,2) := 0;
  v_driver_debt_created numeric(12,2) := 0;
  v_passenger_wallet_restored numeric(12,2) := 0;

  v_original_transaction_id uuid;
  v_settlement_transaction_id uuid;

  v_original_reversal_id uuid;
  v_settlement_reversal_id uuid;

  v_original_reversal_key text;
  v_settlement_reversal_key text;

  v_passenger_wallet_reversal_id uuid;
begin
  if not public.is_axi_finance()
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'No autorizado para procesar contracargos';
  end if;

  if p_payment_id is null then
    raise exception
      'El identificador del pago es obligatorio';
  end if;

  if nullif(btrim(p_chargeback_reason), '') is null then
    raise exception
      'El motivo del contracargo es obligatorio';
  end if;

  if nullif(btrim(p_provider_reference), '') is null then
    raise exception
      'La referencia del contracargo es obligatoria';
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;

  if not found then
    raise exception
      'El pago no existe';
  end if;

  if v_payment.method not in (
    'card',
    'mercado_pago'
  ) then
    raise exception
      'Solo se permiten contracargos de pagos digitales';
  end if;

  if v_payment.status = 'charged_back'
     and v_payment.chargeback_at is not null then

    select id
    into v_original_reversal_id
    from public.financial_transactions
    where idempotency_key =
      'trip-chargeback-original-reversal:' ||
      v_payment.id::text ||
      ':v1'
    limit 1;

    select id
    into v_settlement_reversal_id
    from public.financial_transactions
    where idempotency_key =
      'trip-chargeback-settlement-reversal:' ||
      v_payment.id::text ||
      ':v1'
    limit 1;

    return jsonb_build_object(
      'payment_id', v_payment.id,
      'status', v_payment.status,
      'already_processed', true,
      'original_reversal_id', v_original_reversal_id,
      'settlement_reversal_id', v_settlement_reversal_id,
      'available_recovered',
        v_payment.chargeback_available_recovered,
      'driver_debt_created',
        v_payment.chargeback_driver_debt_created,
      'passenger_wallet_restored',
        v_payment.chargeback_passenger_wallet_restored,
      'chargeback_at', v_payment.chargeback_at
    );
  end if;

  if v_payment.status <> 'paid' then
    raise exception
      'El contracargo solamente puede aplicarse a un pago paid. Estado actual: %',
      v_payment.status;
  end if;

  if v_payment.wallet_released_at is null then
    raise exception
      'La ganancia del conductor todavía no fue liberada';
  end if;

  if v_payment.wallet_reversed_at is not null then
    raise exception
      'El movimiento del conductor ya fue revertido';
  end if;

  v_driver_amount :=
    round(
      coalesce(v_payment.driver_net_earnings, 0),
      2
    );

  select id
  into v_original_transaction_id
  from public.financial_transactions
  where idempotency_key =
    'trip-payment:' ||
    v_payment.id::text ||
    ':v1'
  order by created_at
  limit 1;

  if v_original_transaction_id is null then
    raise exception
      'No existe la póliza contable original del pago';
  end if;

  select id
  into v_settlement_transaction_id
  from public.financial_transactions
  where idempotency_key =
    'trip-payment-settlement:' ||
    v_payment.id::text ||
    ':v1'
  order by created_at
  limit 1;

  if v_settlement_transaction_id is null then
    raise exception
      'No existe la póliza de liquidación del pago';
  end if;

  insert into public.driver_wallets (
    driver_id
  )
  values (
    v_payment.driver_id
  )
  on conflict (driver_id)
  do nothing;

  select *
  into v_driver_wallet
  from public.driver_wallets
  where driver_id = v_payment.driver_id
  for update;

  if not found then
    raise exception
      'No fue posible obtener el wallet del conductor';
  end if;

  if v_driver_amount > 0 then
    v_available_recovered :=
      round(
        least(
          coalesce(v_driver_wallet.available_balance, 0),
          v_driver_amount
        ),
        2
      );

    v_driver_debt_created :=
      round(
        greatest(
          v_driver_amount - v_available_recovered,
          0
        ),
        2
      );

    if v_available_recovered > 0 then
      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'available',

        p_amount =>
          -v_available_recovered,

        p_transaction_type =>
          'digital_chargeback_available_recovery',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Recuperación de ganancia disponible por contracargo',

        p_metadata =>
          jsonb_build_object(
            'chargeback_reason',
              btrim(p_chargeback_reason),

            'provider_reference',
              btrim(p_provider_reference),

            'driver_net_earnings',
              v_driver_amount,

            'available_recovered',
              v_available_recovered,

            'driver_debt_created',
              v_driver_debt_created,

            'chargeback_stage',
              'recover_available',

            'integration_version',
              1
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    if v_driver_debt_created > 0 then
      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'cash_debt',

        p_amount =>
          v_driver_debt_created,

        p_transaction_type =>
          'digital_chargeback_driver_debt',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Deuda creada al conductor por contracargo',

        p_metadata =>
          jsonb_build_object(
            'chargeback_reason',
              btrim(p_chargeback_reason),

            'provider_reference',
              btrim(p_provider_reference),

            'driver_net_earnings',
              v_driver_amount,

            'available_recovered',
              v_available_recovered,

            'driver_debt_created',
              v_driver_debt_created,

            'chargeback_stage',
              'create_driver_debt',

            'integration_version',
              1
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );
    end if;
  end if;

  if coalesce(v_payment.passenger_wallet_applied, 0) > 0
     and v_payment.passenger_wallet_reversed_at is null then

    v_passenger_wallet_restored :=
      round(
        v_payment.passenger_wallet_applied,
        2
      );

    v_passenger_wallet_reversal_id :=
      public.apply_passenger_wallet_movement(
        p_passenger_id =>
          v_payment.passenger_id,

        p_amount =>
          v_passenger_wallet_restored,

        p_transaction_type =>
          'trip_chargeback_reversal',

        p_description =>
          'Saldo AXI restaurado por contracargo del viaje',

        p_trip_id =>
          v_payment.trip_id,

        p_refund_request_id =>
          null,

        p_metadata =>
          jsonb_build_object(
            'payment_transaction_id',
              v_payment.id,

            'original_wallet_transaction_id',
              v_payment.passenger_wallet_transaction_id,

            'chargeback_reason',
              btrim(p_chargeback_reason),

            'provider_reference',
              btrim(p_provider_reference),

            'wallet_restored',
              v_passenger_wallet_restored,

            'integration_version',
              1
          )
      );
  end if;

  v_settlement_reversal_key :=
    'trip-chargeback-settlement-reversal:' ||
    v_payment.id::text ||
    ':v1';

  select id
  into v_settlement_reversal_id
  from public.financial_transactions
  where idempotency_key = v_settlement_reversal_key
  limit 1;

  if v_settlement_reversal_id is null then
    v_settlement_reversal_id :=
      public.reverse_financial_transaction(
        p_transaction_id =>
          v_settlement_transaction_id,

        p_reason =>
          format(
            'Contracargo del pago %s. Motivo: %s',
            v_payment.id,
            btrim(p_chargeback_reason)
          ),

        p_idempotency_key =>
          v_settlement_reversal_key,

        p_created_by =>
          auth.uid()
      );
  end if;

  v_original_reversal_key :=
    'trip-chargeback-original-reversal:' ||
    v_payment.id::text ||
    ':v1';

  select id
  into v_original_reversal_id
  from public.financial_transactions
  where idempotency_key = v_original_reversal_key
  limit 1;

  if v_original_reversal_id is null then
    v_original_reversal_id :=
      public.reverse_financial_transaction(
        p_transaction_id =>
          v_original_transaction_id,

        p_reason =>
          format(
            'Contracargo del pago %s. Motivo: %s',
            v_payment.id,
            btrim(p_chargeback_reason)
          ),

        p_idempotency_key =>
          v_original_reversal_key,

        p_created_by =>
          auth.uid()
      );
  end if;

  update public.payment_transactions
  set
    status =
      'charged_back',

    chargeback_at =
      now(),

    chargeback_reason =
      btrim(p_chargeback_reason),

    chargeback_provider_reference =
      btrim(p_provider_reference),

    chargeback_provider_payload =
      coalesce(
        p_provider_payload,
        '{}'::jsonb
      ),

    chargeback_available_recovered =
      v_available_recovered,

    chargeback_driver_debt_created =
      v_driver_debt_created,

    chargeback_passenger_wallet_restored =
      v_passenger_wallet_restored,

    wallet_reversed_at =
      coalesce(
        wallet_reversed_at,
        now()
      ),

    passenger_wallet_reversed_at =
      case
        when v_passenger_wallet_restored > 0
          then coalesce(
            passenger_wallet_reversed_at,
            now()
          )
        else passenger_wallet_reversed_at
      end,

    refunded_at =
      coalesce(
        refunded_at,
        now()
      ),

    failure_reason =
      btrim(p_chargeback_reason),

    updated_at =
      now()

  where id = v_payment.id;

  update public.trips
  set
    payment_status =
      'charged_back',

    payment_reference =
      btrim(p_provider_reference),

    paid_at =
      null,

    updated_at =
      now()

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
      'Contracargo procesado. Pago: %s. Referencia: %s. Recuperado del conductor: $%s. Deuda creada: $%s. Wallet pasajero restaurado: $%s.',
      v_payment.id,
      btrim(p_provider_reference),
      v_available_recovered,
      v_driver_debt_created,
      v_passenger_wallet_restored
    ),

    auth.uid()
  );

  return jsonb_build_object(
    'payment_id',
      v_payment.id,

    'trip_id',
      v_payment.trip_id,

    'status',
      'charged_back',

    'already_processed',
      false,

    'driver_net_earnings',
      v_driver_amount,

    'available_recovered',
      v_available_recovered,

    'driver_debt_created',
      v_driver_debt_created,

    'passenger_wallet_restored',
      v_passenger_wallet_restored,

    'passenger_wallet_reversal_id',
      v_passenger_wallet_reversal_id,

    'original_transaction_id',
      v_original_transaction_id,

    'original_reversal_id',
      v_original_reversal_id,

    'settlement_transaction_id',
      v_settlement_transaction_id,

    'settlement_reversal_id',
      v_settlement_reversal_id,

    'provider_reference',
      btrim(p_provider_reference),

    'chargeback_at',
      now()
  );
end;
$function$;

revoke all
on function public.process_trip_payment_chargeback(
  uuid,
  text,
  text,
  jsonb
)
from public;

revoke all
on function public.process_trip_payment_chargeback(
  uuid,
  text,
  text,
  jsonb
)
from anon;

grant execute
on function public.process_trip_payment_chargeback(
  uuid,
  text,
  text,
  jsonb
)
to authenticated;

grant execute
on function public.process_trip_payment_chargeback(
  uuid,
  text,
  text,
  jsonb
)
to service_role;

comment on function public.process_trip_payment_chargeback(
  uuid,
  text,
  text,
  jsonb
)
is
  'Procesa contracargos de pagos digitales confirmados. Recupera saldo disponible del conductor, crea deuda si el dinero ya fue retirado, restaura wallet del pasajero y revierte las pólizas original y de liquidación.';

comment on column
  public.payment_transactions.chargeback_at
is
  'Fecha en que el proveedor confirmó el contracargo.';

comment on column
  public.payment_transactions.chargeback_driver_debt_created
is
  'Importe que no pudo recuperarse del saldo disponible y se convirtió en deuda del conductor.';
