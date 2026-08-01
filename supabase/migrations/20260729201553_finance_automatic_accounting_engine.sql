begin;

-- =========================================================
-- AXI — MOTOR CONTABLE AUTOMÁTICO
-- =========================================================
-- Integra:
--   1. Retiros reservados, pagados y liberados
--   2. Wallet de pasajeros
--   3. Reembolsos
--   4. Pagos de deuda de efectivo
--   5. Ajustes manuales de wallets
--
-- Todas las pólizas se publican mediante:
-- public.post_financial_transaction(...)
--
-- Esa función ya garantiza:
--   - doble partida;
--   - cuentas activas;
--   - moneda compatible;
--   - montos positivos;
--   - idempotencia;
--   - publicación atómica.
-- =========================================================


-- =========================================================
-- 1. RESOLUCIÓN SEGURA DE CUENTAS
-- =========================================================

create or replace function public.require_financial_account(
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_id uuid;
begin
  select id
  into v_account_id
  from public.financial_accounts
  where code = btrim(p_code)
    and status = 'active';

  if v_account_id is null then
    raise exception
      'La cuenta financiera % no existe o no está activa',
      p_code;
  end if;

  return v_account_id;
end;
$function$;

revoke all
on function public.require_financial_account(text)
from public;

comment on function public.require_financial_account(text)
is 'Resuelve una cuenta financiera activa por código y falla si no existe.';


-- =========================================================
-- 2. CONTABILIDAD DE RETIROS
-- =========================================================
--
-- Reserva:
--   Debe  Conductores por pagar
--   Haber Retiros reservados de conductores
--
-- Pago:
--   Debe  Retiros reservados de conductores
--   Haber Bancos
--
-- Liberación por fallo:
--   Debe  Retiros reservados de conductores
--   Haber Conductores por pagar
-- =========================================================

create or replace function public.trigger_post_withdrawal_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_driver_payable uuid;
  v_driver_reserved uuid;
  v_bank uuid;
  v_entries jsonb;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception
      'El retiro % no tiene un monto contable válido',
      new.id;
  end if;

  v_driver_payable :=
    public.require_financial_account(
      'liability.driver_payable'
    );

  v_driver_reserved :=
    public.require_financial_account(
      'liability.driver_reserved'
    );

  v_bank :=
    public.require_financial_account(
      'asset.bank'
    );

  -- -------------------------------------------------------
  -- RESERVA DEL RETIRO
  -- -------------------------------------------------------

  if (
    (
      tg_op = 'INSERT'
      and new.reserved_at is not null
    )
    or
    (
      tg_op = 'UPDATE'
      and old.reserved_at is null
      and new.reserved_at is not null
    )
  ) then
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_driver_payable,
        'direction', 'debit',
        'amount', new.amount,
        'description',
          'Disminución de saldo disponible por retiro reservado',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'withdrawal_status', new.status,
          'accounting_event', 'withdrawal_reserved'
        )
      ),
      jsonb_build_object(
        'account_id', v_driver_reserved,
        'direction', 'credit',
        'amount', new.amount,
        'description',
          'Obligación reservada para pago al conductor',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'withdrawal_status', new.status,
          'accounting_event', 'withdrawal_reserved'
        )
      )
    );

    perform public.post_financial_transaction(
      p_transaction_type =>
        'withdrawal_reserved',

      p_description =>
        format(
          'Reserva de retiro %s del conductor %s',
          new.id,
          new.driver_id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'withdrawal-reserved:' || new.id::text || ':v1',

      p_withdrawal_id =>
        new.id,

      p_metadata =>
        jsonb_build_object(
          'driver_id', new.driver_id,
          'wallet_id', new.wallet_id,
          'amount', new.amount,
          'status', new.status,
          'reserved_at', new.reserved_at,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(new.approved_by, auth.uid()),

      p_effective_at =>
        coalesce(new.reserved_at, new.requested_at, now())
    );
  end if;

  -- -------------------------------------------------------
  -- PAGO DEL RETIRO
  -- -------------------------------------------------------

  if (
    (
      tg_op = 'INSERT'
      and new.status = 'paid'
    )
    or
    (
      tg_op = 'UPDATE'
      and old.status is distinct from 'paid'
      and new.status = 'paid'
    )
  ) then
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_driver_reserved,
        'direction', 'debit',
        'amount', new.amount,
        'description',
          'Cancelación del retiro reservado al conductor',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'provider_reference', new.provider_reference,
          'accounting_event', 'withdrawal_paid'
        )
      ),
      jsonb_build_object(
        'account_id', v_bank,
        'direction', 'credit',
        'amount', new.amount,
        'description',
          'Salida bancaria por retiro pagado',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'bank_name', new.bank_name,
          'provider_reference', new.provider_reference,
          'accounting_event', 'withdrawal_paid'
        )
      )
    );

    perform public.post_financial_transaction(
      p_transaction_type =>
        'withdrawal_paid',

      p_description =>
        format(
          'Pago del retiro %s al conductor %s',
          new.id,
          new.driver_id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'withdrawal-paid:' || new.id::text || ':v1',

      p_withdrawal_id =>
        new.id,

      p_provider_reference =>
        new.provider_reference,

      p_metadata =>
        jsonb_build_object(
          'driver_id', new.driver_id,
          'wallet_id', new.wallet_id,
          'amount', new.amount,
          'bank_name', new.bank_name,
          'provider_reference', new.provider_reference,
          'status', new.status,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(new.approved_by, auth.uid()),

      p_effective_at =>
        coalesce(new.paid_at, now())
    );
  end if;

  -- -------------------------------------------------------
  -- LIBERACIÓN DE RESERVA POR FALLO
  -- -------------------------------------------------------

  if (
    tg_op = 'UPDATE'
    and old.status is distinct from 'failed'
    and new.status = 'failed'
    and new.reserved_at is not null
  ) then
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_driver_reserved,
        'direction', 'debit',
        'amount', new.amount,
        'description',
          'Liberación de retiro reservado fallido',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'failure_reason', new.failure_reason,
          'accounting_event',
            'withdrawal_reservation_released'
        )
      ),
      jsonb_build_object(
        'account_id', v_driver_payable,
        'direction', 'credit',
        'amount', new.amount,
        'description',
          'Restitución del saldo por pagar al conductor',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'failure_reason', new.failure_reason,
          'accounting_event',
            'withdrawal_reservation_released'
        )
      )
    );

    perform public.post_financial_transaction(
      p_transaction_type =>
        'withdrawal_reservation_released',

      p_description =>
        format(
          'Liberación de reserva del retiro fallido %s',
          new.id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'withdrawal-failed-release:' || new.id::text || ':v1',

      p_withdrawal_id =>
        new.id,

      p_metadata =>
        jsonb_build_object(
          'driver_id', new.driver_id,
          'wallet_id', new.wallet_id,
          'amount', new.amount,
          'failure_reason', new.failure_reason,
          'status', new.status,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(new.approved_by, auth.uid()),

      p_effective_at =>
        now()
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists
trg_post_withdrawal_to_ledger
on public.withdraw_requests;

create trigger trg_post_withdrawal_to_ledger
after insert or update
on public.withdraw_requests
for each row
execute function public.trigger_post_withdrawal_to_ledger();


-- =========================================================
-- 3. CONTABILIDAD DE WALLET DE PASAJEROS
-- =========================================================
--
-- Crédito por reembolso:
--   Debe  Gasto por reembolsos
--   Haber Wallets de pasajeros
--
-- Ajuste positivo:
--   Debe  Otros gastos
--   Haber Wallets de pasajeros
--
-- Ajuste negativo:
--   Debe  Wallets de pasajeros
--   Haber Otros ingresos
--
-- trip_payment no se contabiliza aquí porque ya forma parte
-- de la póliza principal del pago del viaje.
-- =========================================================

create or replace function
public.trigger_post_passenger_wallet_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_passenger_wallet uuid;
  v_refund_expense uuid;
  v_other_expense uuid;
  v_other_income uuid;
  v_counterpart_account uuid;
  v_transaction_type text;
  v_description text;
  v_entries jsonb;
  v_amount numeric(18,2);
begin
  if new.transaction_type = 'trip_payment' then
    return new;
  end if;

  v_amount := round(abs(coalesce(new.amount, 0)), 2);

  if v_amount <= 0 then
    return new;
  end if;

  v_passenger_wallet :=
    public.require_financial_account(
      'liability.passenger_wallet'
    );

  v_refund_expense :=
    public.require_financial_account(
      'expense.refunds'
    );

  v_other_expense :=
    public.require_financial_account(
      'expense.other'
    );

  v_other_income :=
    public.require_financial_account(
      'income.other'
    );

  if new.amount > 0 then
    if new.transaction_type = 'refund_credit' then
      v_counterpart_account := v_refund_expense;
      v_transaction_type := 'refund_wallet_credit';
      v_description :=
        'Reembolso acreditado al wallet del pasajero';
    else
      v_counterpart_account := v_other_expense;
      v_transaction_type :=
        'passenger_wallet_credit_adjustment';
      v_description :=
        'Ajuste positivo del wallet del pasajero';
    end if;

    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_counterpart_account,
        'direction', 'debit',
        'amount', v_amount,
        'description', v_description,
        'passenger_id', new.passenger_id,
        'trip_id', new.trip_id,
        'refund_id', new.refund_request_id,
        'metadata', coalesce(new.metadata, '{}'::jsonb)
      ),
      jsonb_build_object(
        'account_id', v_passenger_wallet,
        'direction', 'credit',
        'amount', v_amount,
        'description',
          'Incremento de obligación por wallet del pasajero',
        'passenger_id', new.passenger_id,
        'trip_id', new.trip_id,
        'refund_id', new.refund_request_id,
        'metadata', coalesce(new.metadata, '{}'::jsonb)
      )
    );
  else
    v_transaction_type :=
      'passenger_wallet_debit_adjustment';

    v_description :=
      'Ajuste negativo del wallet del pasajero';

    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_passenger_wallet,
        'direction', 'debit',
        'amount', v_amount,
        'description',
          'Disminución de obligación por wallet del pasajero',
        'passenger_id', new.passenger_id,
        'trip_id', new.trip_id,
        'refund_id', new.refund_request_id,
        'metadata', coalesce(new.metadata, '{}'::jsonb)
      ),
      jsonb_build_object(
        'account_id', v_other_income,
        'direction', 'credit',
        'amount', v_amount,
        'description', v_description,
        'passenger_id', new.passenger_id,
        'trip_id', new.trip_id,
        'refund_id', new.refund_request_id,
        'metadata', coalesce(new.metadata, '{}'::jsonb)
      )
    );
  end if;

  perform public.post_financial_transaction(
    p_transaction_type =>
      v_transaction_type,

    p_description =>
      coalesce(
        new.description,
        v_description
      ),

    p_entries =>
      v_entries,

    p_currency =>
      'MXN',

    p_idempotency_key =>
      'passenger-wallet:' || new.id::text || ':v1',

    p_trip_id =>
      new.trip_id,

    p_refund_id =>
      new.refund_request_id,

    p_passenger_wallet_transaction_id =>
      new.id,

    p_metadata =>
      jsonb_build_object(
        'passenger_id', new.passenger_id,
        'wallet_transaction_type', new.transaction_type,
        'amount', new.amount,
        'balance_before', new.balance_before,
        'balance_after', new.balance_after,
        'source_metadata', coalesce(new.metadata, '{}'::jsonb),
        'integration_version', 1
      ),

    p_created_by =>
      coalesce(new.created_by, auth.uid()),

    p_effective_at =>
      new.created_at
  );

  return new;
