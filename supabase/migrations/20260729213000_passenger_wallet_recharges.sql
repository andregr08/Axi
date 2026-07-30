-- =========================================================
-- AXI: RECARGAS DEL WALLET DEL PASAJERO
-- =========================================================
--
-- Flujo:
--   1. Se crea una recarga pendiente.
--   2. El proveedor confirma el pago.
--   3. Se acredita el wallet del pasajero.
--   4. Se genera automáticamente la póliza:
--
--      Debe  Banco
--      Haber Wallet del pasajero
--
-- La confirmación completa ocurre dentro de una sola
-- transacción PostgreSQL. Cualquier error provoca rollback.
-- =========================================================


-- =========================================================
-- 1. PERMITIR EL TIPO recharge_credit
-- =========================================================

alter table public.passenger_wallet_transactions
  drop constraint if exists
    passenger_wallet_transactions_transaction_type_check;

alter table public.passenger_wallet_transactions
  add constraint
    passenger_wallet_transactions_transaction_type_check
  check (
    transaction_type in (
      'refund_credit',
      'trip_payment',
      'adjustment_credit',
      'adjustment_debit',
      'reversal',
      'recharge_credit'
    )
  );


-- =========================================================
-- 2. TABLA DE RECARGAS
-- =========================================================

create table if not exists public.passenger_wallet_recharges (
  id uuid primary key default gen_random_uuid(),

  passenger_id uuid not null
    references public.profiles(id)
    on delete restrict,

  amount numeric(12,2) not null
    check (amount > 0),

  currency text not null default 'MXN'
    check (currency = 'MXN'),

  payment_method text not null
    check (
      payment_method in (
        'card',
        'mercado_pago',
        'bank_transfer'
      )
    ),

  provider text null,

  provider_reference text null,

  idempotency_key text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'paid',
        'failed',
        'cancelled'
      )
    ),

  wallet_transaction_id uuid null
    references public.passenger_wallet_transactions(id)
    on delete restrict,

  requested_by uuid null
    references public.profiles(id)
    on delete set null,

  confirmed_by uuid null
    references public.profiles(id)
    on delete set null,

  failure_reason text null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  paid_at timestamptz null,

  failed_at timestamptz null,

  cancelled_at timestamptz null,

  updated_at timestamptz not null default now(),

  constraint passenger_wallet_recharge_paid_fields_check
  check (
    (
      status = 'paid'
      and paid_at is not null
      and wallet_transaction_id is not null
    )
    or
    (
      status <> 'paid'
    )
  )
);


-- Una clave por intento lógico de recarga.
create unique index if not exists
  passenger_wallet_recharges_idempotency_unique
on public.passenger_wallet_recharges(idempotency_key);


-- Una misma referencia del proveedor no puede acreditarse dos veces.
create unique index if not exists
  passenger_wallet_recharges_provider_reference_unique
on public.passenger_wallet_recharges(
  provider,
  provider_reference
)
where provider_reference is not null;


-- Un movimiento del wallet solo puede corresponder a una recarga.
create unique index if not exists
  passenger_wallet_recharges_wallet_transaction_unique
on public.passenger_wallet_recharges(wallet_transaction_id)
where wallet_transaction_id is not null;


create index if not exists
  passenger_wallet_recharges_passenger_created_idx
on public.passenger_wallet_recharges(
  passenger_id,
  created_at desc
);


create index if not exists
  passenger_wallet_recharges_status_created_idx
on public.passenger_wallet_recharges(
  status,
  created_at desc
);


-- =========================================================
-- 3. EVITAR QUE EL TRIGGER GENÉRICO CONTABILICE LA RECARGA
-- =========================================================
--
-- La recarga se contabiliza dentro de confirm_passenger_wallet_recharge()
-- para que wallet y ledger formen una sola transacción atómica.
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
  if new.transaction_type in (
    'trip_payment',
    'recharge_credit'
  ) then
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
        'source_metadata',
          coalesce(new.metadata, '{}'::jsonb),
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


-- =========================================================
-- 4. CREAR RECARGA PENDIENTE
-- =========================================================

