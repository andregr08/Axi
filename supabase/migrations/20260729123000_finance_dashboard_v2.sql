-- =========================================================
-- AXI — DASHBOARD FINANCIERO V2
-- Solo lectura. No modifica pagos, wallets ni contabilidad.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. Resumen ejecutivo general
-- ---------------------------------------------------------

create or replace view public.finance_dashboard_v2
with (security_invoker = true)
as
select
  -- Fecha de generación
  now() as generated_at,

  -- Viajes y pagos cobrados
  (
    select count(*)
    from public.payment_transactions pt
    where pt.status = 'paid'
  )::bigint as total_paid_payments,

  (
    select count(*)
    from public.payment_transactions pt
    where pt.status in ('pending', 'processing')
  )::bigint as pending_payments,

  (
    select count(*)
    from public.payment_transactions pt
    where pt.status = 'failed'
  )::bigint as failed_payments,

  (
    select count(*)
    from public.payment_transactions pt
    where pt.status = 'refunded'
  )::bigint as refunded_payments,

  -- Ingresos brutos
  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as gross_revenue_all_time,

  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'day',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as gross_revenue_today,

  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'week',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as gross_revenue_week,

  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'month',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as gross_revenue_month,

  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'year',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as gross_revenue_year,

  -- Comisión de AXI
  coalesce((
    select sum(pt.platform_commission)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as platform_commission_all_time,

  coalesce((
    select sum(pt.platform_commission)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'day',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as platform_commission_today,

  coalesce((
    select sum(pt.platform_commission)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'month',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as platform_commission_month,

  -- Ganancias de conductores
  coalesce((
    select sum(pt.driver_earnings)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as gross_driver_earnings_all_time,

  coalesce((
    select sum(pt.driver_net_earnings)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as net_driver_earnings_all_time,

  coalesce((
    select sum(pt.driver_net_earnings)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.paid_at >=
        date_trunc(
          'month',
          now() at time zone 'America/Mexico_City'
        ) at time zone 'America/Mexico_City'
  ), 0)::numeric(14,2) as net_driver_earnings_month,

  -- Métodos de pago
  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.method = 'cash'
  ), 0)::numeric(14,2) as cash_payments_amount,

  coalesce((
    select sum(pt.total_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.method in ('card', 'mercado_pago')
  ), 0)::numeric(14,2) as digital_payments_amount,

  (
    select count(*)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.method = 'cash'
  )::bigint as cash_payments_count,

  (
    select count(*)
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.method in ('card', 'mercado_pago')
  )::bigint as digital_payments_count,

  -- Wallet de pasajeros utilizada
  coalesce((
    select sum(pt.passenger_wallet_applied)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as passenger_wallet_applied_total,

  -- Wallets de conductores
  (
    select count(*)
    from public.driver_wallets
  )::bigint as total_driver_wallets,

  coalesce((
    select sum(dw.available_balance)
    from public.driver_wallets dw
  ), 0)::numeric(14,2) as total_available_balance,

  coalesce((
    select sum(dw.pending_balance)
    from public.driver_wallets dw
  ), 0)::numeric(14,2) as total_pending_balance,

  coalesce((
    select sum(dw.reserved_balance)
    from public.driver_wallets dw
  ), 0)::numeric(14,2) as total_reserved_balance,

  coalesce((
    select sum(dw.cash_debt)
    from public.driver_wallets dw
  ), 0)::numeric(14,2) as total_cash_debt,

  coalesce((
    select sum(dw.lifetime_earnings)
    from public.driver_wallets dw
  ), 0)::numeric(14,2) as wallet_lifetime_earnings,

  coalesce((
    select sum(dw.total_withdrawn)
    from public.driver_wallets dw
  ), 0)::numeric(14,2) as total_withdrawn,

  -- Retiros
  (
    select count(*)
    from public.withdraw_requests wr
    where wr.status in ('pending', 'approved', 'processing')
  )::bigint as open_withdrawals,

  coalesce((
    select sum(wr.amount)
    from public.withdraw_requests wr
    where wr.status in ('pending', 'approved', 'processing')
  ), 0)::numeric(14,2) as open_withdrawal_amount,

  (
    select count(*)
    from public.withdraw_requests wr
    where wr.status = 'paid'
  )::bigint as paid_withdrawals,

  coalesce((
    select sum(wr.amount)
    from public.withdraw_requests wr
    where wr.status = 'paid'
  ), 0)::numeric(14,2) as paid_withdrawal_amount,

  (
    select count(*)
    from public.withdraw_requests wr
    where wr.status = 'failed'
  )::bigint as failed_withdrawals,

  -- Reembolsos
  (
    select count(*)
    from public.refund_requests rr
    where rr.status = 'pending'
  )::bigint as pending_refunds,

  coalesce((
    select sum(rr.amount)
    from public.refund_requests rr
    where rr.status = 'pending'
  ), 0)::numeric(14,2) as pending_refund_amount,

  (
    select count(*)
    from public.refund_requests rr
    where rr.status = 'approved'
  )::bigint as approved_refunds,

  coalesce((
    select sum(rr.amount)
    from public.refund_requests rr
    where rr.status = 'approved'
  ), 0)::numeric(14,2) as approved_refund_amount,

  (
    select count(*)
    from public.refund_requests rr
    where rr.status = 'rejected'
  )::bigint as rejected_refunds,

  -- Impuestos
  coalesce((
    select sum(pt.platform_commission_iva_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as platform_commission_iva_total,

  coalesce((
    select sum(pt.iva_withholding_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as iva_withholding_total,

  coalesce((
    select sum(pt.isr_withholding_amount)
    from public.payment_transactions pt
    where pt.status = 'paid'
  ), 0)::numeric(14,2) as isr_withholding_total,

  -- Contabilidad
  (
    select count(*)
    from public.financial_transactions ft
    where ft.status = 'posted'
  )::bigint as posted_financial_transactions,

  (
    select count(*)
    from public.financial_transactions ft
    where ft.status in ('draft', 'pending')
  )::bigint as pending_financial_transactions,

  (
    select count(*)
    from public.financial_transactions ft
    where ft.status = 'reversed'
  )::bigint as reversed_financial_transactions,

  -- Indicadores calculados
  (
    coalesce((
      select sum(pt.platform_commission)
      from public.payment_transactions pt
      where pt.status = 'paid'
    ), 0)
    -
    coalesce((
      select sum(rr.amount)
      from public.refund_requests rr
      where rr.status = 'approved'
    ), 0)
  )::numeric(14,2) as net_platform_revenue_before_expenses;

-- ---------------------------------------------------------
-- 2. Desglose diario para gráficas
-- ---------------------------------------------------------

create or replace view public.finance_daily_revenue_v2
with (security_invoker = true)
as
select
  (
    pt.paid_at at time zone 'America/Mexico_City'
  )::date as finance_date,

  count(*)::bigint as paid_payments,

  coalesce(sum(pt.total_amount), 0)::numeric(14,2)
    as gross_revenue,

  coalesce(sum(pt.platform_commission), 0)::numeric(14,2)
    as platform_commission,

  coalesce(sum(pt.driver_earnings), 0)::numeric(14,2)
    as gross_driver_earnings,

  coalesce(sum(pt.driver_net_earnings), 0)::numeric(14,2)
    as net_driver_earnings,

  coalesce(sum(
    case when pt.method = 'cash'
      then pt.total_amount else 0 end
  ), 0)::numeric(14,2) as cash_amount,

  coalesce(sum(
    case when pt.method in ('card', 'mercado_pago')
      then pt.total_amount else 0 end
  ), 0)::numeric(14,2) as digital_amount,

  coalesce(sum(pt.platform_commission_iva_amount), 0)::numeric(14,2)
    as platform_commission_iva,

  coalesce(sum(pt.iva_withholding_amount), 0)::numeric(14,2)
    as iva_withholding,

  coalesce(sum(pt.isr_withholding_amount), 0)::numeric(14,2)
    as isr_withholding

from public.payment_transactions pt
where pt.status = 'paid'
  and pt.paid_at is not null
group by
  (pt.paid_at at time zone 'America/Mexico_City')::date
order by finance_date desc;

-- ---------------------------------------------------------
-- 3. Conciliación pago → contabilidad → wallet
-- ---------------------------------------------------------

create or replace view public.finance_payment_reconciliation_v2
with (security_invoker = true)
as
select
  pt.id as payment_transaction_id,
  pt.trip_id,
  pt.passenger_id,
  pt.driver_id,
  pt.method,
  pt.status as payment_status,
  pt.total_amount,
  pt.platform_commission,
  pt.driver_earnings,
  pt.driver_net_earnings,
  pt.passenger_wallet_applied,
  pt.external_amount,
  pt.provider,
  pt.provider_payment_id,
  pt.paid_at,
  pt.refunded_at,

  ft.id as financial_transaction_id,
  ft.status as financial_status,
  ft.idempotency_key,
  ft.posted_at as financial_posted_at,

  wt.id as driver_wallet_transaction_id,
  wt.transaction_type as wallet_transaction_type,
  wt.balance_type as wallet_balance_type,
  wt.amount as wallet_transaction_amount,
  wt.created_at as wallet_transaction_created_at,

  case
    when pt.status <> 'paid' then 'not_applicable'
    when ft.id is null then 'missing_financial_transaction'
    when ft.status <> 'posted' then 'financial_transaction_not_posted'
    when pt.driver_id is not null
         and pt.driver_earnings > 0
         and wt.id is null
      then 'missing_driver_wallet_transaction'
    else 'reconciled'
  end as reconciliation_status

from public.payment_transactions pt

left join public.financial_transactions ft
  on ft.payment_id = pt.id
  and ft.reversal_of_transaction_id is null

left join lateral (
  select
    wallet_tx.id,
    wallet_tx.transaction_type,
    wallet_tx.balance_type,
    wallet_tx.amount,
    wallet_tx.created_at
  from public.wallet_transactions wallet_tx
  where wallet_tx.payment_transaction_id = pt.id
  order by wallet_tx.created_at desc nulls last
  limit 1
) wt on true;

-- ---------------------------------------------------------
-- 4. Permisos de lectura
-- RLS de tablas base sigue aplicando por security_invoker.
-- ---------------------------------------------------------

grant select on public.finance_dashboard_v2
to authenticated, service_role;

grant select on public.finance_daily_revenue_v2
to authenticated, service_role;

grant select on public.finance_payment_reconciliation_v2
to authenticated, service_role;

commit;
