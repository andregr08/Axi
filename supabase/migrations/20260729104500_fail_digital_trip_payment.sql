-- ============================================================
-- AXI: fallo y reverso de pagos digitales pendientes
-- ============================================================
--
-- Este flujo cubre pagos digitales que todavía NO fueron
-- confirmados ni liberados al conductor.
--
-- Al pasar a failed o cancelled:
--   1. revierte el pending_balance del conductor;
--   2. revierte el asiento contable inicial;
--   3. permite que el trigger existente restaure el wallet
--      del pasajero;
--   4. evita duplicados por webhooks repetidos.
-- ============================================================


-- ============================================================
-- PROCESAR EL REVERSO DEL CONDUCTOR Y DEL LEDGER
-- ============================================================

create or replace function public.process_failed_trip_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_driver_amount numeric(18,2);

  v_original_financial_transaction_id uuid;
  v_reversal_financial_transaction_id uuid;

  v_wallet_transaction_id uuid;
  v_reversal_key text;
begin
  /*
    Solo se ejecuta al entrar por primera vez a failed/cancelled.
    También evita repetir la lógica cuando otro trigger actualiza
    columnas de la misma payment_transaction.
  */
  if new.method not in ('card', 'mercado_pago')
     or new.status not in ('failed', 'cancelled')
     or old.status in ('failed', 'cancelled')
     or old.status is not distinct from new.status then
    return new;
  end if;

  /*
    Esta función está diseñada para pagos que no llegaron a paid.
    Un contracargo posterior a paid requiere otro flujo porque el
    saldo ya habría pasado a available_balance.
  */
  if old.status = 'paid'
     or old.wallet_released_at is not null then
    raise exception
      'El pago ya fue confirmado. Debe procesarse como contracargo, no como fallo pendiente.';
  end if;

  v_driver_amount :=
    round(coalesce(old.driver_net_earnings, 0), 2);

  /*
    REVERSO DEL WALLET DEL CONDUCTOR

    create_trip_payment ya había sumado driver_net_earnings al
    pending_balance y dejó wallet_applied_at.
  */
  if old.wallet_applied_at is not null
     and old.wallet_reversed_at is null
     and v_driver_amount > 0 then

    v_wallet_transaction_id :=
      public.apply_wallet_movement(
        p_driver_id =>
          old.driver_id,

        p_balance_type =>
          'pending',

        p_amount =>
          -v_driver_amount,

        p_transaction_type =>
          'digital_earning_reversed',

        p_trip_id =>
          old.trip_id,

        p_payment_transaction_id =>
          old.id,

        p_description =>
          'Ganancia pendiente revertida por pago digital fallido',

        p_metadata =>
          jsonb_build_object(
            'payment_status', new.status,
            'failure_reason', new.failure_reason,
            'provider', old.provider,
            'provider_payment_id',
              coalesce(
                new.provider_payment_id,
                old.provider_payment_id
              ),
            'driver_net_earnings', v_driver_amount,
            'reversal_stage', 'pending_payment_failure',
            'integration_version', 1
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );

    /*
      Marcamos el movimiento del conductor como revertido.

      Esta actualización provoca una segunda evaluación del trigger,
      pero la condición old.status in ('failed','cancelled') evita
      que el reverso se ejecute nuevamente.
    */
    update public.payment_transactions
    set
      wallet_reversed_at = coalesce(wallet_reversed_at, now()),
      updated_at = now()
    where id = new.id
      and wallet_reversed_at is null;
  end if;


  -- ==========================================================
  -- REVERSO DEL ASIENTO CONTABLE ORIGINAL
  -- ==========================================================

  select ft.id
  into v_original_financial_transaction_id
  from public.financial_transactions ft
  where ft.idempotency_key =
    'trip-payment:' || old.id::text || ':v1'
  order by ft.created_at
  limit 1;

  if v_original_financial_transaction_id is not null then
    v_reversal_key :=
      'trip-payment-failure-reversal:' ||
      old.id::text ||
      ':v1';

    /*
      Si ya existe el reverso, no se vuelve a publicar.
    */
    select ft.id
    into v_reversal_financial_transaction_id
    from public.financial_transactions ft
    where ft.idempotency_key = v_reversal_key
    limit 1;

    if v_reversal_financial_transaction_id is null then
      v_reversal_financial_transaction_id :=
        public.reverse_financial_transaction(
          p_transaction_id =>
            v_original_financial_transaction_id,

          p_reason =>
            coalesce(
              nullif(btrim(new.failure_reason), ''),
              case
                when new.status = 'cancelled'
                  then 'Pago digital cancelado'
                else 'Pago digital fallido'
              end
            ),

          p_idempotency_key =>
            v_reversal_key,

          p_created_by =>
            auth.uid()
        );
    end if;
  end if;


  -- ==========================================================
  -- ACTUALIZAR EL VIAJE
  -- ==========================================================

  update public.trips
  set
    payment_status = new.status,
    payment_reference =
      coalesce(
        new.provider_payment_id,
        payment_reference
      ),
    paid_at = null,
    updated_at = now()
  where id = new.trip_id;


  -- ==========================================================
  -- EVENTO DEL VIAJE
  -- ==========================================================

  insert into public.trip_events (
    trip_id,
    status,
    description,
    created_by
  )
  values (
    new.trip_id,
    'completed',
    format(
      'Pago digital %s. Motivo: %s. Saldo pendiente del conductor revertido: $%s',
      case
        when new.status = 'cancelled'
          then 'cancelado'
        else 'fallido'
      end,
      coalesce(
        nullif(btrim(new.failure_reason), ''),
        'Sin motivo proporcionado'
      ),
      v_driver_amount
    ),
    auth.uid()
  );

  perform public.log_finance_event(
    'digital_trip_payment_failed',
    new.id::text,
    jsonb_build_object(
      'trip_id', new.trip_id,
      'payment_id', new.id,
      'passenger_id', new.passenger_id,
      'driver_id', new.driver_id,
      'payment_status', new.status,
      'failure_reason', new.failure_reason,
      'driver_pending_reversed', v_driver_amount,
      'driver_wallet_transaction_id',
        v_wallet_transaction_id,
      'original_financial_transaction_id',
        v_original_financial_transaction_id,
      'reversal_financial_transaction_id',
        v_reversal_financial_transaction_id,
      'integration_version', 1
    )
  );

  return new;
end;
$function$;


drop trigger if exists
  trg_process_failed_trip_payment
on public.payment_transactions;

create trigger trg_process_failed_trip_payment
after update of status
on public.payment_transactions
for each row
when (
  new.status in ('failed', 'cancelled')
  and old.status is distinct from new.status
)
execute function public.process_failed_trip_payment();


-- ============================================================
-- FUNCIÓN CONTROLADA PARA MARCAR EL PAGO COMO FALLIDO
-- ============================================================

create or replace function public.fail_trip_payment(
  p_payment_id uuid,
  p_failure_reason text,
  p_provider_reference text default null,
  p_provider_payload jsonb default '{}'::jsonb,
  p_cancelled boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_payment public.payment_transactions%rowtype;
  v_target_status text;
  v_reversal_transaction_id uuid;
begin
  if not public.is_axi_finance()
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'No autorizado para registrar pagos fallidos';
  end if;

  if p_payment_id is null then
    raise exception
      'El identificador del pago es obligatorio';
  end if;

  if nullif(btrim(p_failure_reason), '') is null then
    raise exception
      'El motivo del fallo es obligatorio';
  end if;

  v_target_status :=
    case
      when coalesce(p_cancelled, false)
        then 'cancelled'
      else 'failed'
    end;

  select *
  into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;

  if not found then
    raise exception
      'El pago no existe';
  end if;

  if v_payment.method not in ('card', 'mercado_pago') then
    raise exception
      'El pago no corresponde a un método digital';
  end if;

  /*
    Idempotencia:
    si el proveedor repite el mismo webhook después del reverso,
    se devuelve la transacción contable existente.
  */
  if v_payment.status in ('failed', 'cancelled') then
    select ft.id
    into v_reversal_transaction_id
    from public.financial_transactions ft
    where ft.idempotency_key =
      'trip-payment-failure-reversal:' ||
      v_payment.id::text ||
      ':v1'
    limit 1;

    return v_reversal_transaction_id;
  end if;

  if v_payment.status = 'paid'
     or v_payment.wallet_released_at is not null then
    raise exception
      'El pago ya fue confirmado. Debe procesarse mediante el flujo de contracargo.';
  end if;

  if v_payment.status not in ('pending', 'processing') then
    raise exception
      'El pago no puede fallar desde el estado %',
      v_payment.status;
  end if;

  /*
    Este UPDATE activa:

      1. trg_process_failed_trip_payment:
         - wallet pendiente del conductor;
         - reverso contable.

      2. el trigger existente de pasajero:
         - devuelve passenger_wallet_applied;
         - marca passenger_wallet_reversed_at;
         - ajusta el viaje.
  */
  update public.payment_transactions
  set
    status = v_target_status,
    provider_payment_id =
      coalesce(
        nullif(btrim(p_provider_reference), ''),
        provider_payment_id
      ),
    failure_reason = btrim(p_failure_reason),
    paid_at = null,
    updated_at = now()
  where id = v_payment.id;

  /*
    Guardamos el payload del proveedor en el evento financiero,
    sin agregar columnas nuevas a payment_transactions.
  */
  perform public.log_finance_event(
    'digital_trip_payment_failure_received',
    v_payment.id::text,
    jsonb_build_object(
      'trip_id', v_payment.trip_id,
      'payment_id', v_payment.id,
      'provider', v_payment.provider,
      'provider_reference',
        coalesce(
          nullif(btrim(p_provider_reference), ''),
          v_payment.provider_payment_id
        ),
      'target_status', v_target_status,
      'failure_reason', btrim(p_failure_reason),
      'provider_payload',
        coalesce(p_provider_payload, '{}'::jsonb),
      'integration_version', 1
    )
  );

  select ft.id
  into v_reversal_transaction_id
  from public.financial_transactions ft
  where ft.idempotency_key =
    'trip-payment-failure-reversal:' ||
    v_payment.id::text ||
    ':v1'
  limit 1;

  return v_reversal_transaction_id;
end;
$function$;


revoke all
on function public.fail_trip_payment(
  uuid,
  text,
  text,
  jsonb,
  boolean
)
from public;

revoke all
on function public.fail_trip_payment(
  uuid,
  text,
  text,
  jsonb,
  boolean
)
from anon;

grant execute
on function public.fail_trip_payment(
  uuid,
  text,
  text,
  jsonb,
  boolean
)
to authenticated;

grant execute
on function public.fail_trip_payment(
  uuid,
  text,
  text,
  jsonb,
  boolean
)
to service_role;
