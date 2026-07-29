begin;

create or replace function public.register_cash_debt_payment(
  p_driver_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash'::text,
  p_reference text default null::text,
  p_notes text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_wallet public.driver_wallets%rowtype;
  v_payment_id uuid;
  v_amount numeric(12,2);
  v_payment_method text;
begin
  if auth.role() <> 'service_role'
    and not public.is_axi_finance() then
    raise exception 'No tienes permiso para registrar pagos de deuda';
  end if;

  if p_driver_id is null then
    raise exception 'El conductor es obligatorio';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  v_payment_method := coalesce(
    nullif(btrim(p_payment_method), ''),
    'cash'
  );

  select *
  into v_wallet
  from public.driver_wallets
  where driver_id = p_driver_id
  for update;

  if not found then
    raise exception 'No existe una wallet para este conductor';
  end if;

  if v_amount > coalesce(v_wallet.cash_debt, 0) then
    raise exception
      'El pago supera la deuda actual. Deuda: %, pago: %',
      v_wallet.cash_debt,
      v_amount;
  end if;

  insert into public.cash_debt_payments (
    driver_id,
    wallet_id,
    amount,
    payment_method,
    reference,
    notes,
    created_by
  )
  values (
    p_driver_id,
    v_wallet.id,
    v_amount,
    v_payment_method,
    nullif(btrim(p_reference), ''),
    nullif(btrim(p_notes), ''),
    auth.uid()
  )
  returning id
  into v_payment_id;

  perform public.apply_wallet_movement(
    p_driver_id =>
      p_driver_id,

    p_balance_type =>
      'cash_debt',

    p_amount =>
      -v_amount,

    p_transaction_type =>
      'cash_debt_payment',

    p_description =>
      'Pago manual de deuda en efectivo',

    p_metadata =>
      jsonb_build_object(
        'cash_debt_payment_id',
        v_payment_id,
        'payment_method',
        v_payment_method,
        'reference',
        nullif(btrim(p_reference), ''),
        'notes',
        nullif(btrim(p_notes), '')
      )
  );

  perform public.log_finance_event(
    'cash_debt_payment',
    auth.uid(),
    jsonb_build_object(
      'driver_id',
      p_driver_id,
      'amount',
      v_amount,
      'payment_id',
      v_payment_id,
      'payment_method',
      v_payment_method
    )
  );

  return v_payment_id;
end;
$function$;

revoke all on function public.register_cash_debt_payment(
  uuid,
  numeric,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.register_cash_debt_payment(
  uuid,
  numeric,
  text,
  text,
  text
) to authenticated, service_role;

commit;
