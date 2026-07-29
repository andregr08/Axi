-- ============================================================
-- AXI — BACKFILL DE PAGOS LEGACY MARCADOS COMO PAID
--
-- Repara exclusivamente estos pagos:
--   9fd5e871-c246-43c1-a6d9-1ca0bc6e6c07
--   568500f5-f459-4e1b-b9d1-66486a89b7e2
--   8a8d555f-3663-4805-a078-a8799a11d689
--
-- Propiedades:
--   - Transaccional
--   - Idempotente
--   - No modifica pagos ya conciliados
--   - Usa apply_wallet_movement()
--   - Activa el trigger contable existente
-- ============================================================

begin;

create table if not exists public.finance_repair_log (
  id uuid primary key default gen_random_uuid(),
  repair_key text not null unique,
  payment_transaction_id uuid references public.payment_transactions(id),
  trip_id uuid,
  operation text not null,
  previous_state jsonb not null default '{}'::jsonb,
  resulting_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on public.finance_repair_log from anon;
revoke all on public.finance_repair_log from authenticated;

grant select, insert
on public.finance_repair_log
to service_role;

do $backfill$
declare
  v_payment public.payment_transactions%rowtype;

  v_payment_id uuid;

  v_wallet_amount numeric(18,2);
  v_driver_net numeric(18,2);
  v_cash_debt numeric(18,2);

  v_wallet_transaction_id uuid;
  v_financial_transaction_id uuid;

  v_repair_key text;
begin
  foreach v_payment_id in array array[
    '9fd5e871-c246-43c1-a6d9-1ca0bc6e6c07'::uuid,
    '568500f5-f459-4e1b-b9d1-66486a89b7e2'::uuid,
    '8a8d555f-3663-4805-a078-a8799a11d689'::uuid
  ]
  loop
    v_repair_key :=
      'legacy-paid-payment-wallet-backfill:'
      || v_payment_id::text
      || ':v1';

    -- --------------------------------------------------------
    -- Idempotencia del proceso de reparación
    -- --------------------------------------------------------
    if exists (
      select 1
      from public.finance_repair_log
      where repair_key = v_repair_key
    ) then
      raise notice
        'El pago % ya fue reparado anteriormente',
        v_payment_id;

      continue;
    end if;

    -- --------------------------------------------------------
    -- Bloqueo del pago para evitar procesamiento concurrente
    -- --------------------------------------------------------
    select *
    into v_payment
    from public.payment_transactions
    where id = v_payment_id
    for update;

    if not found then
      raise exception
        'No existe el pago legacy %',
        v_payment_id;
    end if;

    -- --------------------------------------------------------
    -- Validaciones estrictas
    -- --------------------------------------------------------
    if v_payment.status <> 'paid' then
      raise exception
        'El pago % tiene estado %, se esperaba paid',
        v_payment.id,
        v_payment.status;
    end if;

    if v_payment.driver_id is null then
      raise exception
        'El pago % no tiene conductor',
        v_payment.id;
    end if;

    if v_payment.method not in (
      'cash',
      'card',
      'mercado_pago'
    ) then
      raise exception
        'El pago % tiene un método no compatible: %',
        v_payment.id,
        v_payment.method;
    end if;

    -- Si ya fue aplicado, no se vuelve a mover dinero.
    if v_payment.wallet_applied_at is not null then
      raise exception
        'El pago % ya tiene wallet_applied_at: %',
        v_payment.id,
        v_payment.wallet_applied_at;
    end if;

    if v_payment.earnings_counted_at is not null then
      raise exception
        'El pago % ya tiene earnings_counted_at: %',
        v_payment.id,
        v_payment.earnings_counted_at;
    end if;

    if exists (
      select 1
      from public.wallet_transactions wt
      where wt.payment_transaction_id = v_payment.id
    ) then
      raise exception
        'El pago % ya tiene movimientos de wallet',
        v_payment.id;
    end if;

    if exists (
      select 1
      from public.financial_transactions ft
      where ft.idempotency_key =
        'trip-payment:' || v_payment.id::text || ':v1'
    ) then
      raise exception
        'El pago % ya tiene asiento contable inicial',
        v_payment.id;
    end if;

    v_driver_net :=
      round(
        coalesce(
          v_payment.driver_net_earnings,
          v_payment.driver_earnings,
          0
        ),
        2
      );

    if v_driver_net < 0 then
      raise exception
        'El pago % tiene ganancia neta negativa: %',
        v_payment.id,
        v_driver_net;
    end if;

    v_wallet_transaction_id := null;
    v_financial_transaction_id := null;

    -- --------------------------------------------------------
    -- PAGOS EN EFECTIVO
    --
    -- El conductor ya recibió el efectivo directamente.
    -- No se agrega el importe del viaje a available_balance.
    --
    -- Se registra:
    --   - deuda del conductor con AXI;
    --   - utilidad de vida del conductor.
    -- --------------------------------------------------------
    if v_payment.method = 'cash' then
      v_cash_debt :=
        round(
          greatest(
            coalesce(v_payment.platform_commission, 0)
            + coalesce(
                v_payment.platform_commission_iva_amount,
                0
              )
            - coalesce(
                v_payment.passenger_wallet_applied,
                0
              ),
            0
          ),
          2
        );

      if v_cash_debt > 0 then
        v_wallet_transaction_id :=
          public.apply_wallet_movement(
            p_driver_id =>
              v_payment.driver_id,

            p_balance_type =>
              'cash_debt',

            p_amount =>
              v_cash_debt,

            p_transaction_type =>
              'cash_trip_commission_debt',

            p_trip_id =>
              v_payment.trip_id,

            p_payment_transaction_id =>
              v_payment.id,

            p_description =>
              'Backfill de deuda por viaje legacy pagado en efectivo',

            p_metadata =>
              jsonb_build_object(
                'repair_key',
                  v_repair_key,
                'repair_version',
                  1,
                'source',
                  'legacy_paid_payment_backfill',
                'platform_commission',
                  coalesce(
                    v_payment.platform_commission,
                    0
                  ),
                'platform_commission_iva',
                  coalesce(
                    v_payment.platform_commission_iva_amount,
                    0
                  ),
                'passenger_wallet_applied',
                  coalesce(
                    v_payment.passenger_wallet_applied,
                    0
                  )
              ),

            p_lifetime_earnings_delta =>
              v_driver_net,

            p_total_withdrawn_delta =>
              0
          );

      elsif v_driver_net > 0 then
        /*
          Caso excepcional:
          no existe deuda en efectivo, pero sí necesitamos
          contabilizar lifetime_earnings.

          Se crea un movimiento neutro sobre available:
          +ganancia y -ganancia dentro de la misma transacción.
          El efecto neto del saldo es cero.
        */

        perform public.apply_wallet_movement(
          p_driver_id =>
            v_payment.driver_id,

          p_balance_type =>
            'available',

          p_amount =>
            v_driver_net,

          p_transaction_type =>
            'legacy_cash_earning_backfill_credit',

          p_trip_id =>
            v_payment.trip_id,

          p_payment_transaction_id =>
            v_payment.id,

          p_description =>
            'Registro temporal de ganancia legacy en efectivo',

          p_metadata =>
            jsonb_build_object(
              'repair_key',
                v_repair_key,
              'neutral_pair',
                true,
              'stage',
                'credit'
            ),

          p_lifetime_earnings_delta =>
            v_driver_net,

          p_total_withdrawn_delta =>
            0
        );

        v_wallet_transaction_id :=
          public.apply_wallet_movement(
            p_driver_id =>
              v_payment.driver_id,

            p_balance_type =>
              'available',

            p_amount =>
              -v_driver_net,

            p_transaction_type =>
              'legacy_cash_earning_backfill_offset',

            p_trip_id =>
              v_payment.trip_id,

            p_payment_transaction_id =>
              v_payment.id,

            p_description =>
              'Compensación de ganancia legacy cobrada en efectivo',

            p_metadata =>
              jsonb_build_object(
                'repair_key',
                  v_repair_key,
                'neutral_pair',
                  true,
                'stage',
                  'offset'
              ),

            p_lifetime_earnings_delta =>
              0,

            p_total_withdrawn_delta =>
              0
          );
      end if;

    -- --------------------------------------------------------
    -- PAGOS DIGITALES YA MARCADOS COMO PAID
    --
    -- El dinero debe quedar disponible para el conductor.
    -- No se pasa por pending porque el proveedor ya figura
    -- confirmado en el registro legacy.
    -- --------------------------------------------------------
    else
      if v_driver_net > 0 then
        v_wallet_transaction_id :=
          public.apply_wallet_movement(
            p_driver_id =>
              v_payment.driver_id,

            p_balance_type =>
              'available',

            p_amount =>
              v_driver_net,

            p_transaction_type =>
              'digital_earning_available',

            p_trip_id =>
              v_payment.trip_id,

            p_payment_transaction_id =>
              v_payment.id,

            p_description =>
              'Backfill de ganancia digital legacy disponible',

            p_metadata =>
              jsonb_build_object(
                'repair_key',
                  v_repair_key,
                'repair_version',
                  1,
                'source',
                  'legacy_paid_payment_backfill',
                'provider',
                  v_payment.provider,
                'provider_reference',
                  v_payment.provider_payment_id,
                'driver_net_earnings',
                  v_driver_net
              ),

            p_lifetime_earnings_delta =>
              v_driver_net,

            p_total_withdrawn_delta =>
              0
          );
      end if;
    end if;

    -- --------------------------------------------------------
    -- Marcar wallet procesada.
    --
    -- Este UPDATE activa:
    -- trg_post_trip_payment_to_ledger
    --
    -- El trigger ejecuta:
    -- post_trip_payment_to_ledger(payment_id)
    -- --------------------------------------------------------
    update public.payment_transactions
    set
      wallet_applied_at =
        coalesce(
          wallet_applied_at,
          paid_at,
          created_at,
          now()
        ),

      earnings_counted_at =
        case
          when v_driver_net > 0 then
            coalesce(
              earnings_counted_at,
              paid_at,
              created_at,
              now()
            )
          else earnings_counted_at
        end,

      updated_at = now()

    where id = v_payment.id
      and wallet_applied_at is null
      and earnings_counted_at is null;

    if not found then
      raise exception
        'No fue posible marcar el pago % como aplicado',
        v_payment.id;
    end if;

    -- --------------------------------------------------------
    -- Verificar que el trigger haya generado la contabilidad
    -- --------------------------------------------------------
    select ft.id
    into v_financial_transaction_id
    from public.financial_transactions ft
    where ft.idempotency_key =
      'trip-payment:' || v_payment.id::text || ':v1'
    limit 1;

    if v_financial_transaction_id is null then
      raise exception
        'No se generó el asiento contable para el pago %',
        v_payment.id;
    end if;

    -- --------------------------------------------------------
    -- Auditoría de reparación
    -- --------------------------------------------------------
    insert into public.finance_repair_log (
      repair_key,
      payment_transaction_id,
      trip_id,
      operation,
      previous_state,
      resulting_state
    )
    values (
      v_repair_key,
      v_payment.id,
      v_payment.trip_id,
      'backfill_legacy_paid_payment',
      jsonb_build_object(
        'status',
          v_payment.status,
        'method',
          v_payment.method,
        'wallet_applied_at',
          v_payment.wallet_applied_at,
        'earnings_counted_at',
          v_payment.earnings_counted_at,
        'driver_net_earnings',
          v_driver_net
      ),
      jsonb_build_object(
        'wallet_transaction_id',
          v_wallet_transaction_id,
        'financial_transaction_id',
          v_financial_transaction_id,
        'wallet_applied',
          true,
        'ledger_posted',
          true
      )
    );

    raise notice
      'Pago % reparado. Wallet: %. Contabilidad: %',
      v_payment.id,
      v_wallet_transaction_id,
      v_financial_transaction_id;
  end loop;
end;
$backfill$;

commit;
