-- =========================================================
-- AXI: WALLET INTERNO DEL PASAJERO PARA REEMBOLSOS
-- =========================================================

create table if not exists public.passenger_wallets (
  passenger_id uuid primary key
    references public.profiles(id) on delete cascade,

  available_balance numeric(12,2) not null default 0
    check (available_balance >= 0),

  total_credited numeric(12,2) not null default 0
    check (total_credited >= 0),

  total_used numeric(12,2) not null default 0
    check (total_used >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.passenger_wallet_transactions (
  id uuid primary key default gen_random_uuid(),

  passenger_id uuid not null
    references public.profiles(id) on delete cascade,

  refund_request_id uuid null
    references public.refund_requests(id) on delete set null,

  trip_id uuid null
    references public.trips(id) on delete set null,

  transaction_type text not null
    check (
      transaction_type in (
        'refund_credit',
        'trip_payment',
        'adjustment_credit',
        'adjustment_debit',
        'reversal'
      )
    ),

  amount numeric(12,2) not null
    check (amount <> 0),

  balance_before numeric(12,2) not null
    check (balance_before >= 0),

  balance_after numeric(12,2) not null
    check (balance_after >= 0),

  description text null,
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid null
    references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists passenger_wallet_transactions_passenger_idx
  on public.passenger_wallet_transactions(passenger_id, created_at desc);

create index if not exists passenger_wallet_transactions_trip_idx
  on public.passenger_wallet_transactions(trip_id);

create unique index if not exists passenger_wallet_refund_credit_unique
  on public.passenger_wallet_transactions(refund_request_id)
  where refund_request_id is not null
    and transaction_type = 'refund_credit';

alter table public.refund_requests
  add column if not exists wallet_transaction_id uuid null
    references public.passenger_wallet_transactions(id)
    on delete set null;

alter table public.refund_requests
  add column if not exists credited_at timestamptz null;

alter table public.refund_requests
  add column if not exists rejected_by uuid null
    references public.profiles(id)
    on delete set null;

alter table public.refund_requests
  add column if not exists rejected_at timestamptz null;

-- =========================================================
-- MOVIMIENTO ATÓMICO DEL WALLET DEL PASAJERO
-- No se concede acceso directo a usuarios autenticados.
-- =========================================================

create or replace function public.apply_passenger_wallet_movement(
  p_passenger_id uuid,
  p_amount numeric,
  p_transaction_type text,
  p_description text default null,
  p_trip_id uuid default null,
  p_refund_request_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  wallet_record public.passenger_wallets%rowtype;
  new_balance numeric(12,2);
  transaction_id uuid;
begin
  if p_passenger_id is null then
    raise exception 'El pasajero es obligatorio';
  end if;

  if p_amount = 0 then
    raise exception 'El movimiento no puede ser de cero';
  end if;

  if p_transaction_type not in (
    'refund_credit',
    'trip_payment',
    'adjustment_credit',
    'adjustment_debit',
    'reversal'
  ) then
    raise exception 'Tipo de movimiento inválido';
  end if;

  insert into public.passenger_wallets (passenger_id)
  values (p_passenger_id)
  on conflict (passenger_id) do nothing;

  select *
  into wallet_record
  from public.passenger_wallets
  where passenger_id = p_passenger_id
  for update;

  new_balance :=
    round((wallet_record.available_balance + p_amount)::numeric, 2);

  if new_balance < 0 then
    raise exception 'Saldo insuficiente en el wallet del pasajero';
  end if;

  update public.passenger_wallets
  set
    available_balance = new_balance,

    total_credited =
      total_credited
      + case
          when p_amount > 0 then p_amount
          else 0
        end,

    total_used =
      total_used
      + case
          when p_amount < 0 then abs(p_amount)
          else 0
        end,

    updated_at = now()
  where passenger_id = p_passenger_id;

  insert into public.passenger_wallet_transactions (
    passenger_id,
    refund_request_id,
    trip_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    created_by
  )
  values (
    p_passenger_id,
    p_refund_request_id,
    p_trip_id,
    p_transaction_type,
    round(p_amount::numeric, 2),
    wallet_record.available_balance,
    new_balance,
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning id into transaction_id;

  return transaction_id;
end;
$function$;

revoke all
on function public.apply_passenger_wallet_movement(
  uuid,
  numeric,
  text,
  text,
  uuid,
  uuid,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.apply_passenger_wallet_movement(
  uuid,
  numeric,
  text,
  text,
  uuid,
  uuid,
  jsonb
)
to service_role;

-- =========================================================
-- APROBAR REEMBOLSO:
-- ABONA SALDO INTERNO, NO DEVUELVE DINERO REAL.
-- NO MODIFICA LA GANANCIA DEL CONDUCTOR.
-- =========================================================

create or replace function public.approve_refund(refund_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  refund_record public.refund_requests%rowtype;
  payment_record public.payment_transactions%rowtype;
  already_credited numeric(12,2);
  remaining_refundable numeric(12,2);
  created_wallet_transaction_id uuid;
begin
  if auth.role() <> 'service_role'
     and not public.is_axi_finance() then
    raise exception 'No tienes permiso para aprobar reembolsos';
  end if;

  select *
  into refund_record
  from public.refund_requests
  where id = refund_id
  for update;

  if not found then
    raise exception 'Solicitud de reembolso no encontrada';
  end if;

  if refund_record.status <> 'pending' then
    raise exception 'La solicitud ya fue procesada';
  end if;

  if refund_record.trip_id is null then
    raise exception 'El reembolso debe estar vinculado a un viaje';
  end if;

  select *
  into payment_record
  from public.payment_transactions
  where trip_id = refund_record.trip_id;

  if not found then
    raise exception 'No existe un pago vinculado al viaje';
  end if;

  if refund_record.passenger_id is not null
     and refund_record.passenger_id <> payment_record.passenger_id then
    raise exception 'El pasajero de la solicitud no coincide con el pago';
  end if;

  select coalesce(sum(amount), 0)
  into already_credited
  from public.refund_requests
  where trip_id = refund_record.trip_id
    and status = 'approved'
    and id <> refund_record.id;

  remaining_refundable :=
    round((payment_record.total_amount - already_credited)::numeric, 2);

  if refund_record.amount > remaining_refundable then
    raise exception
      'El monto excede el saldo reembolsable del viaje. Disponible: %',
      remaining_refundable;
  end if;

  created_wallet_transaction_id :=
    public.apply_passenger_wallet_movement(
      payment_record.passenger_id,
      refund_record.amount,
      'refund_credit',
      'Crédito AXI por reembolso del viaje',
      refund_record.trip_id,
      refund_record.id,
      jsonb_build_object(
        'refund_request_id', refund_record.id,
        'trip_id', refund_record.trip_id,
        'payment_transaction_id', payment_record.id,
        'funding_source', 'axi_platform',
        'withdrawable', false
      )
    );

  update public.refund_requests
  set
    passenger_id = payment_record.passenger_id,
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid(),
    credited_at = now(),
    wallet_transaction_id = created_wallet_transaction_id,
    updated_at = now()
  where id = refund_record.id;

  perform public.log_finance_event(
    'refund_wallet_credit_approved',
    refund_record.id::text,
    jsonb_build_object(
      'amount', refund_record.amount,
      'trip_id', refund_record.trip_id,
      'passenger_id', payment_record.passenger_id,
      'payment_transaction_id', payment_record.id,
      'wallet_transaction_id', created_wallet_transaction_id,
      'method', 'passenger_wallet_credit',
      'driver_earnings_affected', false
    )
  );
end;
$function$;

revoke all
on function public.approve_refund(uuid)
from public, anon;

grant execute
on function public.approve_refund(uuid)
to authenticated, service_role;

-- =========================================================
-- RECHAZAR REEMBOLSO CON VALIDACIONES Y AUDITORÍA
-- =========================================================

create or replace function public.reject_refund(
  refund_id uuid,
  rejection_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  refund_record public.refund_requests%rowtype;
  cleaned_reason text;
begin
  if auth.role() <> 'service_role'
     and not public.is_axi_finance() then
    raise exception 'No tienes permiso para rechazar reembolsos';
  end if;

  cleaned_reason := trim(coalesce(rejection_reason, ''));

  if cleaned_reason = '' then
    raise exception 'El motivo del rechazo es obligatorio';
  end if;

  select *
  into refund_record
  from public.refund_requests
  where id = refund_id
  for update;

  if not found then
    raise exception 'Solicitud de reembolso no encontrada';
  end if;

  if refund_record.status <> 'pending' then
    raise exception 'La solicitud ya fue procesada';
  end if;

  update public.refund_requests
  set
    status = 'rejected',
    notes = cleaned_reason,
    rejected_by = auth.uid(),
    rejected_at = now(),
    updated_at = now()
  where id = refund_record.id;

  perform public.log_finance_event(
    'refund_rejected',
    refund_record.id::text,
    jsonb_build_object(
      'amount', refund_record.amount,
      'trip_id', refund_record.trip_id,
      'passenger_id', refund_record.passenger_id,
      'reason', cleaned_reason
    )
  );
end;
$function$;

revoke all
on function public.reject_refund(uuid, text)
from public, anon;

grant execute
on function public.reject_refund(uuid, text)
to authenticated, service_role;

-- =========================================================
-- RLS
-- =========================================================

alter table public.passenger_wallets enable row level security;
alter table public.passenger_wallet_transactions enable row level security;

drop policy if exists passenger_wallets_select_policy
on public.passenger_wallets;

create policy passenger_wallets_select_policy
on public.passenger_wallets
for select
to authenticated
using (
  passenger_id = auth.uid()
  or public.is_axi_finance()
  or public.is_axi_support()
);

drop policy if exists passenger_wallet_transactions_select_policy
on public.passenger_wallet_transactions;

create policy passenger_wallet_transactions_select_policy
on public.passenger_wallet_transactions
for select
to authenticated
using (
  passenger_id = auth.uid()
  or public.is_axi_finance()
  or public.is_axi_support()
);

revoke insert, update, delete
on public.passenger_wallets
from anon, authenticated;

revoke insert, update, delete
on public.passenger_wallet_transactions
from anon, authenticated;

grant select
on public.passenger_wallets
to authenticated;

grant select
on public.passenger_wallet_transactions
to authenticated;