create or replace function public.create_passenger_wallet_recharge(
  p_amount numeric,
  p_payment_method text,
  p_idempotency_key text,
  p_provider text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_passenger_id uuid;
  v_recharge_id uuid;
begin
  v_passenger_id := auth.uid();

  if v_passenger_id is null then
    raise exception 'Debes iniciar sesión para crear una recarga';
  end if;

  if round(coalesce(p_amount, 0), 2) <= 0 then
    raise exception 'El monto de la recarga debe ser mayor a cero';
  end if;

  if p_payment_method not in (
    'card',
    'mercado_pago',
    'bank_transfer'
  ) then
    raise exception 'Método de pago de recarga inválido';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'La clave de idempotencia es obligatoria';
  end if;

  insert into public.passenger_wallet_recharges (
    passenger_id,
    amount,
    payment_method,
    provider,
    idempotency_key,
    requested_by,
    metadata
  )
  values (
    v_passenger_id,
    round(p_amount::numeric, 2),
    p_payment_method,
    nullif(btrim(coalesce(p_provider, '')), ''),
    btrim(p_idempotency_key),
    v_passenger_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (idempotency_key)
  do update
  set idempotency_key =
    excluded.idempotency_key
  where
    passenger_wallet_recharges.passenger_id =
      excluded.passenger_id
    and passenger_wallet_recharges.amount =
      excluded.amount
    and passenger_wallet_recharges.payment_method =
      excluded.payment_method
  returning id into v_recharge_id;

  if v_recharge_id is null then
    raise exception
      'La clave de idempotencia ya fue utilizada con datos diferentes';
  end if;

  return v_recharge_id;
end;
$function$;


-- =========================================================
-- 5. CONFIRMAR RECARGA
-- =========================================================
--
-- Esta función debe llamarse únicamente después de que
-- el proveedor confirme que el dinero fue recibido.
-- =========================================================

create or replace function public.confirm_passenger_wallet_recharge(
  p_recharge_id uuid,
  p_provider_reference text,
  p_provider text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_recharge public.passenger_wallet_recharges%rowtype;
  v_wallet_transaction_id uuid;
  v_bank_account uuid;
  v_passenger_wallet_account uuid;
  v_entries jsonb;
begin
  if p_recharge_id is null then
    raise exception 'La recarga es obligatoria';
  end if;

  if nullif(
    btrim(coalesce(p_provider_reference, '')),
    ''
  ) is null then
    raise exception 'La referencia del proveedor es obligatoria';
  end if;

  select *
  into v_recharge
  from public.passenger_wallet_recharges
  where id = p_recharge_id
  for update;

  if not found then
    raise exception 'Recarga no encontrada';
  end if;

  -- Idempotencia: confirmar dos veces devuelve el mismo resultado.
  if v_recharge.status = 'paid' then
    if v_recharge.provider_reference
      is distinct from btrim(p_provider_reference) then
      raise exception
        'La recarga ya fue confirmada con otra referencia';
    end if;

    return v_recharge.wallet_transaction_id;
  end if;

  if v_recharge.status <> 'pending' then
    raise exception
      'La recarga no puede confirmarse porque está en estado %',
      v_recharge.status;
  end if;

  if v_recharge.amount <= 0 then
    raise exception 'La recarga contiene un monto inválido';
  end if;

  v_bank_account :=
    public.require_financial_account('asset.bank');

  v_passenger_wallet_account :=
    public.require_financial_account(
      'liability.passenger_wallet'
    );

  -- Primero se acredita el wallet.
  v_wallet_transaction_id :=
    public.apply_passenger_wallet_movement(
      p_passenger_id =>
        v_recharge.passenger_id,

      p_amount =>
        v_recharge.amount,

      p_transaction_type =>
        'recharge_credit',

      p_description =>
        'Recarga pagada del wallet del pasajero',

      p_trip_id =>
        null,

      p_refund_request_id =>
        null,

      p_metadata =>
        jsonb_build_object(
          'recharge_id', v_recharge.id,
          'provider',
            coalesce(
              nullif(btrim(coalesce(p_provider, '')), ''),
              v_recharge.provider
            ),
          'provider_reference',
            btrim(p_provider_reference),
          'payment_method',
            v_recharge.payment_method,
          'source_metadata',
            coalesce(p_metadata, '{}'::jsonb)
        )
    );

  -- Después se crea la póliza contable.
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_bank_account,
      'direction', 'debit',
      'amount', v_recharge.amount,
      'description',
        'Fondos recibidos por recarga de wallet',
      'passenger_id', v_recharge.passenger_id,
      'metadata',
        jsonb_build_object(
          'recharge_id', v_recharge.id,
          'provider_reference',
            btrim(p_provider_reference),
          'payment_method',
            v_recharge.payment_method
        )
    ),
    jsonb_build_object(
      'account_id', v_passenger_wallet_account,
      'direction', 'credit',
      'amount', v_recharge.amount,
      'description',
        'Obligación por saldo del wallet del pasajero',
      'passenger_id', v_recharge.passenger_id,
      'metadata',
        jsonb_build_object(
          'recharge_id', v_recharge.id,
          'wallet_transaction_id',
            v_wallet_transaction_id
        )
    )
  );

  perform public.post_financial_transaction(
    p_transaction_type =>
      'passenger_wallet_recharge',

    p_description =>
      'Recarga confirmada del wallet del pasajero',

    p_entries =>
      v_entries,

    p_currency =>
      'MXN',

    p_idempotency_key =>
      'passenger-wallet-recharge:'
      || v_recharge.id::text
      || ':v1',

    p_passenger_wallet_transaction_id =>
      v_wallet_transaction_id,

    p_provider =>
      coalesce(
        nullif(btrim(coalesce(p_provider, '')), ''),
        v_recharge.provider
      ),

    p_provider_reference =>
      btrim(p_provider_reference),

    p_metadata =>
      jsonb_build_object(
        'recharge_id', v_recharge.id,
        'passenger_id', v_recharge.passenger_id,
        'payment_method', v_recharge.payment_method,
        'amount', v_recharge.amount,
        'wallet_transaction_id',
          v_wallet_transaction_id,
        'source_metadata',
          coalesce(v_recharge.metadata, '{}'::jsonb),
        'confirmation_metadata',
          coalesce(p_metadata, '{}'::jsonb),
        'integration_version', 1
      ),

    p_created_by =>
      auth.uid(),

    p_effective_at =>
      now()
  );

  update public.passenger_wallet_recharges
  set
    status = 'paid',
    provider =
      coalesce(
        nullif(btrim(coalesce(p_provider, '')), ''),
        provider
      ),
    provider_reference =
      btrim(p_provider_reference),
    wallet_transaction_id =
      v_wallet_transaction_id,
    confirmed_by =
      auth.uid(),
    paid_at =
      now(),
    failure_reason =
      null,
    metadata =
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'confirmation',
        coalesce(p_metadata, '{}'::jsonb)
      ),
    updated_at =
      now()
  where id = v_recharge.id;

  return v_wallet_transaction_id;
