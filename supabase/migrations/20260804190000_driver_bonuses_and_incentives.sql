-- ============================================================
-- AXI: BONOS E INCENTIVOS A CONDUCTORES
-- ============================================================

-- ============================================================
-- 1. CAMPAÑAS DE BONOS
-- ============================================================

create table if not exists public.driver_bonus_campaigns (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  name text not null,
  description text null,

  incentive_type text not null
    check (
      incentive_type in (
        'manual',
        'trip_count',
        'revenue_target',
        'completion_rate',
        'peak_hours',
        'referral',
        'retention',
        'custom'
      )
    ),

  reward_amount numeric(12,2) not null
    check (reward_amount > 0),

  target_value numeric(12,2) null
    check (
      target_value is null
      or target_value > 0
    ),

  starts_at timestamptz not null default now(),
  ends_at timestamptz null,

  active boolean not null default true,

  total_budget numeric(14,2) null
    check (
      total_budget is null
      or total_budget > 0
    ),

  awarded_amount numeric(14,2) not null default 0
    check (awarded_amount >= 0),

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  check (
    ends_at is null
    or ends_at > starts_at
  ),

  check (
    total_budget is null
    or awarded_amount <= total_budget
  )
);


-- ============================================================
-- 2. BONOS OTORGADOS
-- ============================================================

create table if not exists public.driver_bonus_awards (
  id uuid primary key default gen_random_uuid(),

  folio text not null unique,

  campaign_id uuid null
    references public.driver_bonus_campaigns(id)
    on delete set null,

  driver_id uuid not null,

  incentive_type text not null,

  amount numeric(12,2) not null
    check (amount > 0),

  reason text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'credited',
        'rejected',
        'cancelled',
        'reversed'
      )
    ),

  idempotency_key text not null unique,

  requested_by uuid null,
  approved_by uuid null,
  rejected_by uuid null,
  reversed_by uuid null,

  requested_at timestamptz not null default now(),
  approved_at timestamptz null,
  credited_at timestamptz null,
  rejected_at timestamptz null,
  cancelled_at timestamptz null,
  reversed_at timestamptz null,

  rejection_reason text null,
  cancellation_reason text null,
  reversal_reason text null,

  wallet_transaction_id uuid null
    references public.wallet_transactions(id)
    on delete restrict,

  financial_transaction_id uuid null
    references public.financial_transactions(id)
    on delete restrict,

  reversal_wallet_transaction_id uuid null
    references public.wallet_transactions(id)
    on delete restrict,

  reversal_financial_transaction_id uuid null
    references public.financial_transactions(id)
    on delete restrict,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 3. ÍNDICES
-- ============================================================

create index if not exists
  driver_bonus_campaigns_active_dates_idx
on public.driver_bonus_campaigns (
  active,
  starts_at,
  ends_at
);


create index if not exists
  driver_bonus_awards_driver_idx
on public.driver_bonus_awards (
  driver_id,
  created_at desc
);


create index if not exists
  driver_bonus_awards_status_idx
on public.driver_bonus_awards (
  status,
  created_at desc
);


create index if not exists
  driver_bonus_awards_campaign_idx
on public.driver_bonus_awards (
  campaign_id,
  created_at desc
)
where campaign_id is not null;


create index if not exists
  driver_bonus_awards_wallet_transaction_idx
on public.driver_bonus_awards (
  wallet_transaction_id
)
where wallet_transaction_id is not null;


create index if not exists
  driver_bonus_awards_financial_transaction_idx
on public.driver_bonus_awards (
  financial_transaction_id
)
where financial_transaction_id is not null;


-- ============================================================
-- 4. COMENTARIOS
-- ============================================================

comment on table public.driver_bonus_campaigns is
  'Campañas configurables de bonos e incentivos para conductores AXI.';

comment on table public.driver_bonus_awards is
  'Bonos individuales otorgados a conductores, con trazabilidad de aprobación, wallet, contabilidad y reversa.';


-- ============================================================
-- 5. CREAR BONO PENDIENTE
-- ============================================================

