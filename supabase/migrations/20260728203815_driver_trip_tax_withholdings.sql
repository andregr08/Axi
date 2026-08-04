alter table public.payment_transactions
  add column if not exists tax_base_amount numeric(12,2),
  add column if not exists platform_commission_iva_rate numeric(7,6),
  add column if not exists platform_commission_iva_amount numeric(12,2),
  add column if not exists iva_withholding_rate numeric(7,6),
  add column if not exists iva_withholding_amount numeric(12,2),
  add column if not exists isr_withholding_rate numeric(7,6),
  add column if not exists isr_withholding_amount numeric(12,2),
  add column if not exists driver_net_earnings numeric(12,2),
  add column if not exists tax_withholding_applied boolean,
  add column if not exists tax_calculated_at timestamptz,
  add column if not exists tax_model_version text,
  add column if not exists driver_rfc_snapshot text,
  add column if not exists driver_fiscal_name_snapshot text,
  add column if not exists driver_fiscal_postal_code_snapshot text,
  add column if not exists driver_tax_regime_code_snapshot text;

update public.payment_transactions
set
  tax_base_amount =
    coalesce(tax_base_amount, 0),

  platform_commission_iva_rate =
    coalesce(platform_commission_iva_rate, 0),

  platform_commission_iva_amount =
    coalesce(platform_commission_iva_amount, 0),

  iva_withholding_rate =
    coalesce(iva_withholding_rate, 0),

  iva_withholding_amount =
    coalesce(iva_withholding_amount, 0),

  isr_withholding_rate =
    coalesce(isr_withholding_rate, 0),

  isr_withholding_amount =
    coalesce(isr_withholding_amount, 0),

  driver_net_earnings =
    coalesce(
      driver_net_earnings,
      driver_earnings,
      0
    ),

  tax_withholding_applied =
    coalesce(tax_withholding_applied, false);

alter table public.payment_transactions
  alter column tax_base_amount set default 0,
  alter column tax_base_amount set not null,

  alter column platform_commission_iva_rate set default 0,
  alter column platform_commission_iva_rate set not null,

  alter column platform_commission_iva_amount set default 0,
  alter column platform_commission_iva_amount set not null,

  alter column iva_withholding_rate set default 0,
  alter column iva_withholding_rate set not null,

  alter column iva_withholding_amount set default 0,
  alter column iva_withholding_amount set not null,

  alter column isr_withholding_rate set default 0,
  alter column isr_withholding_rate set not null,

  alter column isr_withholding_amount set default 0,
  alter column isr_withholding_amount set not null,

  alter column driver_net_earnings set default 0,
  alter column driver_net_earnings set not null,

  alter column tax_withholding_applied set default false,
  alter column tax_withholding_applied set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'payment_transactions_tax_amounts_nonnegative'
      and conrelid =
        'public.payment_transactions'::regclass
  ) then
    alter table public.payment_transactions
      add constraint
        payment_transactions_tax_amounts_nonnegative
      check (
        tax_base_amount >= 0
        and platform_commission_iva_amount >= 0
        and iva_withholding_amount >= 0
        and isr_withholding_amount >= 0
        and driver_net_earnings >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'payment_transactions_tax_rates_valid'
      and conrelid =
        'public.payment_transactions'::regclass
  ) then
    alter table public.payment_transactions
      add constraint
        payment_transactions_tax_rates_valid
      check (
        platform_commission_iva_rate
          between 0 and 1
        and iva_withholding_rate
          between 0 and 1
        and isr_withholding_rate
          between 0 and 1
      );
  end if;
end;
$$;

comment on column
  public.payment_transactions.tax_base_amount
is
  'Base utilizada para calcular retenciones fiscales del conductor.';

comment on column
  public.payment_transactions.platform_commission_iva_amount
is
  'IVA trasladado sobre la comisión de servicio de AXI.';

comment on column
  public.payment_transactions.iva_withholding_amount
is
  'IVA retenido al conductor por ingresos digitales.';

comment on column
  public.payment_transactions.isr_withholding_amount
is
  'ISR retenido al conductor por ingresos digitales.';

comment on column
  public.payment_transactions.driver_net_earnings
is
  'Importe neto acreditable al wallet después de IVA de comisión y retenciones.';


drop function if exists public.calculate_driver_trip_taxes(
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean
);

create or replace function public.calculate_driver_trip_taxes(
  p_payment_method text,
  p_fare_subtotal numeric,
  p_tip_amount numeric,
  p_platform_commission numeric,
  p_driver_earnings numeric
)
returns table (
  tax_base_amount numeric(12,2),
  platform_commission_iva_rate numeric(7,6),
  platform_commission_iva_amount numeric(12,2),
  iva_withholding_rate numeric(7,6),
  iva_withholding_amount numeric(12,2),
  isr_withholding_rate numeric(7,6),
  isr_withholding_amount numeric(12,2),
  driver_net_earnings numeric(12,2),
  tax_withholding_applied boolean,
  tax_model_version text
)
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_fare_subtotal numeric(12,2);
  v_tip_amount numeric(12,2);
  v_platform_commission numeric(12,2);
  v_driver_earnings numeric(12,2);

  v_tax_base numeric(12,2);
  v_commission_iva_rate numeric(7,6) := 0.16;
  v_commission_iva numeric(12,2);

  v_iva_rate numeric(7,6) := 0;
  v_iva_amount numeric(12,2) := 0;

  v_isr_rate numeric(7,6) := 0;
  v_isr_amount numeric(12,2) := 0;

  v_driver_net numeric(12,2);
  v_withholding_applied boolean := false;
