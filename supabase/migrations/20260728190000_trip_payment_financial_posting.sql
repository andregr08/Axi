-- ============================================================
-- AXI: integración automática de pagos con Financial Ledger
-- Generado desde la función real de Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.post_financial_transaction(p_transaction_type text, p_description text, p_entries jsonb, p_currency text DEFAULT 'MXN'::text, p_idempotency_key text DEFAULT NULL::text, p_trip_id uuid DEFAULT NULL::uuid, p_payment_id uuid DEFAULT NULL::uuid, p_refund_id uuid DEFAULT NULL::uuid, p_withdrawal_id uuid DEFAULT NULL::uuid, p_wallet_transaction_id uuid DEFAULT NULL::uuid, p_passenger_wallet_transaction_id uuid DEFAULT NULL::uuid, p_provider text DEFAULT NULL::text, p_provider_reference text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_created_by uuid DEFAULT NULL::uuid, p_effective_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_transaction_id uuid;
  v_existing_id uuid;
  v_entry jsonb;
  v_entry_number integer := 0;
  v_account_id uuid;
  v_account_currency text;
  v_direction text;
  v_amount numeric(18,2);
begin
  /*
    Las llamadas normales siguen requiriendo acceso financiero.

    Los triggers internos creados por AXI pueden publicar movimientos
    automáticamente porque solamente el propietario de la base puede
    crear o modificar esos triggers.
  */
  if pg_trigger_depth() = 0 then
    perform public.require_finance_access();
  end if;

  if nullif(btrim(p_transaction_type), '') is null then
    raise exception 'El tipo de transacción es obligatorio';
  end if;

  if jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) < 2 then
    raise exception
      'p_entries debe contener al menos dos asientos';
  end if;

  if nullif(btrim(p_idempotency_key), '') is not null then
    select id
    into v_existing_id
    from public.financial_transactions
    where idempotency_key = btrim(p_idempotency_key);

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  insert into public.financial_transactions (
    transaction_type,
    status,
    currency,
    description,
    trip_id,
    payment_id,
    refund_id,
    withdrawal_id,
    wallet_transaction_id,
    passenger_wallet_transaction_id,
    provider,
    provider_reference,
    idempotency_key,
    created_by,
    metadata,
    effective_at,
    posted_at
  )
  values (
    btrim(p_transaction_type),
    'pending',
    upper(p_currency),
    nullif(btrim(p_description), ''),
    p_trip_id,
    p_payment_id,
    p_refund_id,
    p_withdrawal_id,
    p_wallet_transaction_id,
    p_passenger_wallet_transaction_id,
    nullif(btrim(p_provider), ''),
    nullif(btrim(p_provider_reference), ''),
    nullif(btrim(p_idempotency_key), ''),
    coalesce(p_created_by, auth.uid()),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_effective_at, now()),
    null
  )
  returning id into v_transaction_id;

  for v_entry in
    select value
    from jsonb_array_elements(p_entries)
  loop
    v_entry_number := v_entry_number + 1;

    begin
      v_account_id :=
        nullif(v_entry->>'account_id', '')::uuid;
    exception
      when others then
        raise exception
          'account_id inválido en asiento %',
          v_entry_number;
    end;

    v_direction := lower(v_entry->>'direction');

    begin
      v_amount :=
        round((v_entry->>'amount')::numeric, 2);
    exception
      when others then
        raise exception
          'amount inválido en asiento %',
          v_entry_number;
    end;

    if v_account_id is null then
      raise exception
        'account_id es obligatorio en asiento %',
        v_entry_number;
    end if;

    if v_direction not in ('debit', 'credit') then
      raise exception
        'direction inválido en asiento %',
        v_entry_number;
    end if;

    if v_amount is null or v_amount <= 0 then
      raise exception
        'amount debe ser mayor a cero en asiento %',
        v_entry_number;
    end if;

    select currency
    into v_account_currency
    from public.financial_accounts
    where id = v_account_id
      and status = 'active';

    if not found then
      raise exception
        'Cuenta inexistente o inactiva en asiento %',
        v_entry_number;
    end if;

    if v_account_currency <> upper(p_currency) then
      raise exception
        'La moneda de la cuenta no coincide en asiento %',
        v_entry_number;
    end if;

    insert into public.financial_ledger_entries (
      transaction_id,
      account_id,
      entry_number,
      direction,
      amount,
      currency,
      description,
      user_id,
      driver_id,
      passenger_id,
      trip_id,
      payment_id,
      refund_id,
      withdrawal_id,
      created_by,
      metadata
    )
    values (
      v_transaction_id,
      v_account_id,
      v_entry_number,
      v_direction,
      v_amount,
      upper(p_currency),
      nullif(btrim(v_entry->>'description'), ''),
      nullif(v_entry->>'user_id', '')::uuid,
      nullif(v_entry->>'driver_id', '')::uuid,
      nullif(v_entry->>'passenger_id', '')::uuid,
      coalesce(
        nullif(v_entry->>'trip_id', '')::uuid,
        p_trip_id
      ),
      coalesce(
        nullif(v_entry->>'payment_id', '')::uuid,
        p_payment_id
      ),
      coalesce(
        nullif(v_entry->>'refund_id', '')::uuid,
        p_refund_id
      ),
      coalesce(
        nullif(v_entry->>'withdrawal_id', '')::uuid,
        p_withdrawal_id
      ),
      coalesce(p_created_by, auth.uid()),
      coalesce(v_entry->'metadata', '{}'::jsonb)
    );
  end loop;

  perform public.assert_financial_transaction_balanced(
    v_transaction_id
  );

  update public.financial_transactions
  set
    status = 'posted',
    posted_at = now(),
    updated_at = now()
  where id = v_transaction_id;

  return v_transaction_id;

