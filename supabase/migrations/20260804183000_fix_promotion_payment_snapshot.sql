-- ============================================================
-- AXI: CORRECCIÓN DEL SNAPSHOT PROMOCIONAL DEL PAGO
-- ============================================================

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

  v_gross_trip_amount numeric(12,2);
  v_promotion_discount numeric(12,2);
  v_net_trip_amount numeric(12,2);
  v_promotion_redemption_id uuid;
  v_promotion_redemption public.promo_redemptions%rowtype;

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

  select redemption.*
  into v_promotion_redemption
  from public.promo_redemptions redemption
  where redemption.trip_id = v_trip.id
    and (
      v_trip.promo_code_id is null
      or redemption.promo_code_id = v_trip.promo_code_id
    )
  order by redemption.created_at desc
  limit 1;

  if found then
    v_promotion_redemption_id :=
      v_promotion_redemption.id;

    v_gross_trip_amount :=
      round(
        coalesce(
          v_promotion_redemption.original_amount,
          0
        ),
        2
      );

    v_promotion_discount :=
      round(
        greatest(
          coalesce(
            v_promotion_redemption.discount_amount,
            0
          ),
          0
        ),
        2
      );

    v_net_trip_amount :=
      round(
        coalesce(
          v_promotion_redemption.final_amount,
          0
        ),
        2
      );
  else
    v_promotion_redemption_id := null;

    v_promotion_discount :=
      round(
        greatest(
          coalesce(v_trip.discount_amount, 0),
          0
        ),
        2
      );

    v_net_trip_amount :=
      round(
        coalesce(v_trip.final_price, 0),
        2
      );

    v_gross_trip_amount :=
      round(
        v_net_trip_amount + v_promotion_discount,
        2
      );
  end if;

  if v_promotion_discount > 0
     and v_promotion_redemption_id is null then
    raise exception
      'El viaje tiene descuento pero no tiene redención promocional';
  end if;

  if v_promotion_discount > v_gross_trip_amount then
    raise exception
      'El descuento promocional supera el importe bruto del viaje';
  end if;

  if round(
       v_gross_trip_amount - v_promotion_discount,
       2
     ) <> round(v_net_trip_amount, 2) then
    raise exception
      'La redención promocional no cumple bruto - descuento = neto';
  end if;

  v_total :=
    round(
      v_net_trip_amount + selected_tip,
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

    gross_trip_amount,
    promotion_discount,
    promotion_code,
    promotion_code_id,
    promotion_redemption_id,
    net_trip_amount,

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

    v_gross_trip_amount,
    v_promotion_discount,
    nullif(btrim(coalesce(v_trip.promo_code, '')), ''),
    v_trip.promo_code_id,
    v_promotion_redemption_id,
    v_net_trip_amount,

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

    gross_trip_amount =
      excluded.gross_trip_amount,

    promotion_discount =
      excluded.promotion_discount,

    promotion_code =
      excluded.promotion_code,

    promotion_code_id =
      excluded.promotion_code_id,

    promotion_redemption_id =
      excluded.promotion_redemption_id,

    net_trip_amount =
      excluded.net_trip_amount,

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