begin
  if p_payment_method not in (
    'cash',
    'card',
    'mercado_pago'
  ) then
    raise exception
      'Método de pago inválido para cálculo fiscal';
  end if;

  v_fare_subtotal :=
    round(
      greatest(
        coalesce(p_fare_subtotal, 0),
        0
      ),
      2
    );

  v_tip_amount :=
    round(
      greatest(
        coalesce(p_tip_amount, 0),
        0
      ),
      2
    );

  v_platform_commission :=
    round(
      greatest(
        coalesce(p_platform_commission, 0),
        0
      ),
      2
    );

  v_driver_earnings :=
    round(
      greatest(
        coalesce(p_driver_earnings, 0),
        0
      ),
      2
    );

  v_tax_base :=
    round(
      v_fare_subtotal + v_tip_amount,
      2
    );

  v_commission_iva :=
    round(
      v_platform_commission
      * v_commission_iva_rate,
      2
    );

  if p_payment_method in (
    'card',
    'mercado_pago'
  ) then
    v_iva_rate := 0.08;
    v_isr_rate := 0.021;
    v_withholding_applied := true;

    v_iva_amount :=
      round(
        v_tax_base * v_iva_rate,
        2
      );

    v_isr_amount :=
      round(
        v_tax_base * v_isr_rate,
        2
      );
  end if;

  v_driver_net :=
    round(
      v_driver_earnings
      - v_commission_iva
      - v_iva_amount
      - v_isr_amount,
      2
    );

  if v_driver_net < 0 then
    raise exception
      'Las deducciones fiscales superan la ganancia del conductor';
  end if;

  return query
  select
    v_tax_base,
    v_commission_iva_rate,
    v_commission_iva,
    v_iva_rate,
    v_iva_amount,
    v_isr_rate,
    v_isr_amount,
    v_driver_net,
    v_withholding_applied,
    'mx-platform-2026-v1'::text;
end;
$function$;

comment on function
  public.calculate_driver_trip_taxes(
    text,
    numeric,
    numeric,
    numeric,
    numeric
  )
is
  'Calcula IVA de comisión, retenciones digitales y ganancia neta sin bloquear pagos por datos fiscales.';


