begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. FOLIOS CONTABLES PARA EL LEDGER
-- =========================================================

create sequence if not exists public.financial_ledger_folio_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 20;

alter table public.financial_transactions
  add column if not exists ledger_folio text;

alter table public.financial_transactions
  alter column ledger_folio
  set default (
    'AXI-LED-' ||
    lpad(
      nextval('public.financial_ledger_folio_seq')::text,
      12,
      '0'
    )
  );

-- Backfill sin depender de proveedores externos.
-- ALTER TABLE no dispara el trigger de inmutabilidad del ledger.
do $$
declare
  current_row record;
begin
  for current_row in
    select id
    from public.financial_transactions
    where ledger_folio is null
    order by created_at, id
  loop
    begin
      update public.financial_transactions
      set ledger_folio =
        'AXI-LED-' ||
        lpad(
          nextval(
            'public.financial_ledger_folio_seq'
          )::text,
          12,
          '0'
        )
      where id = current_row.id;
    exception
      when others then
        raise notice
          'No se pudo asignar folio a %: %',
          current_row.id,
          sqlerrm;
    end;
  end loop;
end;
$$;

create unique index if not exists
  financial_transactions_ledger_folio_key
on public.financial_transactions (ledger_folio)
where ledger_folio is not null;

create or replace function public.assign_financial_ledger_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ledger_folio is null then
    new.ledger_folio :=
      'AXI-LED-' ||
      lpad(
        nextval(
          'public.financial_ledger_folio_seq'
        )::text,
        12,
        '0'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_assign_financial_ledger_folio
on public.financial_transactions;

create trigger trg_assign_financial_ledger_folio
before insert on public.financial_transactions
for each row
execute function public.assign_financial_ledger_folio();

-- =========================================================
-- 2. SECUENCIA Y TABLA DE CIERRES
-- =========================================================

create sequence if not exists public.finance_daily_closure_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 10;

create table if not exists public.finance_daily_closures (
  id uuid primary key default gen_random_uuid(),

  closure_folio text not null unique default (
    'AXI-CIE-' ||
    to_char(current_date, 'YYYYMMDD') ||
    '-' ||
    lpad(
      nextval(
        'public.finance_daily_closure_seq'
      )::text,
      6,
      '0'
    )
  ),

  finance_date date not null,

  status text not null default 'closed'
    check (
      status in (
        'closed',
        'reopened',
        'superseded'
      )
    ),

  currency text not null default 'MXN',

  paid_payments integer not null default 0,

  gross_revenue numeric(14,2)
    not null default 0,

  platform_commission numeric(14,2)
    not null default 0,

  gross_driver_earnings numeric(14,2)
    not null default 0,

  net_driver_earnings numeric(14,2)
    not null default 0,

  cash_amount numeric(14,2)
    not null default 0,

  digital_amount numeric(14,2)
    not null default 0,

  platform_commission_iva numeric(14,2)
    not null default 0,

  iva_withholding numeric(14,2)
    not null default 0,

  isr_withholding numeric(14,2)
    not null default 0,

  pending_refunds integer
    not null default 0,

  pending_refund_amount numeric(14,2)
    not null default 0,

  approved_refunds integer
    not null default 0,

  approved_refund_amount numeric(14,2)
    not null default 0,

  open_withdrawals integer
    not null default 0,

  open_withdrawal_amount numeric(14,2)
    not null default 0,

  cash_debt_total numeric(14,2)
    not null default 0,

  available_wallet_balance numeric(14,2)
    not null default 0,

  pending_wallet_balance numeric(14,2)
    not null default 0,

  reserved_wallet_balance numeric(14,2)
    not null default 0,

  posted_financial_transactions integer
    not null default 0,

  pending_financial_transactions integer
    not null default 0,

  reversed_financial_transactions integer
    not null default 0,

  unreconciled_payments integer
    not null default 0,

  unreconciled_amount numeric(14,2)
    not null default 0,

  snapshot jsonb not null default '{}'::jsonb,

  integrity_hash text not null,

  closed_by uuid references auth.users(id),
  closed_at timestamptz not null default now(),

  reopened_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopening_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    status <> 'reopened'
    or (
      reopened_by is not null
      and reopened_at is not null
      and length(trim(reopening_reason)) >= 10
    )
  )
);