end;
$function$;


-- =========================================================
-- 6. MARCAR RECARGA FALLIDA
-- =========================================================

create or replace function public.fail_passenger_wallet_recharge(
  p_recharge_id uuid,
  p_failure_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_recharge public.passenger_wallet_recharges%rowtype;
begin
  if nullif(
    btrim(coalesce(p_failure_reason, '')),
    ''
  ) is null then
    raise exception 'El motivo del fallo es obligatorio';
  end if;

  select *
  into v_recharge
  from public.passenger_wallet_recharges
  where id = p_recharge_id
  for update;

  if not found then
    raise exception 'Recarga no encontrada';
  end if;

  if v_recharge.status = 'paid' then
    raise exception
      'Una recarga pagada no puede marcarse como fallida';
  end if;

  if v_recharge.status = 'failed' then
    return;
  end if;

  if v_recharge.status <> 'pending' then
    raise exception
      'La recarga no puede fallar porque está en estado %',
      v_recharge.status;
  end if;

  update public.passenger_wallet_recharges
  set
    status = 'failed',
    failure_reason = btrim(p_failure_reason),
    failed_at = now(),
    updated_at = now()
  where id = p_recharge_id;
end;
$function$;


-- =========================================================
-- 7. SEGURIDAD
-- =========================================================

alter table public.passenger_wallet_recharges
  enable row level security;


drop policy if exists
  passenger_wallet_recharges_select_own
on public.passenger_wallet_recharges;

create policy
  passenger_wallet_recharges_select_own
on public.passenger_wallet_recharges
for select
to authenticated
using (
  passenger_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role::text in (
        'admin',
        'finance'
      )
  )
);


revoke all
on table public.passenger_wallet_recharges
from public, anon, authenticated;

grant select
on table public.passenger_wallet_recharges
to authenticated;


revoke all
on function public.create_passenger_wallet_recharge(
  numeric,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.create_passenger_wallet_recharge(
  numeric,
  text,
  text,
  text,
  jsonb
)
to authenticated;


revoke all
on function public.confirm_passenger_wallet_recharge(
  uuid,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.confirm_passenger_wallet_recharge(
  uuid,
  text,
  text,
  jsonb
)
to service_role;


revoke all
on function public.fail_passenger_wallet_recharge(
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.fail_passenger_wallet_recharge(
  uuid,
  text
)
to service_role;


comment on table public.passenger_wallet_recharges is
  'Intentos de recarga monetaria del wallet de pasajeros.';


comment on function public.create_passenger_wallet_recharge(
  numeric,
  text,
  text,
  text,
  jsonb
) is
  'Crea de forma idempotente una recarga pendiente para el pasajero autenticado.';


comment on function public.confirm_passenger_wallet_recharge(
  uuid,
  text,
  text,
  jsonb
) is
  'Confirma una recarga, acredita el wallet y publica su póliza contable de forma atómica.';


comment on function public.fail_passenger_wallet_recharge(
  uuid,
  text
) is
  'Marca como fallida una recarga pendiente sin modificar el wallet ni el ledger.';
