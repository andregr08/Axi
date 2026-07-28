-- ============================================================
-- AXI FINANCIAL LEDGER CORE
-- Libro contable interno de doble partida.
--
-- Esta primera fase:
--   1. Crea cuentas financieras.
--   2. Crea transacciones financieras.
--   3. Crea asientos contables.
--   4. Valida que débitos = créditos.
--   5. Permite idempotencia.
--   6. No reemplaza todavía driver_wallets ni wallets existentes.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. CUENTAS FINANCIERAS
-- ============================================================

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  name text not null,
  description text null,

  account_type text not null
    check (
      account_type in (
        'asset',
        'liability',
        'equity',
        'income',
        'expense'
      )
    ),

  owner_type text not null default 'platform'
    check (
      owner_type in (
        'platform',
        'driver',
        'passenger',
        'provider',
        'bank',
        'system'
      )
    ),

  owner_id uuid null,

  currency text not null default 'MXN'
    check (char_length(currency) = 3),

  normal_balance text not null
    check (normal_balance in ('debit', 'credit')),

  status text not null default 'active'
    check (status in ('active', 'inactive', 'closed')),

  allows_negative_balance boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique nulls not distinct (
    owner_type,
    owner_id,
    code,
    currency
  )
);

comment on table public.financial_accounts is
  'Catálogo de cuentas internas del sistema financiero AXI.';

comment on column public.financial_accounts.code is
  'Código estable y legible de la cuenta.';

comment on column public.financial_accounts.normal_balance is
  'Naturaleza normal de la cuenta: debit o credit.';

create index if not exists financial_accounts_owner_idx
  on public.financial_accounts(owner_type, owner_id);

create index if not exists financial_accounts_type_idx
  on public.financial_accounts(account_type, status);

-- ============================================================
-- 2. TRANSACCIONES FINANCIERAS
-- ============================================================

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),

  transaction_type text not null,

  status text not null default 'posted'
    check (
      status in (
        'draft',
        'pending',
        'posted',
        'reversed',
        'cancelled',
        'failed'
      )
    ),

  currency text not null default 'MXN'
    check (char_length(currency) = 3),

  description text null,

  trip_id uuid null,
  payment_id uuid null,
  refund_id uuid null,
  withdrawal_id uuid null,
  wallet_transaction_id uuid null,
  passenger_wallet_transaction_id uuid null,

  provider text null,
  provider_reference text null,

  idempotency_key text null unique,

  reversal_of_transaction_id uuid null
    references public.financial_transactions(id),

  created_by uuid null,

  metadata jsonb not null default '{}'::jsonb,

  effective_at timestamptz not null default now(),
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    status <> 'posted'
    or posted_at is not null
  ),

  check (
    reversal_of_transaction_id is null
    or reversal_of_transaction_id <> id
  )
);

comment on table public.financial_transactions is
  'Encabezado de cada evento financiero registrado en AXI.';

comment on column public.financial_transactions.idempotency_key is
  'Evita registrar dos veces el mismo evento o webhook.';

create index if not exists financial_transactions_type_idx
  on public.financial_transactions(transaction_type, created_at desc);

create index if not exists financial_transactions_trip_idx
  on public.financial_transactions(trip_id)
  where trip_id is not null;

create index if not exists financial_transactions_payment_idx
  on public.financial_transactions(payment_id)
  where payment_id is not null;

create index if not exists financial_transactions_refund_idx
  on public.financial_transactions(refund_id)
  where refund_id is not null;

create index if not exists financial_transactions_withdrawal_idx
  on public.financial_transactions(withdrawal_id)
  where withdrawal_id is not null;

create index if not exists financial_transactions_provider_idx
  on public.financial_transactions(provider, provider_reference)
  where provider_reference is not null;

-- ============================================================
-- 3. ASIENTOS CONTABLES
-- ============================================================

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),

  transaction_id uuid not null
    references public.financial_transactions(id)
    on delete restrict,

  account_id uuid not null
    references public.financial_accounts(id)
    on delete restrict,

  entry_number integer not null,

  direction text not null
    check (direction in ('debit', 'credit')),

  amount numeric(18,2) not null
    check (amount > 0),

  currency text not null default 'MXN'
    check (char_length(currency) = 3),

  description text null,

  user_id uuid null,
  driver_id uuid null,
  passenger_id uuid null,

  trip_id uuid null,
  payment_id uuid null,
  refund_id uuid null,
  withdrawal_id uuid null,

  created_by uuid null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  unique(transaction_id, entry_number)
);