create unique index if not exists
  finance_one_active_closure_per_day
on public.finance_daily_closures (finance_date)
where status = 'closed';

create index if not exists
  finance_daily_closures_date_idx
on public.finance_daily_closures (
  finance_date desc,
  closed_at desc
);

create index if not exists
  finance_daily_closures_status_idx
on public.finance_daily_closures (status);

-- =========================================================
-- 3. PERMISOS
-- =========================================================

alter table public.finance_daily_closures
enable row level security;

drop policy if exists
  finance_daily_closures_staff_select
on public.finance_daily_closures;

create policy finance_daily_closures_staff_select
on public.finance_daily_closures
for select
to authenticated
using (public.is_axi_finance());

revoke all on public.finance_daily_closures
from anon;

revoke insert, update, delete
on public.finance_daily_closures
from authenticated;

grant select
on public.finance_daily_closures
to authenticated;

grant usage, select
on sequence public.finance_daily_closure_seq
to authenticated;

grant usage, select
on sequence public.financial_ledger_folio_seq
to authenticated;

-- =========================================================
-- 4. SUPER ADMIN
-- =========================================================

create or replace function public.is_axi_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role::text = 'super_admin'
  );
$$;

revoke all
on function public.is_axi_super_admin()
from public;

grant execute
on function public.is_axi_super_admin()
to authenticated;

-- =========================================================
-- 5. HASH DE INTEGRIDAD
-- =========================================================