end;
$function$;

drop trigger if exists
trg_post_passenger_wallet_to_ledger
on public.passenger_wallet_transactions;

create trigger trg_post_passenger_wallet_to_ledger
after insert
on public.passenger_wallet_transactions
for each row
execute function
public.trigger_post_passenger_wallet_to_ledger();


-- =========================================================
-- 4. CONTABILIDAD DE PAGOS DE DEUDA DE EFECTIVO
-- =========================================================
--
-- Debe  Caja o bancos
-- Haber Deuda de efectivo por cobrar
-- =========================================================

create or replace function
public.trigger_post_cash_debt_payment_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_cash_account uuid;
  v_receivable_account uuid;
  v_entries jsonb;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception
      'El pago de deuda % no tiene un monto válido',
      new.id;
  end if;

  if lower(coalesce(new.payment_method, 'cash')) in (
    'bank',
    'transfer',
    'bank_transfer',
    'spei',
    'card',
    'mercado_pago'
  ) then
    v_cash_account :=
      public.require_financial_account('asset.bank');
  else
    v_cash_account :=
      public.require_financial_account('asset.cash');
  end if;

  v_receivable_account :=
    public.require_financial_account(
      'asset.cash_debt_receivable'
    );

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_cash_account,
      'direction', 'debit',
      'amount', new.amount,
      'description',
        'Entrada por pago de deuda del conductor',
      'driver_id', new.driver_id,
      'metadata', jsonb_build_object(
        'cash_debt_payment_id', new.id,
        'payment_method', new.payment_method,
        'reference', new.reference
      )
    ),
    jsonb_build_object(
      'account_id', v_receivable_account,
      'direction', 'credit',
      'amount', new.amount,
      'description',
        'Disminución de deuda de efectivo por cobrar',
      'driver_id', new.driver_id,
      'metadata', jsonb_build_object(
        'cash_debt_payment_id', new.id,
        'payment_method', new.payment_method,
        'reference', new.reference
      )
    )
  );

  perform public.post_financial_transaction(
    p_transaction_type =>
      'cash_debt_payment',

    p_description =>
      format(
        'Pago de deuda de efectivo %s del conductor %s',
        new.id,
        new.driver_id
      ),

    p_entries =>
      v_entries,

    p_currency =>
      'MXN',

    p_idempotency_key =>
      'cash-debt-payment:' || new.id::text || ':v1',

    p_metadata =>
      jsonb_build_object(
        'cash_debt_payment_id', new.id,
        'driver_id', new.driver_id,
        'wallet_id', new.wallet_id,
        'amount', new.amount,
        'payment_method', new.payment_method,
        'reference', new.reference,
        'notes', new.notes,
        'integration_version', 1
      ),

    p_created_by =>
      coalesce(new.created_by, auth.uid()),

    p_effective_at =>
      new.created_at
  );

  return new;
