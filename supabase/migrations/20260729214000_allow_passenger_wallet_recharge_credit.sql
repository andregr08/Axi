-- =========================================================
-- AXI: PERMITIR recharge_credit EN MOVIMIENTOS DE WALLET
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
    'reversal',
    'recharge_credit'
  ) then
    raise exception 'Tipo de movimiento inválido';
  end if;

  insert into public.passenger_wallets (
    passenger_id
  )
  values (
    p_passenger_id
  )
  on conflict (passenger_id) do nothing;

  select *
  into wallet_record
  from public.passenger_wallets
  where passenger_id = p_passenger_id
  for update;

  new_balance :=
    round(
      (
        wallet_record.available_balance
        + p_amount
      )::numeric,
      2
    );

  if new_balance < 0 then
    raise exception
      'Saldo insuficiente en el wallet del pasajero';
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
    nullif(
      trim(coalesce(p_description, '')),
      ''
    ),
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


comment on function public.apply_passenger_wallet_movement(
  uuid,
  numeric,
  text,
  text,
  uuid,
  uuid,
  jsonb
) is
  'Aplica movimientos atómicos al wallet del pasajero, incluyendo recargas confirmadas.';