create or replace function public.create_driver_bonus_award(
  p_driver_id uuid,
  p_amount numeric,
  p_reason text,
  p_incentive_type text default 'manual',
  p_campaign_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_campaign public.driver_bonus_campaigns%rowtype;
  v_existing_id uuid;
  v_award_id uuid;
  v_folio text;
  v_clean_reason text;
  v_clean_idempotency_key text;
  v_amount numeric(12,2);
begin
  perform public.require_finance_access();

  if p_driver_id is null then
    raise exception
      'El conductor es obligatorio';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_driver_id
      and profile.role::text = 'driver'
  ) then
    raise exception
      'El usuario indicado no es un conductor válido';
  end if;

  v_amount :=
    round(
      coalesce(p_amount, 0),
      2
    );

  if v_amount <= 0 then
    raise exception
      'El importe del bono debe ser mayor a cero';
  end if;

  v_clean_reason :=
    nullif(
      btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  if v_clean_reason is null then
    raise exception
      'El motivo del bono es obligatorio';
  end if;

  if p_incentive_type not in (
    'manual',
    'trip_count',
    'revenue_target',
    'completion_rate',
    'peak_hours',
    'referral',
    'retention',
    'custom'
  ) then
    raise exception
      'Tipo de incentivo inválido: %',
      p_incentive_type;
  end if;

  v_clean_idempotency_key :=
    nullif(
      btrim(
        coalesce(
          p_idempotency_key,
          ''
        )
      ),
      ''
    );

  if v_clean_idempotency_key is null then
    v_clean_idempotency_key :=
      'driver-bonus:'
      || p_driver_id::text
      || ':'
      || gen_random_uuid()::text;
  end if;

  select award.id
  into v_existing_id
  from public.driver_bonus_awards award
  where award.idempotency_key =
    v_clean_idempotency_key
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if p_campaign_id is not null then
    select *
    into v_campaign
    from public.driver_bonus_campaigns campaign
    where campaign.id = p_campaign_id
    for update;

    if not found then
      raise exception
        'La campaña de bonos no existe';
    end if;

    if v_campaign.active is false then
      raise exception
        'La campaña de bonos no está activa';
    end if;

    if v_campaign.starts_at > now() then
      raise exception
        'La campaña todavía no ha comenzado';
    end if;

    if v_campaign.ends_at is not null
       and v_campaign.ends_at <= now() then
      raise exception
        'La campaña ya terminó';
    end if;

    if v_campaign.incentive_type
       <> p_incentive_type then
      raise exception
        'El tipo de incentivo no coincide con la campaña';
    end if;

    if v_campaign.total_budget is not null
       and round(
         v_campaign.awarded_amount
         + v_amount,
         2
       ) > v_campaign.total_budget then
      raise exception
        'El bono supera el presupuesto disponible de la campaña';
    end if;
  end if;

  v_award_id :=
    gen_random_uuid();

  v_folio :=
    'BON-'
    || to_char(
      now(),
      'YYYYMMDDHH24MISS'
    )
    || '-'
    || upper(
      substr(
        replace(
          v_award_id::text,
          '-',
          ''
        ),
        1,
        8
      )
    );

  insert into public.driver_bonus_awards (
    id,
    folio,
    campaign_id,
    driver_id,
    incentive_type,
    amount,
    reason,
    status,
    idempotency_key,
    requested_by,
    requested_at,
    metadata
  )
  values (
    v_award_id,
    v_folio,
    p_campaign_id,
    p_driver_id,
    p_incentive_type,
    v_amount,
    v_clean_reason,
    'pending',
    v_clean_idempotency_key,
    auth.uid(),
    now(),
    coalesce(
      p_metadata,
      '{}'::jsonb
    )
  );

  return v_award_id;
end;
$function$;


revoke all
on function public.create_driver_bonus_award(
  uuid,
  numeric,
  text,
  text,
  uuid,
  text,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.create_driver_bonus_award(
  uuid,
  numeric,
  text,
  text,
  uuid,
  text,
  jsonb
)
to service_role;


comment on function public.create_driver_bonus_award(
  uuid,
  numeric,
  text,
  text,
  uuid,
  text,
  jsonb
)
is
  'Registra un bono pendiente para un conductor. Valida permisos financieros, conductor, campaña, presupuesto e idempotencia.';


-- ============================================================
-- 6. APROBAR Y ACREDITAR BONO
-- ============================================================

create or replace function public.approve_driver_bonus_award(
  p_award_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_award public.driver_bonus_awards%rowtype;
  v_wallet_transaction_id uuid;
  v_financial_transaction_id uuid;

  v_bonus_expense_account uuid;
  v_driver_payable_account uuid;

  v_entries jsonb;
begin
  perform public.require_finance_access();

  select *
  into v_award
  from public.driver_bonus_awards
  where id = p_award_id
  for update;

  if not found then
    raise exception
      'El bono no existe';
  end if;

  if v_award.status = 'credited' then
    return v_award.id;
  end if;

  if v_award.status <> 'pending' then
    raise exception
      'El bono no puede aprobarse desde el estado: %',
      v_award.status;
  end if;

  if v_award.wallet_transaction_id is not null
     or v_award.financial_transaction_id is not null then
    raise exception
      'El bono ya tiene movimientos financieros asociados';
  end if;

  select id
  into v_bonus_expense_account
  from public.financial_accounts
  where code = 'expense.driver_bonuses'
    and status = 'active';

  select id
  into v_driver_payable_account
  from public.financial_accounts
  where code = 'liability.driver_payable'
    and status = 'active';

  if v_bonus_expense_account is null
     or v_driver_payable_account is null then
    raise exception
      'Faltan cuentas contables para registrar el bono';
  end if;

  v_wallet_transaction_id :=
    public.apply_wallet_movement(
      p_driver_id =>
        v_award.driver_id,

      p_balance_type =>
        'available',

      p_amount =>
        v_award.amount,

      p_transaction_type =>
        'driver_bonus_credit',

      p_description =>
        'Bono acreditado al conductor',

      p_metadata =>
        jsonb_build_object(
          'driver_bonus_award_id',
            v_award.id,

          'folio',
            v_award.folio,

          'campaign_id',
            v_award.campaign_id,

          'incentive_type',
            v_award.incentive_type,

          'reason',
            v_award.reason,

          'integration_version',
            1
        ),

      p_lifetime_earnings_delta =>
        v_award.amount,

      p_total_withdrawn_delta =>
        0
    );

  v_entries :=
    jsonb_build_array(
      jsonb_build_object(
        'account_id',
          v_bonus_expense_account,

        'direction',
          'debit',

        'amount',
          v_award.amount,

        'description',
          'Gasto por bono otorgado al conductor',

        'driver_id',
          v_award.driver_id,

        'metadata',
          jsonb_build_object(
            'driver_bonus_award_id',
              v_award.id,

            'folio',
              v_award.folio,

            'campaign_id',
              v_award.campaign_id,

            'incentive_type',
              v_award.incentive_type
          )
      ),

      jsonb_build_object(
        'account_id',
          v_driver_payable_account,

        'direction',
          'credit',

        'amount',
          v_award.amount,

        'description',
          'Bono por pagar al conductor',

        'driver_id',
          v_award.driver_id,

        'metadata',
          jsonb_build_object(
            'driver_bonus_award_id',
              v_award.id,

            'folio',
              v_award.folio,

            'wallet_transaction_id',
              v_wallet_transaction_id
          )
      )
    );

  v_financial_transaction_id :=
    public.post_financial_transaction(
      p_transaction_type =>
        'driver_bonus',

      p_description =>
        format(
          'Bono %s acreditado al conductor %s',
          v_award.folio,
          v_award.driver_id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'driver-bonus-credit:'
        || v_award.id::text
        || ':v1',

      p_metadata =>
        jsonb_build_object(
          'driver_bonus_award_id',
            v_award.id,

          'folio',
            v_award.folio,

          'driver_id',
            v_award.driver_id,

          'campaign_id',
            v_award.campaign_id,

          'incentive_type',
            v_award.incentive_type,

          'reason',
            v_award.reason,

          'amount',
            v_award.amount,

          'wallet_transaction_id',
            v_wallet_transaction_id,

          'integration_version',
            1
        ),

      p_created_by =>
        auth.uid(),

      p_effective_at =>
        now()
    );

  update public.driver_bonus_awards
  set
    status = 'credited',
    approved_by = auth.uid(),
    approved_at = now(),
    credited_at = now(),
    wallet_transaction_id =
      v_wallet_transaction_id,
    financial_transaction_id =
      v_financial_transaction_id,
    updated_at = now()
  where id = v_award.id;

  if v_award.campaign_id is not null then
    update public.driver_bonus_campaigns
    set
      awarded_amount =
        round(
          awarded_amount + v_award.amount,
          2
        ),
      updated_at = now()
    where id = v_award.campaign_id;
  end if;

  return v_award.id;
end;
$function$;


revoke all
on function public.approve_driver_bonus_award(uuid)
from public, anon, authenticated;


grant execute
on function public.approve_driver_bonus_award(uuid)
to service_role;


comment on function public.approve_driver_bonus_award(uuid)
is
  'Aprueba y acredita un bono al saldo disponible del conductor. Registra wallet, lifetime earnings, doble partida, campaña e idempotencia en una sola transacción.';


-- ============================================================
-- 7. RECHAZAR BONO PENDIENTE
-- ============================================================

create or replace function public.reject_driver_bonus_award(
  p_award_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_award public.driver_bonus_awards%rowtype;
  v_reason text;
begin
  perform public.require_finance_access();

  v_reason :=
    nullif(
      btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'El motivo del rechazo es obligatorio';
  end if;

  select *
  into v_award
  from public.driver_bonus_awards
  where id = p_award_id
  for update;

  if not found then
    raise exception
      'El bono no existe';
  end if;

  if v_award.status = 'rejected' then
    return v_award.id;
  end if;

  if v_award.status <> 'pending' then
    raise exception
      'El bono no puede rechazarse desde el estado: %',
      v_award.status;
  end if;

  if v_award.wallet_transaction_id is not null
     or v_award.financial_transaction_id is not null then
    raise exception
      'No puede rechazarse un bono con movimientos financieros';
  end if;

  update public.driver_bonus_awards
  set
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = v_reason,
    updated_at = now()
  where id = v_award.id;

  return v_award.id;
end;
$function$;


-- ============================================================
-- 8. CANCELAR BONO PENDIENTE
-- ============================================================

create or replace function public.cancel_driver_bonus_award(
  p_award_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_award public.driver_bonus_awards%rowtype;
  v_reason text;
begin
  perform public.require_finance_access();

  v_reason :=
    nullif(
      btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'El motivo de cancelación es obligatorio';
  end if;

  select *
  into v_award
  from public.driver_bonus_awards
  where id = p_award_id
  for update;

  if not found then
    raise exception
      'El bono no existe';
  end if;

  if v_award.status = 'cancelled' then
    return v_award.id;
  end if;

  if v_award.status <> 'pending' then
    raise exception
      'El bono no puede cancelarse desde el estado: %',
      v_award.status;
  end if;

  if v_award.wallet_transaction_id is not null
     or v_award.financial_transaction_id is not null then
    raise exception
      'No puede cancelarse un bono con movimientos financieros';
  end if;

  update public.driver_bonus_awards
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where id = v_award.id;

  return v_award.id;
end;
$function$;


revoke all
on function public.reject_driver_bonus_award(uuid, text)
from public, anon, authenticated;

revoke all
on function public.cancel_driver_bonus_award(uuid, text)
from public, anon, authenticated;


grant execute
on function public.reject_driver_bonus_award(uuid, text)
to service_role;

grant execute
on function public.cancel_driver_bonus_award(uuid, text)
to service_role;


comment on function public.reject_driver_bonus_award(uuid, text)
is
  'Rechaza un bono pendiente sin generar movimientos financieros.';

comment on function public.cancel_driver_bonus_award(uuid, text)
is
  'Cancela un bono pendiente sin generar movimientos financieros.';


-- ============================================================
-- 9. REVERSAR BONO ACREDITADO
-- ============================================================

create or replace function public.reverse_driver_bonus_award(
  p_award_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_award public.driver_bonus_awards%rowtype;
  v_wallet public.driver_wallets%rowtype;

  v_reason text;
  v_available_recovered numeric(12,2);
  v_driver_debt_created numeric(12,2);

  v_reversal_wallet_transaction_id uuid;
  v_reversal_financial_transaction_id uuid;
begin
  perform public.require_finance_access();

  v_reason :=
    nullif(
      btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'El motivo de reversa es obligatorio';
  end if;

  select *
  into v_award
  from public.driver_bonus_awards
  where id = p_award_id
  for update;

  if not found then
    raise exception
      'El bono no existe';
  end if;

  if v_award.status = 'reversed' then
    return v_award.id;
  end if;

  if v_award.status <> 'credited' then
    raise exception
      'El bono no puede revertirse desde el estado: %',
      v_award.status;
  end if;

  if v_award.wallet_transaction_id is null
     or v_award.financial_transaction_id is null then
    raise exception
      'El bono acreditado no tiene movimientos financieros completos';
  end if;

  if v_award.reversal_wallet_transaction_id is not null
     or v_award.reversal_financial_transaction_id is not null then
    raise exception
      'El bono ya tiene una reversa registrada';
  end if;

  insert into public.driver_wallets (
    driver_id
  )
  values (
    v_award.driver_id
  )
  on conflict (driver_id)
  do nothing;

  select *
  into v_wallet
  from public.driver_wallets
  where driver_id = v_award.driver_id
  for update;

  if not found then
    raise exception
      'No fue posible obtener el wallet del conductor';
  end if;

  v_available_recovered :=
    round(
      least(
        coalesce(v_wallet.available_balance, 0),
        v_award.amount
      ),
      2
    );

  v_driver_debt_created :=
    round(
      greatest(
        v_award.amount - v_available_recovered,
        0
      ),
      2
    );

  if v_available_recovered > 0 then
    v_reversal_wallet_transaction_id :=
      public.apply_wallet_movement(
        p_driver_id =>
          v_award.driver_id,

        p_balance_type =>
          'available',

        p_amount =>
          -v_available_recovered,

        p_transaction_type =>
          'driver_bonus_reversal_available',

        p_description =>
          'Recuperación de bono desde saldo disponible',

        p_metadata =>
          jsonb_build_object(
            'driver_bonus_award_id',
              v_award.id,

            'folio',
              v_award.folio,

            'reason',
              v_reason,

            'recovered_amount',
              v_available_recovered,

            'integration_version',
              1
          ),

        p_lifetime_earnings_delta =>
          -v_available_recovered,

        p_total_withdrawn_delta =>
          0
      );
  end if;

  if v_driver_debt_created > 0 then
    perform public.apply_wallet_movement(
      p_driver_id =>
        v_award.driver_id,

      p_balance_type =>
        'cash_debt',

      p_amount =>
        v_driver_debt_created,

      p_transaction_type =>
        'driver_bonus_reversal_debt',

      p_description =>
        'Deuda creada por reversa de bono ya retirado o utilizado',

      p_metadata =>
        jsonb_build_object(
          'driver_bonus_award_id',
            v_award.id,

          'folio',
            v_award.folio,

          'reason',
            v_reason,

          'debt_created',
            v_driver_debt_created,

          'integration_version',
            1
        ),

      p_lifetime_earnings_delta =>
        -v_driver_debt_created,

      p_total_withdrawn_delta =>
        0
    );
  end if;

  v_reversal_financial_transaction_id :=
    public.reverse_financial_transaction(
      p_transaction_id =>
        v_award.financial_transaction_id,

      p_reason =>
        format(
          'Reversa del bono %s. Motivo: %s',
          v_award.folio,
          v_reason
        ),

      p_idempotency_key =>
        'driver-bonus-reversal:'
        || v_award.id::text
        || ':v1',

      p_created_by =>
        auth.uid()
    );

  update public.driver_bonus_awards
  set
    status = 'reversed',
    reversed_by = auth.uid(),
    reversed_at = now(),
    reversal_reason = v_reason,
    reversal_wallet_transaction_id =
      v_reversal_wallet_transaction_id,
    reversal_financial_transaction_id =
      v_reversal_financial_transaction_id,
    metadata =
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'available_recovered',
          v_available_recovered,

        'driver_debt_created',
          v_driver_debt_created,

        'reversal_integration_version',
          1
      ),
    updated_at = now()
  where id = v_award.id;

  if v_award.campaign_id is not null then
    update public.driver_bonus_campaigns
    set
      awarded_amount =
        round(
          greatest(
            awarded_amount - v_award.amount,
            0
          ),
          2
        ),
      updated_at = now()
    where id = v_award.campaign_id;
  end if;

  return v_award.id;
end;
$function$;


revoke all
on function public.reverse_driver_bonus_award(uuid, text)
from public, anon, authenticated;


grant execute
on function public.reverse_driver_bonus_award(uuid, text)
to service_role;


comment on function public.reverse_driver_bonus_award(uuid, text)
is
  'Revierte un bono acreditado. Recupera saldo disponible, crea deuda por faltante, reduce lifetime earnings y genera la póliza inversa inmutable.';


-- ============================================================
-- 10. SEGURIDAD RLS
-- ============================================================

alter table public.driver_bonus_campaigns
  enable row level security;

alter table public.driver_bonus_awards
  enable row level security;


drop policy if exists
  driver_bonus_campaigns_finance_select
on public.driver_bonus_campaigns;

create policy
  driver_bonus_campaigns_finance_select
on public.driver_bonus_campaigns
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role::text in (
        'admin',
        'finance'
      )
  )
);


drop policy if exists
  driver_bonus_awards_finance_select
on public.driver_bonus_awards;

create policy
  driver_bonus_awards_finance_select
on public.driver_bonus_awards
for select
to authenticated
using (
  driver_id = auth.uid()
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


-- ============================================================
-- 11. PERMISOS DE TABLAS
-- ============================================================

revoke all
on table public.driver_bonus_campaigns
from public, anon, authenticated;

revoke all
on table public.driver_bonus_awards
from public, anon, authenticated;


grant select
on table public.driver_bonus_campaigns
to authenticated;

grant select
on table public.driver_bonus_awards
to authenticated;


grant all
on table public.driver_bonus_campaigns
to service_role;

grant all
on table public.driver_bonus_awards
to service_role;


-- ============================================================
-- 12. PERMISOS DE FUNCIONES PARA ADMIN/FINANCE
-- ============================================================

grant execute
on function public.create_driver_bonus_award(
  uuid,
  numeric,
  text,
  text,
  uuid,
  text,
  jsonb
)
to authenticated;


grant execute
on function public.approve_driver_bonus_award(uuid)
to authenticated;


grant execute
on function public.reject_driver_bonus_award(uuid, text)
to authenticated;


grant execute
on function public.cancel_driver_bonus_award(uuid, text)
to authenticated;


grant execute
on function public.reverse_driver_bonus_award(uuid, text)
to authenticated;


-- ============================================================
-- 13. VISTA DE BONOS PARA FINANZAS
-- ============================================================

create or replace view public.finance_driver_bonus_awards
with (security_invoker = true)
as
select
  award.id,
  award.folio,
  award.driver_id,

  profile.full_name as driver_name,

  award.campaign_id,
  campaign.code as campaign_code,
  campaign.name as campaign_name,

  award.incentive_type,
  award.amount,
  award.reason,
  award.status,

  award.requested_by,
  award.approved_by,
  award.rejected_by,
  award.reversed_by,

  award.requested_at,
  award.approved_at,
  award.credited_at,
  award.rejected_at,
  award.cancelled_at,
  award.reversed_at,

  award.rejection_reason,
  award.cancellation_reason,
  award.reversal_reason,

  award.wallet_transaction_id,
  award.financial_transaction_id,
  award.reversal_wallet_transaction_id,
  award.reversal_financial_transaction_id,

  award.metadata,
  award.created_at,
  award.updated_at

from public.driver_bonus_awards award

left join public.profiles profile
  on profile.id = award.driver_id

left join public.driver_bonus_campaigns campaign
  on campaign.id = award.campaign_id;


grant select
on public.finance_driver_bonus_awards
to authenticated;


-- ============================================================
-- 14. RESUMEN PARA DASHBOARD
-- ============================================================

create or replace view public.finance_driver_bonus_summary
with (security_invoker = true)
as
select
  count(*) filter (
    where status = 'pending'
  )::bigint as pending_bonus_requests,

  coalesce(
    sum(amount) filter (
      where status = 'pending'
    ),
    0
  )::numeric(14,2) as pending_bonus_amount,

  count(*) filter (
    where status = 'credited'
  )::bigint as credited_bonus_count,

  coalesce(
    sum(amount) filter (
      where status = 'credited'
    ),
    0
  )::numeric(14,2) as credited_bonus_amount,

  count(*) filter (
    where status = 'reversed'
  )::bigint as reversed_bonus_count,

  coalesce(
    sum(amount) filter (
      where status = 'reversed'
    ),
    0
  )::numeric(14,2) as reversed_bonus_amount

from public.driver_bonus_awards;


grant select
on public.finance_driver_bonus_summary
to authenticated;


-- ============================================================
-- 15. COMENTARIOS DE VISTAS
-- ============================================================

comment on view public.finance_driver_bonus_awards is
  'Vista financiera de bonos otorgados a conductores con campaña, estado, wallet y pólizas.';

comment on view public.finance_driver_bonus_summary is
  'Resumen de bonos pendientes, acreditados y revertidos para dashboard financiero.';