end;
$function$;

drop trigger if exists
trg_post_cash_debt_payment_to_ledger
on public.cash_debt_payments;

create trigger trg_post_cash_debt_payment_to_ledger
after insert
on public.cash_debt_payments
for each row
execute function
public.trigger_post_cash_debt_payment_to_ledger();


-- =========================================================
-- 5. CONTABILIDAD DE AJUSTES MANUALES DE CONDUCTORES
-- =========================================================
--
-- Saldos available y pending:
--   crédito operativo:
--     Debe  Otros gastos
--     Haber Conductores por pagar
--
--   débito operativo:
--     Debe  Conductores por pagar
--     Haber Otros ingresos
--
-- Saldo reserved:
--   usa liability.driver_reserved.
--
-- Saldo cash_debt:
--   crédito:
--     Debe  Deuda por cobrar
--     Haber Otros ingresos
--
--   débito:
--     Debe  Otros gastos
--     Haber Deuda por cobrar
-- =========================================================

create or replace function
public.trigger_post_manual_wallet_adjustment_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_driver_liability uuid;
  v_cash_debt_receivable uuid;
  v_other_expense uuid;
  v_other_income uuid;
  v_entries jsonb;
  v_amount numeric(18,2);
  v_is_credit boolean;
begin
  v_amount := round(abs(coalesce(new.amount, 0)), 2);

  if v_amount <= 0 then
    raise exception
      'El ajuste manual % no tiene un monto válido',
      new.id;
  end if;

  v_is_credit :=
    lower(coalesce(new.adjustment_type, '')) = 'credit';

  v_cash_debt_receivable :=
    public.require_financial_account(
      'asset.cash_debt_receivable'
    );

  v_other_expense :=
    public.require_financial_account(
      'expense.other'
    );

  v_other_income :=
    public.require_financial_account(
      'income.other'
    );

  if new.balance_type = 'reserved' then
    v_driver_liability :=
      public.require_financial_account(
        'liability.driver_reserved'
      );
  else
    v_driver_liability :=
      public.require_financial_account(
        'liability.driver_payable'
      );
  end if;

  if new.balance_type = 'cash_debt' then
    if v_is_credit then
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_cash_debt_receivable,
          'direction', 'debit',
          'amount', v_amount,
          'description',
            'Incremento manual de deuda del conductor',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        ),
        jsonb_build_object(
          'account_id', v_other_income,
          'direction', 'credit',
          'amount', v_amount,
          'description',
            'Contrapartida de incremento manual de deuda',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        )
      );
    else
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_other_expense,
          'direction', 'debit',
          'amount', v_amount,
          'description',
            'Condonación o corrección manual de deuda',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        ),
        jsonb_build_object(
          'account_id', v_cash_debt_receivable,
          'direction', 'credit',
          'amount', v_amount,
          'description',
            'Disminución manual de deuda por cobrar',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        )
      );
    end if;
  else
    if v_is_credit then
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_other_expense,
          'direction', 'debit',
          'amount', v_amount,
          'description',
            'Gasto por ajuste positivo al conductor',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        ),
        jsonb_build_object(
          'account_id', v_driver_liability,
          'direction', 'credit',
          'amount', v_amount,
          'description',
            'Incremento de saldo por pagar al conductor',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        )
      );
    else
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_driver_liability,
          'direction', 'debit',
          'amount', v_amount,
          'description',
            'Disminución manual de saldo del conductor',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        ),
        jsonb_build_object(
          'account_id', v_other_income,
          'direction', 'credit',
          'amount', v_amount,
          'description',
            'Contrapartida de ajuste negativo al conductor',
          'driver_id', new.driver_id,
          'metadata', coalesce(new.metadata, '{}'::jsonb)
        )
      );
    end if;
  end if;

  perform public.post_financial_transaction(
    p_transaction_type =>
      'manual_wallet_adjustment',

    p_description =>
      coalesce(
        nullif(btrim(new.reason), ''),
        'Ajuste manual de wallet del conductor'
      ),

    p_entries =>
      v_entries,

    p_currency =>
      'MXN',

    p_idempotency_key =>
      'manual-wallet-adjustment:' || new.id::text || ':v1',

    p_wallet_transaction_id =>
      new.wallet_transaction_id,

    p_metadata =>
      jsonb_build_object(
        'manual_adjustment_id', new.id,
        'driver_id', new.driver_id,
        'amount', new.amount,
        'balance_type', new.balance_type,
        'adjustment_type', new.adjustment_type,
        'reason', new.reason,
        'wallet_transaction_id', new.wallet_transaction_id,
        'source_metadata', coalesce(new.metadata, '{}'::jsonb),
        'integration_version', 1
      ),

    p_created_by =>
      coalesce(new.admin_id, auth.uid()),

    p_effective_at =>
      new.created_at
  );

  return new;