create or replace function public.create_trip_payment(
  requested_trip_id uuid,
  selected_method text default 'cash'::text,
  selected_tip numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_trip public.trips%rowtype;
  v_existing public.payment_transactions%rowtype;
  v_passenger_wallet public.passenger_wallets%rowtype;

  v_existing_found boolean := false;
  v_is_retry boolean := false;

  v_transaction_id uuid;
  v_passenger_wallet_transaction_id uuid;

  v_total numeric(12,2);
  v_driver_earnings numeric(12,2);
  v_platform_commission numeric(12,2);

  v_tax_base_amount numeric(12,2);
  v_platform_commission_iva_rate numeric(7,6);
  v_platform_commission_iva_amount numeric(12,2);
  v_iva_withholding_rate numeric(7,6);
  v_iva_withholding_amount numeric(12,2);
  v_isr_withholding_rate numeric(7,6);
  v_isr_withholding_amount numeric(12,2);
  v_driver_net_earnings numeric(12,2);
  v_tax_withholding_applied boolean;
  v_tax_model_version text;

  v_driver_rfc text;
  v_driver_fiscal_name text;
  v_driver_fiscal_postal_code text;
  v_driver_tax_regime_code text;

  v_passenger_wallet_applied numeric(12,2) := 0;
  v_external_amount numeric(12,2) := 0;
  v_cash_debt_created numeric(12,2) := 0;
begin
  if selected_method not in (
    'cash',
    'card',
    'mercado_pago'
  ) then
    raise exception 'Método de pago inválido';
  end if;

  selected_tip :=
    round(coalesce(selected_tip, 0)::numeric, 2);

  if selected_tip < 0 then
    raise exception 'La propina no puede ser negativa';
  end if;

  select *
  into v_trip
  from public.trips
  where id = requested_trip_id
  for update;

  if not found then
    raise exception 'El viaje no existe';
  end if;

  if v_trip.status <> 'completed' then
    raise exception 'El viaje todavía no está completado';
  end if;

  if v_trip.driver_id is null then
    raise exception 'El viaje no tiene conductor';
  end if;

  if v_trip.passenger_id <> auth.uid()
    and not public.is_axi_finance()
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;

  v_total :=
    round(
      coalesce(v_trip.final_price, 0)
      + selected_tip,
      2
    );

  v_platform_commission :=
    round(
      coalesce(v_trip.platform_commission, 0),
      2
    );

  v_driver_earnings :=
    round(
      coalesce(v_trip.driver_earnings, 0)
      + selected_tip,
      2
    );

  select
    tax_base_amount,
    platform_commission_iva_rate,
    platform_commission_iva_amount,
    iva_withholding_rate,
    iva_withholding_amount,
    isr_withholding_rate,
    isr_withholding_amount,
    driver_net_earnings,
    tax_withholding_applied,
    tax_model_version
  into
    v_tax_base_amount,
    v_platform_commission_iva_rate,
    v_platform_commission_iva_amount,
    v_iva_withholding_rate,
    v_iva_withholding_amount,
    v_isr_withholding_rate,
    v_isr_withholding_amount,
    v_driver_net_earnings,
    v_tax_withholding_applied,
    v_tax_model_version
  from public.calculate_driver_trip_taxes(
    p_payment_method =>
      selected_method,

    p_fare_subtotal =>
      coalesce(v_trip.fare_subtotal, 0),

    p_tip_amount =>
      selected_tip,

    p_platform_commission =>
      v_platform_commission,

    p_driver_earnings =>
      v_driver_earnings
  );

  select
    coalesce(
      (
        select nullif(btrim(tp.rfc), '')
        from public.driver_tax_profiles tp
        where tp.driver_id = v_trip.driver_id
        limit 1
      ),
      (
        select nullif(btrim(da.rfc), '')
        from public.driver_applications da
        where da.user_id = v_trip.driver_id
        order by da.updated_at desc
        limit 1
      )
    ),

    coalesce(
      (
        select nullif(btrim(tp.fiscal_name), '')
        from public.driver_tax_profiles tp
        where tp.driver_id = v_trip.driver_id
        limit 1
      ),
      (
        select nullif(btrim(da.fiscal_name), '')
        from public.driver_applications da
        where da.user_id = v_trip.driver_id
        order by da.updated_at desc
        limit 1
      )
    ),

    coalesce(
      (
        select nullif(
          btrim(tp.fiscal_postal_code),
          ''
        )
        from public.driver_tax_profiles tp
        where tp.driver_id = v_trip.driver_id
        limit 1
      ),
      (
        select nullif(
          btrim(da.fiscal_postal_code),
          ''
        )
        from public.driver_applications da
        where da.user_id = v_trip.driver_id
        order by da.updated_at desc
        limit 1
      )
    ),

    coalesce(
      (
        select nullif(
          btrim(tp.tax_regime_code),
          ''
        )
        from public.driver_tax_profiles tp
        where tp.driver_id = v_trip.driver_id
        limit 1
      ),
      (
        select nullif(
          btrim(da.tax_regime_code),
          ''
        )
        from public.driver_applications da
        where da.user_id = v_trip.driver_id
        order by da.updated_at desc
        limit 1
      )
    )
  into
    v_driver_rfc,
    v_driver_fiscal_name,
    v_driver_fiscal_postal_code,
    v_driver_tax_regime_code;

  insert into public.passenger_wallets (
    passenger_id
  )
  values (
    v_trip.passenger_id
  )
  on conflict (passenger_id)
  do nothing;

  select *
  into v_passenger_wallet
  from public.passenger_wallets
  where passenger_id = v_trip.passenger_id
  for update;

  select *
  into v_existing
  from public.payment_transactions
  where trip_id = requested_trip_id
  for update;

  v_existing_found := found;

  if v_existing_found
    and v_existing.wallet_applied_at is not null
    and v_existing.status not in (
      'failed',
      'cancelled'
    ) then

    if v_existing.method <> selected_method
      or round(v_existing.tip_amount, 2)
        <> selected_tip
      or round(v_existing.driver_earnings, 2)
        <> v_driver_earnings
      or round(v_existing.platform_commission, 2)
        <> v_platform_commission
      or round(v_existing.driver_net_earnings, 2)
        <> v_driver_net_earnings
      or round(
        v_existing.platform_commission_iva_amount,
        2
      ) <> v_platform_commission_iva_amount
      or round(
        v_existing.iva_withholding_amount,
        2
      ) <> v_iva_withholding_amount
      or round(
        v_existing.isr_withholding_amount,
        2
      ) <> v_isr_withholding_amount then

      raise exception
        'El pago ya fue aplicado al wallet y no puede modificarse';
    end if;

    return v_existing.id;
  end if;

  v_is_retry :=
    v_existing_found
    and v_existing.status in (
      'failed',
      'cancelled'
    );

  v_passenger_wallet_applied :=
    round(
      least(
        coalesce(
          v_passenger_wallet.available_balance,
          0
        ),
        v_platform_commission
      ),
      2
    );

  v_external_amount :=
    round(
      v_total - v_passenger_wallet_applied,
      2
    );

  v_cash_debt_created :=
    round(
      greatest(
        v_platform_commission
        + v_platform_commission_iva_amount
        - v_passenger_wallet_applied,
        0
      ),
      2
    );

  insert into public.payment_transactions (
    trip_id,
    passenger_id,
    driver_id,
    method,
    status,
    subtotal,
    booking_fee,
    tip_amount,
    total_amount,
    platform_commission,
    driver_earnings,
    tax_base_amount,
    platform_commission_iva_rate,
    platform_commission_iva_amount,
    iva_withholding_rate,
    iva_withholding_amount,
    isr_withholding_rate,
    isr_withholding_amount,
    driver_net_earnings,
    tax_withholding_applied,
    tax_calculated_at,
    tax_model_version,
    driver_rfc_snapshot,
    driver_fiscal_name_snapshot,
    driver_fiscal_postal_code_snapshot,
    driver_tax_regime_code_snapshot,
    passenger_wallet_applied,
    external_amount,
    passenger_wallet_transaction_id,
    passenger_wallet_reversed_at,
    provider,
    provider_payment_id,
    failure_reason,
    paid_at,
    refunded_at,
    wallet_applied_at,
    wallet_released_at,
    wallet_reversed_at,
    earnings_counted_at
  )
  values (
    v_trip.id,
    v_trip.passenger_id,
    v_trip.driver_id,
    selected_method,

    case
      when selected_method = 'cash'
        then 'paid'
      else 'pending'
    end,

    coalesce(v_trip.fare_subtotal, 0),
    coalesce(v_trip.booking_fee, 0),
    selected_tip,
    v_total,
    v_platform_commission,
    v_driver_earnings,
    v_tax_base_amount,
    v_platform_commission_iva_rate,
    v_platform_commission_iva_amount,
    v_iva_withholding_rate,
    v_iva_withholding_amount,
    v_isr_withholding_rate,
    v_isr_withholding_amount,
    v_driver_net_earnings,
    v_tax_withholding_applied,
    now(),
    v_tax_model_version,
    v_driver_rfc,
    v_driver_fiscal_name,
    v_driver_fiscal_postal_code,
    v_driver_tax_regime_code,
    v_passenger_wallet_applied,
    v_external_amount,
    null,
    null,

    case
      when selected_method = 'mercado_pago'
        then 'mercado_pago'
      when selected_method = 'card'
        then 'card_provider'
      else 'cash'
    end,

    null,
    null,

    case
      when selected_method = 'cash'
        then now()
      else null
    end,

    null,
    null,
    null,
    null,
    null
  )
  on conflict (trip_id)
  do update set
    method = excluded.method,
    status = excluded.status,
    subtotal = excluded.subtotal,
    booking_fee = excluded.booking_fee,
    tip_amount = excluded.tip_amount,
    total_amount = excluded.total_amount,

    platform_commission =
      excluded.platform_commission,

    driver_earnings =
      excluded.driver_earnings,

    tax_base_amount =
      excluded.tax_base_amount,

    platform_commission_iva_rate =
      excluded.platform_commission_iva_rate,

    platform_commission_iva_amount =
      excluded.platform_commission_iva_amount,

    iva_withholding_rate =
      excluded.iva_withholding_rate,

    iva_withholding_amount =
      excluded.iva_withholding_amount,

    isr_withholding_rate =
      excluded.isr_withholding_rate,

    isr_withholding_amount =
      excluded.isr_withholding_amount,

    driver_net_earnings =
      excluded.driver_net_earnings,

    tax_withholding_applied =
      excluded.tax_withholding_applied,

    tax_calculated_at =
      excluded.tax_calculated_at,

    tax_model_version =
      excluded.tax_model_version,

    driver_rfc_snapshot =
      excluded.driver_rfc_snapshot,

    driver_fiscal_name_snapshot =
      excluded.driver_fiscal_name_snapshot,

    driver_fiscal_postal_code_snapshot =
      excluded.driver_fiscal_postal_code_snapshot,

    driver_tax_regime_code_snapshot =
      excluded.driver_tax_regime_code_snapshot,

    passenger_wallet_applied =
      excluded.passenger_wallet_applied,

    external_amount =
      excluded.external_amount,

    passenger_wallet_transaction_id = null,
    passenger_wallet_reversed_at = null,
    provider = excluded.provider,
    provider_payment_id = null,
    failure_reason = null,
    paid_at = excluded.paid_at,
    refunded_at = null,
    wallet_applied_at = null,
    wallet_released_at = null,
    wallet_reversed_at = null,
    earnings_counted_at = null,
    updated_at = now()
  returning id
  into v_transaction_id;

  if v_passenger_wallet_applied > 0 then
    v_passenger_wallet_transaction_id :=
      public.apply_passenger_wallet_movement(
        p_passenger_id =>
          v_trip.passenger_id,

        p_amount =>
          -v_passenger_wallet_applied,

        p_transaction_type =>
          'trip_payment',

        p_description =>
          'Saldo AXI utilizado en un viaje',

        p_trip_id =>
          v_trip.id,

        p_refund_request_id =>
          null,

        p_metadata =>
          jsonb_build_object(
            'payment_transaction_id',
            v_transaction_id,

            'gross_total',
            v_total,

            'wallet_applied',
            v_passenger_wallet_applied,

            'external_amount',
            v_external_amount,

            'platform_commission',
            v_platform_commission,

            'platform_commission_iva',
            v_platform_commission_iva_amount,

            'gross_driver_earnings',
            v_driver_earnings,

            'driver_net_earnings',
            v_driver_net_earnings,

            'iva_withheld',
            v_iva_withholding_amount,

            'isr_withheld',
            v_isr_withholding_amount,

            'tip_amount',
            selected_tip,

            'retry',
            v_is_retry
          )
      );

    update public.payment_transactions
    set
      passenger_wallet_transaction_id =
        v_passenger_wallet_transaction_id,
      updated_at = now()
    where id = v_transaction_id;
  end if;

  insert into public.driver_wallets (
    driver_id
  )
  values (
    v_trip.driver_id
  )
  on conflict (driver_id)
  do nothing;

  if selected_method = 'cash' then
    if v_cash_debt_created > 0
      or v_driver_net_earnings > 0 then

      perform public.apply_wallet_movement(
        p_driver_id =>
          v_trip.driver_id,

        p_balance_type =>
          'cash_debt',

        p_amount =>
          v_cash_debt_created,

        p_transaction_type =>
          'cash_trip_commission',

        p_trip_id =>
          v_trip.id,

        p_payment_transaction_id =>
          v_transaction_id,

        p_description =>
          case
            when v_passenger_wallet_applied > 0 then
              'Comisión e IVA restantes después de aplicar saldo del pasajero'
            else
              'Comisión de AXI e IVA por viaje pagado en efectivo'
          end,

        p_metadata =>
          jsonb_build_object(
            'payment_method',
            selected_method,

            'gross_total',
            v_total,

            'external_amount',
            v_external_amount,

            'passenger_wallet_applied',
            v_passenger_wallet_applied,

            'platform_commission',
            v_platform_commission,

            'platform_commission_iva',
            v_platform_commission_iva_amount,

            'cash_debt_created',
            v_cash_debt_created,

            'gross_driver_earnings',
            v_driver_earnings,

            'driver_net_earnings',
            v_driver_net_earnings,

            'iva_withheld',
            v_iva_withholding_amount,

            'isr_withheld',
            v_isr_withholding_amount,

            'tax_model_version',
            v_tax_model_version
          ),

        p_lifetime_earnings_delta =>
          v_driver_net_earnings,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    update public.payment_transactions
    set
      wallet_applied_at = now(),
      earnings_counted_at = now(),
      updated_at = now()
    where id = v_transaction_id;

  else
    if v_driver_net_earnings > 0 then
      perform public.apply_wallet_movement(
        p_driver_id =>
          v_trip.driver_id,

        p_balance_type =>
          'pending',

        p_amount =>
          v_driver_net_earnings,

        p_transaction_type =>
          case
            when v_is_retry
              then 'digital_earning_reopened'
            else 'digital_earning_pending'
          end,

        p_trip_id =>
          v_trip.id,

        p_payment_transaction_id =>
          v_transaction_id,

        p_description =>
          'Ganancia neta pendiente de confirmación del proveedor',

        p_metadata =>
          jsonb_build_object(
            'payment_method',
            selected_method,

            'gross_total',
            v_total,

            'external_amount',
            v_external_amount,

            'passenger_wallet_applied',
            v_passenger_wallet_applied,

            'platform_commission',
            v_platform_commission,

            'platform_commission_iva',
            v_platform_commission_iva_amount,

            'gross_driver_earnings',
            v_driver_earnings,

            'iva_withheld',
            v_iva_withholding_amount,

            'isr_withheld',
            v_isr_withholding_amount,

            'driver_net_earnings',
            v_driver_net_earnings,

            'tax_model_version',
            v_tax_model_version,

            'retry',
            v_is_retry
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    update public.payment_transactions
    set
      wallet_applied_at = now(),
      wallet_reversed_at = null,
      updated_at = now()
    where id = v_transaction_id;
  end if;

  update public.trips
  set
    payment_method = selected_method,

    payment_status =
      case
        when selected_method = 'cash'
          then 'paid'
        else 'pending'
      end,

    tip_amount = selected_tip,

    wallet_credit_used =
      v_passenger_wallet_applied,

    amount_due =
      v_external_amount,

    paid_at =
      case
        when selected_method = 'cash'
          then now()
        else null
      end,

    payment_reference = null,
    updated_at = now()
  where id = requested_trip_id;

  insert into public.trip_events (
    trip_id,
    status,
    description,
    created_by
  )
  values (
    requested_trip_id,
    'completed',

    format(
      'Pago generado. Método: %s. Total: $%s. Neto conductor: $%s. IVA retenido: $%s. ISR retenido: $%s',
      selected_method,
      v_total,
      v_driver_net_earnings,
      v_iva_withholding_amount,
      v_isr_withholding_amount
    ),

    auth.uid()
  );

  return v_transaction_id;
end;
$function$;


create or replace function public.update_payment_status(
  transaction_id_value uuid,
  new_status_value text,
  provider_reference_value text default null::text,
  failure_reason_value text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_payment public.payment_transactions%rowtype;
  v_wallet public.driver_wallets%rowtype;

  v_debt_offset numeric(12,2) := 0;
  v_available_credit numeric(12,2) := 0;
  v_lifetime_delta numeric(12,2) := 0;
  v_net_earnings numeric(12,2) := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_axi_finance() then

    raise exception
      'Solo Finanzas, Administración o el proveedor pueden actualizar pagos';
  end if;

  if new_status_value not in (
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled'
  ) then
    raise exception
      'Estado de pago inválido para esta función: %',
      new_status_value;
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = transaction_id_value
  for update;

  if not found then
    raise exception 'La transacción no existe';
  end if;

  v_net_earnings :=
    round(
      coalesce(
        v_payment.driver_net_earnings,
        v_payment.driver_earnings,
        0
      ),
      2
    );

  if v_payment.status = 'refunded' then
    raise exception 'El pago ya fue reembolsado';
  end if;

  if v_payment.status = 'paid'
    and new_status_value <> 'paid' then

    raise exception
      'Un pago confirmado no puede marcarse como fallido o cancelado';
  end if;

  if v_payment.method in (
      'card',
      'mercado_pago'
    )
    and new_status_value = 'paid'
    and v_payment.wallet_released_at is null then

    if v_payment.driver_id is null then
      raise exception 'El pago no tiene conductor';
    end if;

    insert into public.driver_wallets (
      driver_id
    )
    values (
      v_payment.driver_id
    )
    on conflict (driver_id)
    do nothing;

    if v_payment.wallet_applied_at is null
      or v_payment.wallet_reversed_at is not null then

      if v_net_earnings > 0 then
        perform public.apply_wallet_movement(
          p_driver_id =>
            v_payment.driver_id,

          p_balance_type =>
            'pending',

          p_amount =>
            v_net_earnings,

          p_transaction_type =>
            'digital_earning_reopened',

          p_trip_id =>
            v_payment.trip_id,

          p_payment_transaction_id =>
            v_payment.id,

          p_description =>
            'Ganancia neta digital reactivada antes de confirmar el pago',

          p_metadata =>
            jsonb_build_object(
              'provider_reference',
              provider_reference_value,

              'gross_driver_earnings',
              v_payment.driver_earnings,

              'driver_net_earnings',
              v_net_earnings,

              'iva_withheld',
              v_payment.iva_withholding_amount,

              'isr_withheld',
              v_payment.isr_withholding_amount
            ),

          p_lifetime_earnings_delta =>
            0,

          p_total_withdrawn_delta =>
            0
        );
      end if;

      update public.payment_transactions
      set
        wallet_applied_at =
          coalesce(wallet_applied_at, now()),

        wallet_reversed_at = null,
        updated_at = now()
      where id = v_payment.id;

      v_payment.wallet_applied_at :=
        coalesce(
          v_payment.wallet_applied_at,
          now()
        );

      v_payment.wallet_reversed_at := null;
    end if;

    select *
    into v_wallet
    from public.driver_wallets
    where driver_id = v_payment.driver_id
    for update;

    v_debt_offset :=
      least(
        coalesce(v_wallet.cash_debt, 0),
        v_net_earnings
      );

    v_available_credit :=
      round(
        v_net_earnings
        - v_debt_offset,
        2
      );

    if v_net_earnings > 0 then
      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'pending',

        p_amount =>
          -v_net_earnings,

        p_transaction_type =>
          'digital_earning_released',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Pago neto confirmado por el proveedor',

        p_metadata =>
          jsonb_build_object(
            'provider_reference',
            provider_reference_value,

            'gross_driver_earnings',
            v_payment.driver_earnings,

            'driver_net_earnings',
            v_net_earnings,

            'platform_commission_iva',
            v_payment.platform_commission_iva_amount,

            'iva_withheld',
            v_payment.iva_withholding_amount,

            'isr_withheld',
            v_payment.isr_withholding_amount
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    if v_debt_offset > 0 then
      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'cash_debt',

        p_amount =>
          -v_debt_offset,

        p_transaction_type =>
          'automatic_cash_debt_offset',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Pago automático de deuda en efectivo',

        p_metadata =>
          jsonb_build_object(
            'provider_reference',
            provider_reference_value,

            'offset_amount',
            v_debt_offset,

            'driver_net_earnings',
            v_net_earnings
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    v_lifetime_delta :=
      case
        when v_payment.earnings_counted_at is null
          then v_net_earnings
        else 0
      end;

    if v_available_credit <> 0
      or v_lifetime_delta <> 0 then

      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'available',

        p_amount =>
          v_available_credit,

        p_transaction_type =>
          'digital_earning_available',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Ganancia neta disponible después de impuestos y deudas',

        p_metadata =>
          jsonb_build_object(
            'provider_reference',
            provider_reference_value,

            'gross_driver_earnings',
            v_payment.driver_earnings,

            'platform_commission_iva',
            v_payment.platform_commission_iva_amount,

            'iva_withheld',
            v_payment.iva_withholding_amount,

            'isr_withheld',
            v_payment.isr_withholding_amount,

            'driver_net_earnings',
            v_net_earnings,

            'cash_debt_offset',
            v_debt_offset,

            'net_available',
            v_available_credit,

            'tax_model_version',
            v_payment.tax_model_version
          ),

        p_lifetime_earnings_delta =>
          v_lifetime_delta,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    update public.payment_transactions
    set
      wallet_released_at = now(),
      wallet_reversed_at = null,

      earnings_counted_at =
        coalesce(
          earnings_counted_at,
          now()
        ),

      updated_at = now()
    where id = v_payment.id;
  end if;

  if v_payment.method in (
      'card',
      'mercado_pago'
    )
    and new_status_value in (
      'failed',
      'cancelled'
    )
    and v_payment.wallet_applied_at is not null
    and v_payment.wallet_released_at is null
    and v_payment.wallet_reversed_at is null then

    if v_net_earnings > 0 then
      perform public.apply_wallet_movement(
        p_driver_id =>
          v_payment.driver_id,

        p_balance_type =>
          'pending',

        p_amount =>
          -v_net_earnings,

        p_transaction_type =>
          'digital_earning_reversed',

        p_trip_id =>
          v_payment.trip_id,

        p_payment_transaction_id =>
          v_payment.id,

        p_description =>
          'Pago neto rechazado o cancelado por el proveedor',

        p_metadata =>
          jsonb_build_object(
            'failure_reason',
            failure_reason_value,

            'gross_driver_earnings',
            v_payment.driver_earnings,

            'driver_net_earnings',
            v_net_earnings,

            'iva_withheld',
            v_payment.iva_withholding_amount,

            'isr_withheld',
            v_payment.isr_withholding_amount
          ),

        p_lifetime_earnings_delta =>
          0,

        p_total_withdrawn_delta =>
          0
      );
    end if;

    update public.payment_transactions
    set
      wallet_reversed_at = now(),
      updated_at = now()
    where id = v_payment.id;
  end if;

  update public.payment_transactions
  set
    status = new_status_value,

    provider_payment_id =
      coalesce(
        nullif(
          btrim(provider_reference_value),
          ''
        ),
        provider_payment_id
      ),

    failure_reason =
      case
        when new_status_value = 'failed' then
          coalesce(
            nullif(
              btrim(failure_reason_value),
              ''
            ),
            'Pago rechazado'
          )
        else null
      end,

    paid_at =
      case
        when new_status_value = 'paid'
          then coalesce(paid_at, now())

        when new_status_value in (
          'failed',
          'cancelled'
        )
          then null

        else paid_at
      end,

    updated_at = now()
  where id = transaction_id_value;

  update public.trips
  set
    payment_status = new_status_value,

    payment_reference =
      coalesce(
        nullif(
          btrim(provider_reference_value),
          ''
        ),
        payment_reference
      ),

    paid_at =
      case
        when new_status_value = 'paid'
          then coalesce(paid_at, now())

        when new_status_value in (
          'failed',
          'cancelled'
        )
          then null

        else paid_at
      end,

    updated_at = now()
  where id = v_payment.trip_id;

  perform public.create_notification(
    v_payment.passenger_id,
    'payment',

    case new_status_value
      when 'paid'
        then 'Pago confirmado'
      when 'failed'
        then 'Pago rechazado'
      when 'processing'
        then 'Pago en proceso'
      when 'cancelled'
        then 'Pago cancelado'
      else 'Pago pendiente'
    end,

    case new_status_value
      when 'paid' then
        format(
          'Tu pago de $%s MXN fue confirmado.',
          v_payment.total_amount
        )

      when 'failed' then
        coalesce(
          nullif(
            btrim(failure_reason_value),
            ''
          ),
          'No fue posible procesar tu pago.'
        )

      when 'processing' then
        'Tu pago está siendo procesado.'

      when 'cancelled' then
        'La operación de pago fue cancelada.'

      else
        'Tu pago continúa pendiente.'
    end,

    v_payment.trip_id,
    null,

    jsonb_build_object(
      'transaction_id',
      v_payment.id,

      'payment_status',
      new_status_value,

      'total_amount',
      v_payment.total_amount
    )
  );

  if v_payment.driver_id is not null
    and new_status_value = 'paid' then

    perform public.create_notification(
      v_payment.driver_id,
      'payment',
      'Ganancia disponible',

      format(
        'Tu ganancia neta de $%s MXN fue confirmada.',
        v_net_earnings
      ),

      v_payment.trip_id,
      null,

      jsonb_build_object(
        'transaction_id',
        v_payment.id,

        'gross_driver_earnings',
        v_payment.driver_earnings,

        'platform_commission_iva',
        v_payment.platform_commission_iva_amount,

        'iva_withheld',
        v_payment.iva_withholding_amount,

        'isr_withheld',
        v_payment.isr_withholding_amount,

        'driver_net_earnings',
        v_net_earnings,

        'cash_debt_offset',
        v_debt_offset,

        'net_available',
        v_available_credit
      )
    );
  end if;
end;
$function$;

create or replace function public.advance_trip_status(
  p_trip_id uuid,
  p_next_status trip_status
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_trip public.trips%rowtype;
  v_user_role public.user_role;
  v_now timestamptz := now();

  v_total numeric := 0;
  v_booking_fee numeric := 0;
  v_subtotal numeric := 0;
  v_tip_amount numeric := 0;
  v_platform_commission numeric := 0;
  v_driver_earnings numeric := 0;

  v_event_description text;
  v_notification_title text;
  v_notification_body text;
  v_notification_type text;
begin
  v_user_role :=
    public.get_current_user_role();

  select *
  into v_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'El viaje no existe';
  end if;

  if v_trip.driver_id is null then
    raise exception
      'El viaje no tiene un conductor asignado';
  end if;

  if v_user_role = 'driver' then
    if v_trip.driver_id is distinct from auth.uid() then
      raise exception
        'Este viaje no pertenece al conductor autenticado';
    end if;

  elsif not public.is_axi_admin() then
    raise exception
      'Solo el conductor asignado o un administrador puede avanzar el viaje';
  end if;

  if v_trip.status = 'completed' then
    raise exception 'El viaje ya fue completado';
  end if;

  if v_trip.status = 'cancelled' then
    raise exception
      'Un viaje cancelado no puede avanzar';
  end if;

  if v_trip.status = 'accepted'
    and p_next_status = 'driver_arriving' then

    update public.trips
    set
      status = 'driver_arriving',
      driver_arriving_at =
        coalesce(driver_arriving_at, v_now),
      updated_at = v_now
    where id = p_trip_id;

    v_event_description :=
      'El conductor inició el trayecto hacia el punto de recogida';

    v_notification_title :=
      'Tu conductor va en camino';

    v_notification_body :=
      'El conductor ya se dirige hacia el punto de recogida.';

    v_notification_type :=
      'driver_arriving';

  elsif v_trip.status = 'driver_arriving'
    and p_next_status = 'driver_arrived' then

    update public.trips
    set
      status = 'driver_arrived',
      driver_arriving_at =
        coalesce(driver_arriving_at, v_now),
      driver_arrived_at =
        coalesce(driver_arrived_at, v_now),
      updated_at = v_now
    where id = p_trip_id;

    v_event_description :=
      'El conductor llegó al punto de recogida';

    v_notification_title :=
      'Tu conductor llegó';

    v_notification_body :=
      'El conductor ya se encuentra en el punto de recogida.';

    v_notification_type :=
      'driver_arrived';

  elsif v_trip.status = 'driver_arrived'
    and p_next_status = 'in_progress' then

    update public.trips
    set
      status = 'in_progress',
      driver_arrived_at =
        coalesce(driver_arrived_at, v_now),
      started_at =
        coalesce(started_at, v_now),
      updated_at = v_now
    where id = p_trip_id;

    v_event_description :=
      'El conductor confirmó el inicio del viaje';

    v_notification_title :=
      'Viaje iniciado';

    v_notification_body :=
      'Tu viaje ha comenzado correctamente.';

    v_notification_type :=
      'trip_started';

  elsif v_trip.status = 'in_progress'
    and p_next_status = 'completed' then

    v_total :=
      round(
        greatest(
          coalesce(
            v_trip.final_price,
            v_trip.estimated_price,
            0
          ),
          0
        ),
        2
      );

    v_booking_fee :=
      round(
        greatest(
          coalesce(v_trip.booking_fee, 0),
          0
        ),
        2
      );

    v_subtotal :=
      round(
        greatest(
          v_total - v_booking_fee,
          0
        ),
        2
      );

    v_tip_amount := 0;

    v_platform_commission :=
      round(
        (v_subtotal * 0.20)
        + v_booking_fee,
        2
      );

    v_driver_earnings :=
      round(
        (v_subtotal * 0.80)
        + v_tip_amount,
        2
      );

    update public.trips
    set
      status = 'completed',
      final_price = v_total,
      fare_subtotal = v_subtotal,
      platform_commission = v_platform_commission,
      driver_earnings = v_driver_earnings,
      payment_status = 'pending',
      tip_amount = 0,
      wallet_credit_used = 0,
      amount_due = v_total,
      paid_at = null,
      payment_reference = null,
      started_at =
        coalesce(started_at, v_now),
      completed_at =
        coalesce(completed_at, v_now),
      updated_at = v_now
    where id = p_trip_id;

    update public.profiles
    set
      total_trips =
        coalesce(total_trips, 0) + 1,
      updated_at = v_now
    where id in (
      v_trip.passenger_id,
      v_trip.driver_id
    );

    v_event_description :=
      'El viaje finalizó y quedó pendiente de pago';

    v_notification_title :=
      'Viaje completado';

    v_notification_type :=
      'trip_completed';

    v_notification_body :=
      format(
        'Tu viaje terminó correctamente. Total: $%s MXN. Completa el método de pago.',
        to_char(
          v_total,
          'FM999999990.00'
        )
      );

  else
    raise exception
      'Cambio de estado inválido: % → %',
      v_trip.status,
      p_next_status;
  end if;

  insert into public.trip_events (
    trip_id,
    status,
    description,
    created_by
  )
  values (
    p_trip_id,
    p_next_status,
    v_event_description,
    auth.uid()
  );

  perform public.create_notification(
    target_user_id =>
      v_trip.passenger_id,

    notification_type =>
      v_notification_type,

    notification_title =>
      v_notification_title,

    notification_body =>
      v_notification_body,

    related_trip_id =>
      p_trip_id,

    related_offer_id =>
      null,

    notification_data =>
      jsonb_build_object(
        'trip_id',
        p_trip_id,
        'previous_status',
        v_trip.status,
        'status',
        p_next_status,
        'driver_id',
        v_trip.driver_id,
        'updated_at',
        v_now
      )
  );

  perform public.refresh_driver_operational_status(
    v_trip.driver_id
  );
end;
$function$;