exception
  when unique_violation then
    if nullif(btrim(p_idempotency_key), '') is not null then
      select id
      into v_existing_id
      from public.financial_transactions
      where idempotency_key = btrim(p_idempotency_key);

      if v_existing_id is not null then
        return v_existing_id;
      end if;
    end if;

    raise;
end;
$function$;


-- ============================================================
-- CUENTAS FISCALES DEL FLUJO DE PAGOS
-- ============================================================

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
values
  (
    'liability.platform_vat_payable',
    'IVA por pagar de comisiones AXI',
    'IVA trasladado correspondiente a las comisiones de AXI',
    'liability',
    'platform',
    null,
    'credit',
    'MXN',
    'active',
    false,
    jsonb_build_object(
      'system_account', true,
      'source', 'trip_payment_ledger'
    )
  ),
  (
    'liability.driver_iva_withheld',
    'IVA retenido a conductores',
    'IVA retenido a conductores pendiente de entero',
    'liability',
    'platform',
    null,
    'credit',
    'MXN',
    'active',
    false,
    jsonb_build_object(
      'system_account', true,
      'source', 'trip_payment_ledger'
    )
  ),
  (
    'liability.driver_isr_withheld',
    'ISR retenido a conductores',
    'ISR retenido a conductores pendiente de entero',
    'liability',
    'platform',
    null,
    'credit',
    'MXN',
    'active',
    false,
    jsonb_build_object(
      'system_account', true,
      'source', 'trip_payment_ledger'
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
-- PUBLICACIÓN CONTABLE DE UN PAGO DE VIAJE
-- ============================================================

create or replace function public.post_trip_payment_to_ledger(
  p_payment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_payment public.payment_transactions%rowtype;

  v_provider_account uuid;
  v_cash_debt_account uuid;
  v_passenger_wallet_account uuid;
  v_platform_income_account uuid;
  v_driver_payable_account uuid;
  v_platform_vat_account uuid;
  v_driver_iva_account uuid;
  v_driver_isr_account uuid;

  v_entries jsonb := '[]'::jsonb;

  v_total numeric(18,2);
  v_wallet numeric(18,2);
  v_external numeric(18,2);
  v_driver_net numeric(18,2);
  v_platform_vat numeric(18,2);
  v_iva_withheld numeric(18,2);
  v_isr_withheld numeric(18,2);
  v_platform_income numeric(18,2);
  v_cash_receivable numeric(18,2);

  v_ledger_transaction_id uuid;
begin
  select *
  into v_payment
  from public.payment_transactions
  where id = p_payment_id;

  if not found then
    raise exception
      'No existe el pago %',
      p_payment_id;
  end if;

  /*
    create_trip_payment establece wallet_applied_at cuando terminó
    correctamente los movimientos de wallet.
  */
  if v_payment.wallet_applied_at is null then
    return null;
  end if;

  if v_payment.status in ('failed', 'cancelled') then
    return null;
  end if;

  select id into v_provider_account
  from public.financial_accounts
  where code = 'asset.provider_clearing'
    and status = 'active';

  select id into v_cash_debt_account
  from public.financial_accounts
  where code = 'asset.cash_debt_receivable'
    and status = 'active';

  select id into v_passenger_wallet_account
  from public.financial_accounts
  where code = 'liability.passenger_wallet'
    and status = 'active';

  select id into v_platform_income_account
  from public.financial_accounts
  where code = 'income.platform_commission'
    and status = 'active';

  select id into v_driver_payable_account
  from public.financial_accounts
  where code = 'liability.driver_payable'
    and status = 'active';

  select id into v_platform_vat_account
  from public.financial_accounts
  where code = 'liability.platform_vat_payable'
    and status = 'active';

  select id into v_driver_iva_account
  from public.financial_accounts
  where code = 'liability.driver_iva_withheld'
    and status = 'active';

  select id into v_driver_isr_account
  from public.financial_accounts
  where code = 'liability.driver_isr_withheld'
    and status = 'active';

  if v_platform_income_account is null
     or v_platform_vat_account is null then
    raise exception
      'Faltan cuentas financieras obligatorias para publicar el pago';
  end if;

  v_total :=
    round(coalesce(v_payment.total_amount, 0), 2);

  v_wallet :=
    round(coalesce(v_payment.passenger_wallet_applied, 0), 2);

  v_external :=
    round(coalesce(v_payment.external_amount, 0), 2);

  v_driver_net :=
    round(coalesce(v_payment.driver_net_earnings, 0), 2);

  v_platform_vat :=
    round(
      coalesce(v_payment.platform_commission_iva_amount, 0),
      2
    );

  v_iva_withheld :=
    round(coalesce(v_payment.iva_withholding_amount, 0), 2);

  v_isr_withheld :=
    round(coalesce(v_payment.isr_withholding_amount, 0), 2);

  if v_total <= 0 then
    raise exception
      'El pago % no tiene un total válido',
      p_payment_id;
  end if;

  if v_wallet > 0 then
    v_entries :=
      v_entries || jsonb_build_array(
        jsonb_build_object(
          'account_id', v_passenger_wallet_account,
          'direction', 'debit',
          'amount', v_wallet,
          'description',
            'Saldo AXI aplicado al pago del viaje',
          'passenger_id', v_payment.passenger_id,
          'trip_id', v_payment.trip_id,
          'payment_id', v_payment.id
        )
      );
  end if;

  if v_payment.method = 'cash' then
    /*
      En efectivo el conductor cobra directamente.

      AXI reconoce como cuenta por cobrar:
      comisión + IVA de comisión - wallet aplicado.
    */
    v_cash_receivable :=
      round(
        greatest(
          coalesce(v_payment.platform_commission, 0)
          + v_platform_vat
          - v_wallet,
          0
        ),
        2
      );

    if v_cash_receivable > 0 then
      v_entries :=
        v_entries || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_cash_debt_account,
            'direction', 'debit',
            'amount', v_cash_receivable,
            'description',
              'Deuda del conductor por viaje en efectivo',
            'driver_id', v_payment.driver_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          )
        );
    end if;

    /*
      El ingreso se calcula como residuo para absorber correctamente
      el wallet aplicado y cualquier diferencia de redondeo.
    */
    v_platform_income :=
      round(
        v_wallet
        + v_cash_receivable
        - v_platform_vat,
        2
      );

  else
    /*
      En tarjeta o Mercado Pago, el proveedor mantiene los fondos
      hasta que el pago sea liquidado.
    */
    if v_external > 0 then
      v_entries :=
        v_entries || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_provider_account,
            'direction', 'debit',
            'amount', v_external,
            'description',
              'Fondos del viaje pendientes en proveedor',
            'passenger_id', v_payment.passenger_id,
            'driver_id', v_payment.driver_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          )
        );
    end if;

    if v_driver_net > 0 then
      v_entries :=
        v_entries || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_driver_payable_account,
            'direction', 'credit',
            'amount', v_driver_net,
            'description',
              'Ganancia neta por pagar al conductor',
            'driver_id', v_payment.driver_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          )
        );
    end if;

    if v_iva_withheld > 0 then
      v_entries :=
        v_entries || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_driver_iva_account,
            'direction', 'credit',
            'amount', v_iva_withheld,
            'description',
              'IVA retenido al conductor',
            'driver_id', v_payment.driver_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          )
        );
    end if;

    if v_isr_withheld > 0 then
      v_entries :=
        v_entries || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_driver_isr_account,
            'direction', 'credit',
            'amount', v_isr_withheld,
            'description',
              'ISR retenido al conductor',
            'driver_id', v_payment.driver_id,
            'trip_id', v_payment.trip_id,
            'payment_id', v_payment.id
          )
        );
    end if;

    /*
      Total cobrado menos los pasivos fiscales y el neto del
      conductor. Así el asiento queda balanceado incluso si hay
      diferencias de centavos en cálculos fiscales.
    */
    v_platform_income :=
      round(
        v_total
        - v_driver_net
        - v_platform_vat
        - v_iva_withheld
        - v_isr_withheld,
        2
      );
  end if;

  if v_platform_vat > 0 then
    v_entries :=
      v_entries || jsonb_build_array(
        jsonb_build_object(
          'account_id', v_platform_vat_account,
          'direction', 'credit',
          'amount', v_platform_vat,
          'description',
            'IVA de la comisión de AXI',
          'trip_id', v_payment.trip_id,
          'payment_id', v_payment.id
        )
      );
  end if;

  if v_platform_income > 0 then
    v_entries :=
      v_entries || jsonb_build_array(
        jsonb_build_object(
          'account_id', v_platform_income_account,
          'direction', 'credit',
          'amount', v_platform_income,
          'description',
            'Ingreso de AXI por el viaje',
          'trip_id', v_payment.trip_id,
          'payment_id', v_payment.id
        )
      );
  end if;

  if jsonb_array_length(v_entries) < 2 then
    raise exception
      'No fue posible construir el asiento del pago %',
      p_payment_id;
  end if;

  v_ledger_transaction_id :=
    public.post_financial_transaction(
      p_transaction_type =>
        'trip_payment',

      p_description =>
        format(
          'Pago de viaje %s mediante %s',
          v_payment.trip_id,
          v_payment.method
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'trip-payment:' || v_payment.id::text || ':v1',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_id =>
        v_payment.id,

      p_passenger_wallet_transaction_id =>
        v_payment.passenger_wallet_transaction_id,

      p_provider =>
        v_payment.provider,

      p_provider_reference =>
        v_payment.provider_payment_id,

      p_metadata =>
        jsonb_build_object(
          'payment_method', v_payment.method,
          'payment_status', v_payment.status,
          'gross_total', v_total,
          'external_amount', v_external,
          'passenger_wallet_applied', v_wallet,
          'reported_platform_commission',
            v_payment.platform_commission,
          'ledger_platform_income',
            v_platform_income,
          'platform_commission_iva',
            v_platform_vat,
          'driver_net_earnings',
            v_driver_net,
          'iva_withheld',
            v_iva_withheld,
          'isr_withheld',
            v_isr_withheld,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(auth.uid(), v_payment.passenger_id),

      p_effective_at =>
        coalesce(v_payment.paid_at, now())
    );

  return v_ledger_transaction_id;
end;
$function$;


-- Solamente el backend y los triggers internos pueden ejecutarla.
revoke all
on function public.post_trip_payment_to_ledger(uuid)
from public;

revoke all
on function public.post_trip_payment_to_ledger(uuid)
from anon;

revoke all
on function public.post_trip_payment_to_ledger(uuid)
from authenticated;

grant execute
on function public.post_trip_payment_to_ledger(uuid)
to service_role;


-- ============================================================
-- TRIGGER AUTOMÁTICO
-- ============================================================

create or replace function public.trigger_post_trip_payment_to_ledger()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  /*
    Publicamos solamente después de que create_trip_payment haya
    terminado de aplicar los movimientos de wallet.
  */
  if new.wallet_applied_at is not null
     and new.status not in ('failed', 'cancelled')
     and (
       tg_op = 'INSERT'
       or old.wallet_applied_at is distinct from new.wallet_applied_at
       or old.status is distinct from new.status
       or old.passenger_wallet_transaction_id
          is distinct from new.passenger_wallet_transaction_id
     ) then

    perform public.post_trip_payment_to_ledger(new.id);
  end if;

  return new;
end;
$function$;

revoke all
on function public.trigger_post_trip_payment_to_ledger()
from public, anon, authenticated;

drop trigger if exists
  trg_post_trip_payment_to_ledger
on public.payment_transactions;

create trigger trg_post_trip_payment_to_ledger
after insert or update of
  wallet_applied_at,
  status,
  passenger_wallet_transaction_id
on public.payment_transactions
for each row
execute function public.trigger_post_trip_payment_to_ledger();


-- ============================================================
-- BACKFILL SEGURO DE PAGOS YA EXISTENTES
-- ============================================================

do $block$
declare
  v_payment_id uuid;
begin
  for v_payment_id in
    select pt.id
    from public.payment_transactions pt
    where pt.wallet_applied_at is not null
      and pt.status not in ('failed', 'cancelled')
      and not exists (
        select 1
        from public.financial_transactions ft
        where ft.idempotency_key =
          'trip-payment:' || pt.id::text || ':v1'
      )
    order by pt.created_at
  loop
    perform public.post_trip_payment_to_ledger(v_payment_id);
  end loop;
end;
$block$;