end;
$function$;

drop trigger if exists
trg_post_manual_wallet_adjustment_to_ledger
on public.manual_wallet_adjustments;

create trigger trg_post_manual_wallet_adjustment_to_ledger
after insert
on public.manual_wallet_adjustments
for each row
execute function
public.trigger_post_manual_wallet_adjustment_to_ledger();


-- =========================================================
-- 6. ÍNDICES DE APOYO
-- =========================================================

create index if not exists
financial_transactions_withdrawal_id_idx
on public.financial_transactions(withdrawal_id)
where withdrawal_id is not null;

create index if not exists
financial_transactions_refund_id_idx
on public.financial_transactions(refund_id)
where refund_id is not null;

create index if not exists
financial_transactions_wallet_transaction_id_idx
on public.financial_transactions(wallet_transaction_id)
where wallet_transaction_id is not null;

create index if not exists
financial_transactions_passenger_wallet_tx_idx
on public.financial_transactions(
  passenger_wallet_transaction_id
)
where passenger_wallet_transaction_id is not null;


-- =========================================================
-- 7. COMENTARIOS
-- =========================================================

comment on function
public.trigger_post_withdrawal_to_ledger()
is 'Publica automáticamente reservas, pagos y liberaciones de retiros.';

comment on function
public.trigger_post_passenger_wallet_to_ledger()
is 'Publica reembolsos y ajustes del wallet de pasajeros.';

comment on function
public.trigger_post_cash_debt_payment_to_ledger()
is 'Publica pagos realizados por conductores sobre deuda de efectivo.';

comment on function
public.trigger_post_manual_wallet_adjustment_to_ledger()
is 'Publica ajustes manuales realizados por Finanzas sobre wallets de conductores.';

commit;