comment on table public.financial_ledger_entries is
  'Débitos y créditos inmutables del libro contable AXI.';

create index if not exists ledger_entries_transaction_idx
  on public.financial_ledger_entries(transaction_id);

create index if not exists ledger_entries_account_idx
  on public.financial_ledger_entries(account_id, created_at desc);

create index if not exists ledger_entries_driver_idx
  on public.financial_ledger_entries(driver_id, created_at desc)
  where driver_id is not null;

create index if not exists ledger_entries_passenger_idx
  on public.financial_ledger_entries(passenger_id, created_at desc)
  where passenger_id is not null;

create index if not exists ledger_entries_trip_idx
  on public.financial_ledger_entries(trip_id)
  where trip_id is not null;

-- ============================================================
-- 4. CONTROL DE INMUTABILIDAD
-- ============================================================

create or replace function public.prevent_financial_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'Los asientos contables publicados son inmutables. Registra una reversa.';
end;
$$;

drop trigger if exists financial_ledger_entries_no_update
  on public.financial_ledger_entries;

create trigger financial_ledger_entries_no_update
before update or delete
on public.financial_ledger_entries
for each row
execute function public.prevent_financial_ledger_mutation();

-- ============================================================
-- 5. AUTORIZACIÓN FINANCIERA
-- ============================================================

create or replace function public.require_finance_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Permite procesos internos ejecutados con service_role.
  if auth.role() = 'service_role' then
    return;
  end if;

  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  v_role := public.get_current_user_role()::text;

  if v_role not in ('admin', 'finance') then
    raise exception
      'No tienes permisos para ejecutar operaciones financieras';
  end if;
end;
$$;

-- ============================================================
-- 6. VALIDACIÓN DE DOBLE PARTIDA
-- ============================================================