create or replace function public.finance_closure_hash(
  p_snapshot jsonb
)
returns text
language sql
immutable
as $$
  select encode(
    extensions.digest(
      convert_to(
        coalesce(p_snapshot, '{}'::jsonb)::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all
on function public.finance_closure_hash(jsonb)
from public;

grant execute
on function public.finance_closure_hash(jsonb)
to authenticated;

-- =========================================================
-- 6. FUNCIÓN DE CIERRE
-- =========================================================

create or replace function public.close_finance_day(
  p_date date default current_date
)
returns public.finance_daily_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  revenue_record record;
  closure_record public.finance_daily_closures%rowtype;
  snapshot_data jsonb;

  v_pending_refunds integer := 0;
  v_pending_refund_amount numeric := 0;

  v_approved_refunds integer := 0;
  v_approved_refund_amount numeric := 0;

  v_open_withdrawals integer := 0;
  v_open_withdrawal_amount numeric := 0;

  v_cash_debt numeric := 0;
  v_available numeric := 0;
  v_pending numeric := 0;
  v_reserved numeric := 0;

  v_posted integer := 0;
  v_pending_transactions integer := 0;
  v_reversed integer := 0;

  v_unreconciled integer := 0;
  v_unreconciled_amount numeric := 0;
begin
  perform public.require_finance_access();

  if p_date is null then
    raise exception 'La fecha del cierre es obligatoria';
  end if;

  if p_date > current_date then
    raise exception
      'No se puede cerrar una fecha futura';
  end if;

  if exists (
    select 1
    from public.finance_daily_closures
    where finance_date = p_date
      and status = 'closed'
  ) then
    raise exception
      'El día % ya tiene un cierre activo',
      p_date;
  end if;

  select *
  into revenue_record
  from public.finance_daily_revenue_v2
  where finance_date = p_date;

  if not found then
    select
      p_date as finance_date,
      0::bigint as paid_payments,
      0::numeric as gross_revenue,
      0::numeric as platform_commission,
      0::numeric as gross_driver_earnings,
      0::numeric as net_driver_earnings,
      0::numeric as cash_amount,
      0::numeric as digital_amount,
      0::numeric as platform_commission_iva,
      0::numeric as iva_withholding,
      0::numeric as isr_withholding
    into revenue_record;
  end if;

  select
    count(*) filter (
      where status in (
        'pending',
        'requested',
        'under_review'
      )
    ),
    coalesce(
      sum(amount) filter (
        where status in (
          'pending',
          'requested',
          'under_review'
        )
      ),
      0
    ),
    count(*) filter (
      where status in (
        'approved',
        'completed',
        'credited'
      )
    ),
    coalesce(
      sum(amount) filter (
        where status in (
          'approved',
          'completed',
          'credited'
        )
      ),
      0
    )
  into
    v_pending_refunds,
    v_pending_refund_amount,
    v_approved_refunds,
    v_approved_refund_amount
  from public.refund_requests
  where coalesce(
    requested_at,
    created_at
  ) >= p_date::timestamptz
    and coalesce(
      requested_at,
      created_at
    ) < (p_date + 1)::timestamptz;

  if to_regclass(
    'public.withdrawal_requests'
  ) is not null then
    execute $query$
      select
        count(*) filter (
          where status in (
            'pending',
            'requested',
            'approved',
            'processing'
          )
        ),
        coalesce(
          sum(amount) filter (
            where status in (
              'pending',
              'requested',
              'approved',
              'processing'
            )
          ),
          0
        )
      from public.withdrawal_requests
      where created_at >= $1::timestamptz
        and created_at < ($1 + 1)::timestamptz
    $query$
    into
      v_open_withdrawals,
      v_open_withdrawal_amount
    using p_date;
  end if;

  select
    coalesce(sum(cash_debt), 0),
    coalesce(sum(available_balance), 0),
    coalesce(sum(pending_balance), 0),
    coalesce(sum(reserved_balance), 0)
  into
    v_cash_debt,
    v_available,
    v_pending,
    v_reserved
  from public.driver_wallets;

  select
    count(*) filter (
      where status = 'posted'
    ),
    count(*) filter (
      where status = 'pending'
    ),
    count(*) filter (
      where status in (
        'reversed',
        'voided'
      )
    )
  into
    v_posted,
    v_pending_transactions,
    v_reversed
  from public.financial_transactions
  where effective_at >= p_date::timestamptz
    and effective_at <
      (p_date + 1)::timestamptz;

  select
    count(*),
    coalesce(sum(total_amount), 0)
  into
    v_unreconciled,
    v_unreconciled_amount
  from public.payment_transactions
  where status in (
      'paid',
      'completed',
      'succeeded'
    )
    and coalesce(
      paid_at,
      created_at
    ) >= p_date::timestamptz
    and coalesce(
      paid_at,
      created_at
    ) < (p_date + 1)::timestamptz
    and not exists (
      select 1
      from public.financial_transactions ft
      where ft.payment_id =
        payment_transactions.id
        and ft.status = 'posted'
    );

  if v_unreconciled > 0 then
    raise exception
      'No se puede cerrar el día. Existen % pagos sin conciliar por % MXN',
      v_unreconciled,
      round(v_unreconciled_amount, 2);
  end if;

  if v_pending_transactions > 0 then
    raise exception
      'No se puede cerrar el día. Existen % movimientos contables pendientes',
      v_pending_transactions;
  end if;

  snapshot_data := jsonb_build_object(
    'version',
    'finance-closure-v1',

    'finance_date',
    p_date,

    'revenue',
    jsonb_build_object(
      'paid_payments',
      coalesce(
        revenue_record.paid_payments,
        0
      ),
      'gross_revenue',
      coalesce(
        revenue_record.gross_revenue,
        0
      ),
      'platform_commission',
      coalesce(
        revenue_record.platform_commission,
        0
      ),
      'gross_driver_earnings',
      coalesce(
        revenue_record.gross_driver_earnings,
        0
      ),
      'net_driver_earnings',
      coalesce(
        revenue_record.net_driver_earnings,
        0
      ),
      'cash_amount',
      coalesce(
        revenue_record.cash_amount,
        0
      ),
      'digital_amount',
      coalesce(
        revenue_record.digital_amount,
        0
      )
    ),

    'taxes',
    jsonb_build_object(
      'platform_commission_iva',
      coalesce(
        revenue_record.platform_commission_iva,
        0
      ),
      'iva_withholding',
      coalesce(
        revenue_record.iva_withholding,
        0
      ),
      'isr_withholding',
      coalesce(
        revenue_record.isr_withholding,
        0
      )
    ),

    'refunds',
    jsonb_build_object(
      'pending_count',
      v_pending_refunds,
      'pending_amount',
      v_pending_refund_amount,
      'approved_count',
      v_approved_refunds,
      'approved_amount',
      v_approved_refund_amount
    ),

    'withdrawals',
    jsonb_build_object(
      'open_count',
      v_open_withdrawals,
      'open_amount',
      v_open_withdrawal_amount
    ),

    'wallets',
    jsonb_build_object(
      'cash_debt',
      v_cash_debt,
      'available_balance',
      v_available,
      'pending_balance',
      v_pending,
      'reserved_balance',
      v_reserved
    ),

    'ledger',
    jsonb_build_object(
      'posted',
      v_posted,
      'pending',
      v_pending_transactions,
      'reversed',
      v_reversed
    ),

    'reconciliation',
    jsonb_build_object(
      'unreconciled_payments',
      v_unreconciled,
      'unreconciled_amount',
      v_unreconciled_amount
    ),

    'generated_at',
    now(),

    'generated_by',
    auth.uid()
  );

  insert into public.finance_daily_closures (
    finance_date,
    status,
    paid_payments,
    gross_revenue,
    platform_commission,
    gross_driver_earnings,
    net_driver_earnings,
    cash_amount,
    digital_amount,
    platform_commission_iva,
    iva_withholding,
    isr_withholding,
    pending_refunds,
    pending_refund_amount,
    approved_refunds,
    approved_refund_amount,
    open_withdrawals,
    open_withdrawal_amount,
    cash_debt_total,
    available_wallet_balance,
    pending_wallet_balance,
    reserved_wallet_balance,
    posted_financial_transactions,
    pending_financial_transactions,
    reversed_financial_transactions,
    unreconciled_payments,
    unreconciled_amount,
    snapshot,
    integrity_hash,
    closed_by
  )
  values (
    p_date,
    'closed',
    coalesce(
      revenue_record.paid_payments,
      0
    ),
    coalesce(
      revenue_record.gross_revenue,
      0
    ),
    coalesce(
      revenue_record.platform_commission,
      0
    ),
    coalesce(
      revenue_record.gross_driver_earnings,
      0
    ),
    coalesce(
      revenue_record.net_driver_earnings,
      0
    ),
    coalesce(
      revenue_record.cash_amount,
      0
    ),
    coalesce(
      revenue_record.digital_amount,
      0
    ),
    coalesce(
      revenue_record.platform_commission_iva,
      0
    ),
    coalesce(
      revenue_record.iva_withholding,
      0
    ),
    coalesce(
      revenue_record.isr_withholding,
      0
    ),
    v_pending_refunds,
    v_pending_refund_amount,
    v_approved_refunds,
    v_approved_refund_amount,
    v_open_withdrawals,
    v_open_withdrawal_amount,
    v_cash_debt,
    v_available,
    v_pending,
    v_reserved,
    v_posted,
    v_pending_transactions,
    v_reversed,
    v_unreconciled,
    v_unreconciled_amount,
    snapshot_data,
    public.finance_closure_hash(
      snapshot_data
    ),
    auth.uid()
  )
  returning *
  into closure_record;

  perform public.log_finance_event(
    'finance_day_closed',
    closure_record.id::text,
    jsonb_build_object(
      'closure_folio',
      closure_record.closure_folio,
      'finance_date',
      p_date,
      'gross_revenue',
      closure_record.gross_revenue,
      'platform_commission',
      closure_record.platform_commission,
      'integrity_hash',
      closure_record.integrity_hash
    )
  );

  return closure_record;
end;
$$;

revoke all
on function public.close_finance_day(date)
from public;

grant execute
on function public.close_finance_day(date)
to authenticated;

-- =========================================================
-- 7. FUNCIÓN DE REAPERTURA
-- =========================================================

create or replace function public.reopen_finance_day(
  p_closure_id uuid,
  p_reason text
)
returns public.finance_daily_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  closure_record public.finance_daily_closures%rowtype;
begin
  if not public.is_axi_super_admin() then
    raise exception
      'Solo un super administrador puede reabrir un cierre';
  end if;

  if p_closure_id is null then
    raise exception
      'El identificador del cierre es obligatorio';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception
      'La razón debe contener al menos 10 caracteres';
  end if;

  select *
  into closure_record
  from public.finance_daily_closures
  where id = p_closure_id
  for update;

  if not found then
    raise exception
      'No se encontró el cierre solicitado';
  end if;

  if closure_record.status <> 'closed' then
    raise exception
      'El cierre ya no está activo';
  end if;

  update public.finance_daily_closures
  set
    status = 'reopened',
    reopened_by = auth.uid(),
    reopened_at = now(),
    reopening_reason = trim(p_reason),
    updated_at = now()
  where id = p_closure_id
  returning *
  into closure_record;

  perform public.log_finance_event(
    'finance_day_reopened',
    closure_record.id::text,
    jsonb_build_object(
      'closure_folio',
      closure_record.closure_folio,
      'finance_date',
      closure_record.finance_date,
      'reason',
      closure_record.reopening_reason,
      'original_integrity_hash',
      closure_record.integrity_hash
    )
  );

  return closure_record;
end;
$$;

revoke all
on function public.reopen_finance_day(uuid, text)
from public;

grant execute
on function public.reopen_finance_day(uuid, text)
to authenticated;

-- =========================================================
-- 8. VERIFICACIÓN DEL HASH
-- =========================================================

create or replace function public.verify_finance_closure(
  p_closure_id uuid
)
returns table (
  closure_id uuid,
  closure_folio text,
  stored_hash text,
  calculated_hash text,
  is_valid boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.closure_folio,
    c.integrity_hash,
    public.finance_closure_hash(
      c.snapshot
    ),
    c.integrity_hash =
      public.finance_closure_hash(
        c.snapshot
      )
  from public.finance_daily_closures c
  where c.id = p_closure_id
    and public.is_axi_finance();
$$;

revoke all
on function public.verify_finance_closure(uuid)
from public;

grant execute
on function public.verify_finance_closure(uuid)
to authenticated;

-- =========================================================
-- 9. VISTA PARA EL FRONTEND
-- =========================================================

create or replace view public.finance_daily_closures_view
with (security_invoker = true)
as
select
  c.id,
  c.closure_folio,
  c.finance_date,
  c.status,
  c.currency,

  c.paid_payments,
  c.gross_revenue,
  c.platform_commission,
  c.gross_driver_earnings,
  c.net_driver_earnings,

  c.cash_amount,
  c.digital_amount,

  c.platform_commission_iva,
  c.iva_withholding,
  c.isr_withholding,

  c.pending_refunds,
  c.pending_refund_amount,
  c.approved_refunds,
  c.approved_refund_amount,

  c.open_withdrawals,
  c.open_withdrawal_amount,

  c.cash_debt_total,
  c.available_wallet_balance,
  c.pending_wallet_balance,
  c.reserved_wallet_balance,

  c.posted_financial_transactions,
  c.pending_financial_transactions,
  c.reversed_financial_transactions,

  c.unreconciled_payments,
  c.unreconciled_amount,

  c.integrity_hash,
  (
    c.integrity_hash =
    public.finance_closure_hash(
      c.snapshot
    )
  ) as integrity_valid,

  c.closed_by,
  c.closed_at,
  c.reopened_by,
  c.reopened_at,
  c.reopening_reason,

  c.created_at,
  c.updated_at
from public.finance_daily_closures c;

grant select
on public.finance_daily_closures_view
to authenticated;

commit;