create or replace function public.assert_financial_transaction_balanced(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_currency text;
  v_debits numeric(18,2);
  v_credits numeric(18,2);
  v_entries integer;
  v_currency_count integer;
begin
  select
    status,
    currency
  into
    v_status,
    v_currency
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacción financiera no encontrada';
  end if;

  select
    count(*),
    count(distinct currency),
    coalesce(
      sum(amount) filter (where direction = 'debit'),
      0
    ),
    coalesce(
      sum(amount) filter (where direction = 'credit'),
      0
    )
  into
    v_entries,
    v_currency_count,
    v_debits,
    v_credits
  from public.financial_ledger_entries
  where transaction_id = p_transaction_id;

  if v_entries < 2 then
    raise exception
      'Una transacción debe tener al menos dos asientos';
  end if;

  if v_currency_count <> 1 then
    raise exception
      'Todos los asientos deben usar la misma moneda';
  end if;

  if exists (
    select 1
    from public.financial_ledger_entries
    where transaction_id = p_transaction_id
      and currency <> v_currency
  ) then
    raise exception
      'La moneda de los asientos no coincide con la transacción';
  end if;

  if round(v_debits, 2) <> round(v_credits, 2) then
    raise exception
      'Transacción desbalanceada. Débitos: %, Créditos: %',
      v_debits,
      v_credits;
  end if;

  if v_status = 'posted' then
    update public.financial_transactions
    set
      posted_at = coalesce(posted_at, now()),
      updated_at = now()
    where id = p_transaction_id;
  end if;
end;
$$;

-- ============================================================
-- 6. FUNCIÓN PARA CREAR CUENTAS
-- ============================================================

create or replace function public.ensure_financial_account(
  p_code text,
  p_name text,
  p_account_type text,
  p_owner_type text default 'platform',
  p_owner_id uuid default null,
  p_normal_balance text default 'debit',
  p_currency text default 'MXN',
  p_description text default null,
  p_allows_negative_balance boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  perform public.require_finance_access();

  if nullif(btrim(p_code), '') is null then
    raise exception 'El código de cuenta es obligatorio';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'El nombre de cuenta es obligatorio';
  end if;

  insert into public.financial_accounts (
    code,
    name,
    account_type,
    owner_type,
    owner_id,
    normal_balance,
    currency,
    description,
    allows_negative_balance,
    metadata
  )
  values (
    btrim(p_code),
    btrim(p_name),
    p_account_type,
    p_owner_type,
    p_owner_id,
    p_normal_balance,
    upper(p_currency),
    nullif(btrim(p_description), ''),
    p_allows_negative_balance,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (
    owner_type,
    owner_id,
    code,
    currency
  )
  do update set
    name = excluded.name,
    description = coalesce(
      excluded.description,
      public.financial_accounts.description
    ),
    status = 'active',
    updated_at = now()
  returning id into v_account_id;

  return v_account_id;
end;
$$;

-- ============================================================
-- 7. FUNCIÓN CENTRAL PARA PUBLICAR TRANSACCIONES
--
-- p_entries ejemplo:
-- [
--   {
--     "account_id": "uuid",
--     "direction": "debit",
--     "amount": 400,
--     "description": "Cobro del viaje"
--   },
--   {
--     "account_id": "uuid",
--     "direction": "credit",
--     "amount": 320,
--     "driver_id": "uuid"
--   },
--   {
--     "account_id": "uuid",
--     "direction": "credit",
--     "amount": 80
--   }
-- ]
-- ============================================================

create or replace function public.post_financial_transaction(
  p_transaction_type text,
  p_description text,
  p_entries jsonb,
  p_currency text default 'MXN',
  p_idempotency_key text default null,
  p_trip_id uuid default null,
  p_payment_id uuid default null,
  p_refund_id uuid default null,
  p_withdrawal_id uuid default null,
  p_wallet_transaction_id uuid default null,
  p_passenger_wallet_transaction_id uuid default null,
  p_provider text default null,
  p_provider_reference text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_effective_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  perform public.require_finance_access();

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
$$;

-- ============================================================
-- 8. REVERSA CONTABLE
-- ============================================================

create or replace function public.reverse_financial_transaction(
  p_transaction_id uuid,
  p_reason text,
  p_idempotency_key text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.financial_transactions%rowtype;
  v_entries jsonb;
  v_reversal_id uuid;
begin
  perform public.require_finance_access();

  select *
  into v_original
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacción original no encontrada';
  end if;

  if v_original.status <> 'posted' then
    raise exception
      'Solo se pueden revertir transacciones publicadas';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where reversal_of_transaction_id = p_transaction_id
      and status = 'posted'
  ) then
    raise exception 'La transacción ya fue revertida';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'account_id', entry.account_id,
      'direction',
        case
          when entry.direction = 'debit' then 'credit'
          else 'debit'
        end,
      'amount', entry.amount,
      'description',
        concat(
          'Reversa: ',
          coalesce(entry.description, v_original.description)
        ),
      'user_id', entry.user_id,
      'driver_id', entry.driver_id,
      'passenger_id', entry.passenger_id,
      'trip_id', entry.trip_id,
      'payment_id', entry.payment_id,
      'refund_id', entry.refund_id,
      'withdrawal_id', entry.withdrawal_id,
      'metadata',
        jsonb_build_object(
          'reversal_of_entry_id',
          entry.id
        )
    )
    order by entry.entry_number
  )
  into v_entries
  from public.financial_ledger_entries entry
  where entry.transaction_id = p_transaction_id;

  v_reversal_id := public.post_financial_transaction(
    p_transaction_type :=
      concat('reversal.', v_original.transaction_type),

    p_description :=
      concat(
        'Reversa de ',
        v_original.transaction_type,
        ': ',
        coalesce(nullif(btrim(p_reason), ''), 'Sin motivo')
      ),

    p_entries := v_entries,
    p_currency := v_original.currency,

    p_idempotency_key :=
      coalesce(
        nullif(btrim(p_idempotency_key), ''),
        concat('reversal:', p_transaction_id)
      ),

    p_trip_id := v_original.trip_id,
    p_payment_id := v_original.payment_id,
    p_refund_id := v_original.refund_id,
    p_withdrawal_id := v_original.withdrawal_id,
    p_provider := v_original.provider,
    p_provider_reference := v_original.provider_reference,

    p_metadata :=
      jsonb_build_object(
        'reversal_of_transaction_id',
        p_transaction_id,
        'reason',
        p_reason
      ),

    p_created_by := coalesce(p_created_by, auth.uid()),
    p_effective_at := now()
  );

  update public.financial_transactions
  set
    reversal_of_transaction_id = p_transaction_id,
    updated_at = now()
  where id = v_reversal_id;

  update public.financial_transactions
  set
    status = 'reversed',
    updated_at = now()
  where id = p_transaction_id;

  return v_reversal_id;
end;
$$;

-- ============================================================
-- 9. VISTAS CONTABLES
-- ============================================================

create or replace view public.financial_account_balances
with (security_invoker = true)
as
select
  account.id as account_id,
  account.code,
  account.name,
  account.account_type,
  account.owner_type,
  account.owner_id,
  account.currency,
  account.normal_balance,

  coalesce(
    sum(entry.amount)
      filter (where entry.direction = 'debit'),
    0
  )::numeric(18,2) as total_debits,

  coalesce(
    sum(entry.amount)
      filter (where entry.direction = 'credit'),
    0
  )::numeric(18,2) as total_credits,

  case
    when account.normal_balance = 'debit' then
      (
        coalesce(
          sum(entry.amount)
            filter (where entry.direction = 'debit'),
          0
        )
        -
        coalesce(
          sum(entry.amount)
            filter (where entry.direction = 'credit'),
          0
        )
      )::numeric(18,2)

    else
      (
        coalesce(
          sum(entry.amount)
            filter (where entry.direction = 'credit'),
          0
        )
        -
        coalesce(
          sum(entry.amount)
            filter (where entry.direction = 'debit'),
          0
        )
      )::numeric(18,2)
  end as balance,

  max(entry.created_at) as last_movement_at

from public.financial_accounts account
left join public.financial_ledger_entries entry
  on entry.account_id = account.id
  and exists (
    select 1
    from public.financial_transactions posted_transaction
    where posted_transaction.id = entry.transaction_id
      and posted_transaction.status = 'posted'
  )
group by
  account.id,
  account.code,
  account.name,
  account.account_type,
  account.owner_type,
  account.owner_id,
  account.currency,
  account.normal_balance;

create or replace view public.financial_transaction_totals
with (security_invoker = true)
as
select
  transaction.id,
  transaction.transaction_type,
  transaction.status,
  transaction.currency,
  transaction.description,
  transaction.trip_id,
  transaction.payment_id,
  transaction.refund_id,
  transaction.withdrawal_id,
  transaction.provider,
  transaction.provider_reference,
  transaction.idempotency_key,
  transaction.effective_at,
  transaction.posted_at,
  transaction.created_at,

  coalesce(
    sum(entry.amount)
      filter (where entry.direction = 'debit'),
    0
  )::numeric(18,2) as total_debits,

  coalesce(
    sum(entry.amount)
      filter (where entry.direction = 'credit'),
    0
  )::numeric(18,2) as total_credits,

  count(entry.id) as entry_count,

  (
    round(
      coalesce(
        sum(entry.amount)
          filter (where entry.direction = 'debit'),
        0
      ),
      2
    )
    =
    round(
      coalesce(
        sum(entry.amount)
          filter (where entry.direction = 'credit'),
        0
      ),
      2
    )
  ) as is_balanced

from public.financial_transactions transaction
left join public.financial_ledger_entries entry
  on entry.transaction_id = transaction.id
group by transaction.id;

-- ============================================================
-- 10. CUENTAS BASE DE AXI
--
-- Se insertan directamente porque durante una migración no
-- existe auth.uid() ni una sesión autenticada.
-- ============================================================

insert into public.financial_accounts (
  code,
  name,
  description,
  account_type,
  owner_type,
  owner_id,
  currency,
  normal_balance,
  status,
  allows_negative_balance,
  metadata
)
values
  (
    'asset.provider_clearing',
    'Fondos en proveedor de pagos',
    'Fondos cobrados pendientes de conciliación o dispersión.',
    'asset',
    'provider',
    null,
    'MXN',
    'debit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'asset.bank',
    'Cuenta bancaria AXI',
    'Fondos disponibles en la cuenta bancaria de AXI.',
    'asset',
    'bank',
    null,
    'MXN',
    'debit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'asset.cash_debt_receivable',
    'Deuda de efectivo por cobrar',
    'Comisiones que los conductores deben a AXI por viajes en efectivo.',
    'asset',
    'platform',
    null,
    'MXN',
    'debit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'liability.driver_payable',
    'Saldo por pagar a conductores',
    'Ganancias reconocidas de conductores todavía no retiradas.',
    'liability',
    'platform',
    null,
    'MXN',
    'credit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'liability.driver_reserved',
    'Retiros reservados de conductores',
    'Fondos apartados para retiros solicitados.',
    'liability',
    'platform',
    null,
    'MXN',
    'credit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'liability.passenger_wallet',
    'Saldo Wallet de pasajeros',
    'Créditos internos pendientes de utilizar por pasajeros.',
    'liability',
    'platform',
    null,
    'MXN',
    'credit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'liability.refunds_payable',
    'Reembolsos por pagar',
    'Reembolsos aprobados pendientes de entrega.',
    'liability',
    'platform',
    null,
    'MXN',
    'credit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'income.platform_commission',
    'Ingresos por comisión AXI',
    'Ingresos obtenidos por comisión de viajes.',
    'income',
    'platform',
    null,
    'MXN',
    'credit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'expense.refunds',
    'Gasto por reembolsos',
    'Importes reconocidos como gasto por reembolsos.',
    'expense',
    'platform',
    null,
    'MXN',
    'debit',
    'active',
    false,
    '{}'::jsonb
  ),
  (
    'expense.payment_fees',
    'Comisiones de proveedores de pago',
    'Comisiones cobradas por procesadores financieros.',
    'expense',
    'platform',
    null,
    'MXN',
    'debit',
    'active',
    false,
    '{}'::jsonb
  )
on conflict (code)
do update set
  name = excluded.name,
  description = excluded.description,
  account_type = excluded.account_type,
  owner_type = excluded.owner_type,
  currency = excluded.currency,
  normal_balance = excluded.normal_balance,
  status = 'active',
  updated_at = now();

-- ============================================================
-- 11. SEGURIDAD
-- ============================================================

alter table public.financial_accounts
  enable row level security;

alter table public.financial_transactions
  enable row level security;

alter table public.financial_ledger_entries
  enable row level security;

drop policy if exists financial_accounts_staff_select
  on public.financial_accounts;

create policy financial_accounts_staff_select
on public.financial_accounts
for select
to authenticated
using (
  public.get_current_user_role()::text in ('admin', 'finance')
);

drop policy if exists financial_transactions_staff_select
  on public.financial_transactions;

create policy financial_transactions_staff_select
on public.financial_transactions
for select
to authenticated
using (
  public.get_current_user_role()::text in ('admin', 'finance')
);

drop policy if exists financial_ledger_entries_staff_select
  on public.financial_ledger_entries;

create policy financial_ledger_entries_staff_select
on public.financial_ledger_entries
for select
to authenticated
using (
  public.get_current_user_role()::text in ('admin', 'finance')
);

revoke all
on public.financial_accounts
from anon, authenticated;

revoke all
on public.financial_transactions
from anon, authenticated;

revoke all
on public.financial_ledger_entries
from anon, authenticated;

grant select
on public.financial_accounts
to authenticated;

grant select
on public.financial_transactions
to authenticated;

grant select
on public.financial_ledger_entries
to authenticated;

grant select
on public.financial_account_balances
to authenticated;

grant select
on public.financial_transaction_totals
to authenticated;

revoke all
on function public.require_finance_access()
from public, anon, authenticated;

grant execute
on function public.require_finance_access()
to authenticated, service_role;

revoke all
on function public.ensure_financial_account(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  jsonb
)
from public, anon, authenticated;

revoke all
on function public.post_financial_transaction(
  text,
  text,
  jsonb,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function public.reverse_financial_transaction(
  uuid,
  text,
  text,
  uuid
)
from public, anon, authenticated;

revoke all
on function public.assert_financial_transaction_balanced(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_financial_account(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  jsonb
)
to service_role;

grant execute
on function public.post_financial_transaction(
  text,
  text,
  jsonb,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  timestamptz
)
to service_role;

grant execute
on function public.reverse_financial_transaction(
  uuid,
  text,
  text,
  uuid
)
to service_role;

grant execute
on function public.assert_financial_transaction_balanced(uuid)
to service_role;

-- Admin y Finanzas pueden usar las funciones desde sesiones autenticadas.
grant execute
on function public.ensure_financial_account(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  jsonb
)
to authenticated;

grant execute
on function public.post_financial_transaction(
  text,
  text,
  jsonb,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  timestamptz
)
to authenticated;

grant execute
on function public.reverse_financial_transaction(
  uuid,
  text,
  text,
  uuid
)
to authenticated;

-- ============================================================
-- FIN
-- ============================================================
