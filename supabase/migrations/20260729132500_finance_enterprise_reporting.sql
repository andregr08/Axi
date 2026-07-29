-- ============================================================================
-- AXI FINANCE ENTERPRISE REPORTING
-- Catálogo contable ampliado + estados financieros
-- ============================================================================

begin;

-- ============================================================================
-- 1. CATÁLOGO CONTABLE
-- ============================================================================

insert into public.financial_accounts (
  code,
  name,
  description,
  account_type,
  owner_type,
  currency,
  normal_balance,
  status,
  allows_negative_balance,
  metadata
)
values
  -- ACTIVOS
  (
    'asset.cash',
    'Caja',
    'Efectivo propiedad de AXI.',
    'asset',
    'platform',
    'MXN',
    'debit',
    'active',
    false,
    '{"group":"cash_and_equivalents","statement":"balance_sheet"}'::jsonb
  ),
  (
    'asset.bank',
    'Bancos',
    'Saldos disponibles en cuentas bancarias de AXI.',
    'asset',
    'platform',
    'MXN',
    'debit',
    'active',
    false,
    '{"group":"cash_and_equivalents","statement":"balance_sheet"}'::jsonb
  ),
  (
    'asset.accounts_receivable',
    'Cuentas por cobrar',
    'Importes pendientes de cobro a clientes, proveedores o terceros.',
    'asset',
    'platform',
    'MXN',
    'debit',
    'active',
    false,
    '{"group":"receivables","statement":"balance_sheet"}'::jsonb
  ),
  (
    'asset.cash_debt_receivable',
    'Deuda de efectivo por cobrar',
    'Comisiones de AXI cobradas en efectivo por conductores y pendientes de recuperación.',
    'asset',
    'platform',
    'MXN',
    'debit',
    'active',
    false,
    '{"group":"receivables","statement":"balance_sheet"}'::jsonb
  ),
  (
    'asset.passenger_wallet_clearing',
    'Compensación wallet pasajeros',
    'Cuenta transitoria para aplicar créditos de pasajeros.',
    'asset',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"clearing","statement":"balance_sheet"}'::jsonb
  ),

  -- PASIVOS
  (
    'liability.driver_payable',
    'Conductores por pagar',
    'Ganancias devengadas por los conductores pendientes de liberación o retiro.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"driver_obligations","statement":"balance_sheet"}'::jsonb
  ),
  (
    'liability.withdrawals_pending',
    'Retiros pendientes',
    'Solicitudes de retiro aprobadas o en proceso.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"driver_obligations","statement":"balance_sheet"}'::jsonb
  ),
  (
    'liability.passenger_wallet',
    'Wallets de pasajeros',
    'Créditos disponibles que AXI adeuda a pasajeros.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"wallet_obligations","statement":"balance_sheet"}'::jsonb
  ),
  (
    'liability.refunds_pending',
    'Reembolsos pendientes',
    'Reembolsos aprobados pendientes de aplicación o pago.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"refund_obligations","statement":"balance_sheet"}'::jsonb
  ),
  (
    'liability.iva_payable',
    'IVA por pagar',
    'IVA trasladado por AXI pendiente de declaración o pago.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"taxes","statement":"balance_sheet","tax":"IVA"}'::jsonb
  ),
  (
    'liability.iva_withheld',
    'IVA retenido por pagar',
    'IVA retenido a conductores pendiente de entero.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"taxes","statement":"balance_sheet","tax":"IVA_RETENIDO"}'::jsonb
  ),
  (
    'liability.isr_withheld',
    'ISR retenido por pagar',
    'ISR retenido a conductores pendiente de entero.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"taxes","statement":"balance_sheet","tax":"ISR_RETENIDO"}'::jsonb
  ),
  (
    'liability.other_payables',
    'Otras cuentas por pagar',
    'Obligaciones de corto plazo no clasificadas en otras cuentas.',
    'liability',
    'platform',
    'MXN',
    'credit',
    'active',
    false,
    '{"group":"other_payables","statement":"balance_sheet"}'::jsonb
  ),

  -- INGRESOS
  (
    'income.platform_commission',
    'Ingresos por comisión AXI',
    'Comisiones generadas por viajes completados.',
    'income',
    'platform',
    'MXN',
    'credit',
    'active',
    true,
    '{"group":"operating_revenue","statement":"profit_loss"}'::jsonb
  ),
  (
    'income.cancellation_fees',
    'Ingresos por cancelaciones',
    'Cargos por cancelación reconocidos como ingreso de AXI.',
    'income',
    'platform',
    'MXN',
    'credit',
    'active',
    true,
    '{"group":"operating_revenue","statement":"profit_loss"}'::jsonb
  ),
  (
    'income.subscriptions',
    'Ingresos por suscripciones',
    'Ingresos por planes, licencias o membresías.',
    'income',
    'platform',
    'MXN',
    'credit',
    'active',
    true,
    '{"group":"operating_revenue","statement":"profit_loss"}'::jsonb
  ),
  (
    'income.other',
    'Otros ingresos',
    'Ingresos no clasificados en otras cuentas.',
    'income',
    'platform',
    'MXN',
    'credit',
    'active',
    true,
    '{"group":"other_revenue","statement":"profit_loss"}'::jsonb
  ),

  -- GASTOS
  (
    'expense.refunds',
    'Gasto por reembolsos',
    'Reembolsos absorbidos económicamente por AXI.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"operating_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.promotions',
    'Promociones y descuentos',
    'Costo de promociones, cupones y descuentos financiados por AXI.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"sales_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.driver_bonuses',
    'Bonos a conductores',
    'Bonos e incentivos pagados a conductores.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"operating_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.support',
    'Soporte y operaciones',
    'Gastos del equipo de soporte y operación.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"operating_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.marketing',
    'Marketing y adquisición',
    'Publicidad, campañas y adquisición de usuarios.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"sales_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.infrastructure',
    'Infraestructura tecnológica',
    'Hosting, bases de datos, mapas, mensajería y servicios tecnológicos.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"technology_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.bank_fees',
    'Comisiones bancarias',
    'Comisiones cobradas por bancos y procesadores de pago.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"financial_expense","statement":"profit_loss"}'::jsonb
  ),
  (
    'expense.other',
    'Otros gastos',
    'Gastos no clasificados en otras cuentas.',
    'expense',
    'platform',
    'MXN',
    'debit',
    'active',
    true,
    '{"group":"other_expense","statement":"profit_loss"}'::jsonb
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  status = excluded.status,
  metadata = coalesce(public.financial_accounts.metadata, '{}'::jsonb)
             || excluded.metadata,
  updated_at = now();

-- ============================================================================
-- 2. LIBRO MAYOR
-- ============================================================================

create or replace view public.finance_general_ledger_v1
with (security_invoker = true)
as
select
  ft.id as transaction_id,
  ft.ledger_folio,
  ft.transaction_type,
  ft.status,
  ft.description as transaction_description,
  ft.effective_at,
  ft.posted_at,
  ft.currency,
  ft.trip_id,
  ft.payment_id,
  ft.refund_id,
  ft.withdrawal_id,

  fle.id as entry_id,
  fle.entry_number,
  fle.direction,
  fle.amount,
  fle.description as entry_description,
  fle.user_id,
  fle.driver_id,
  fle.passenger_id,
  fle.created_at as entry_created_at,

  fa.id as account_id,
  fa.code as account_code,
  fa.name as account_name,
  fa.account_type,
  fa.normal_balance,
  fa.owner_type,

  case
    when fle.direction = 'debit' then fle.amount
    else 0::numeric
  end::numeric(18,2) as debit,

  case
    when fle.direction = 'credit' then fle.amount
    else 0::numeric
  end::numeric(18,2) as credit,

  case
    when fa.normal_balance = 'debit' then
      case
        when fle.direction = 'debit' then fle.amount
        else -fle.amount
      end
    else
      case
        when fle.direction = 'credit' then fle.amount
        else -fle.amount
      end
  end::numeric(18,2) as signed_amount

from public.financial_ledger_entries fle
join public.financial_transactions ft
  on ft.id = fle.transaction_id
join public.financial_accounts fa
  on fa.id = fle.account_id;

-- ============================================================================
-- 3. BALANZA DE COMPROBACIÓN
-- ============================================================================

create or replace view public.finance_trial_balance_v1
with (security_invoker = true)
as
select
  fa.id as account_id,
  fa.code as account_code,
  fa.name as account_name,
  fa.account_type,
  fa.normal_balance,
  fa.currency,
  fa.status,

  coalesce(
    sum(fle.amount) filter (where fle.direction = 'debit'),
    0
  )::numeric(18,2) as total_debits,

  coalesce(
    sum(fle.amount) filter (where fle.direction = 'credit'),
    0
  )::numeric(18,2) as total_credits,

  case
    when fa.normal_balance = 'debit' then
      (
        coalesce(
          sum(fle.amount) filter (where fle.direction = 'debit'),
          0
        )
        -
        coalesce(
          sum(fle.amount) filter (where fle.direction = 'credit'),
          0
        )
      )
    else
      (
        coalesce(
          sum(fle.amount) filter (where fle.direction = 'credit'),
          0
        )
        -
        coalesce(
          sum(fle.amount) filter (where fle.direction = 'debit'),
          0
        )
      )
  end::numeric(18,2) as balance,

  max(ft.effective_at) as last_movement_at

from public.financial_accounts fa
left join public.financial_ledger_entries fle
  on fle.account_id = fa.id
left join public.financial_transactions ft
  on ft.id = fle.transaction_id
 and ft.status = 'posted'
where ft.id is not null
   or not exists (
     select 1
     from public.financial_ledger_entries existing_entry
     where existing_entry.account_id = fa.id
   )
group by
  fa.id,
  fa.code,
  fa.name,
  fa.account_type,
  fa.normal_balance,
  fa.currency,
  fa.status;

-- ============================================================================
-- 4. ESTADO DE RESULTADOS MENSUAL
-- ============================================================================

create or replace view public.finance_profit_loss_v1
with (security_invoker = true)
as
with monthly_accounts as (
  select
    date_trunc(
      'month',
      ft.effective_at at time zone 'America/Mexico_City'
    )::date as period_start,

    fa.account_type,

    sum(
      case
        when fa.normal_balance = 'debit' then
          case
            when fle.direction = 'debit' then fle.amount
            else -fle.amount
          end
        else
          case
            when fle.direction = 'credit' then fle.amount
            else -fle.amount
          end
      end
    ) as amount

  from public.financial_ledger_entries fle
  join public.financial_transactions ft
    on ft.id = fle.transaction_id
  join public.financial_accounts fa
    on fa.id = fle.account_id

  where ft.status = 'posted'
    and fa.account_type in ('income', 'expense')

  group by
    date_trunc(
      'month',
      ft.effective_at at time zone 'America/Mexico_City'
    )::date,
    fa.account_type
)
select
  period_start,
  (period_start + interval '1 month - 1 day')::date as period_end,

  coalesce(
    sum(amount) filter (where account_type = 'income'),
    0
  )::numeric(18,2) as total_income,

  coalesce(
    sum(amount) filter (where account_type = 'expense'),
    0
  )::numeric(18,2) as total_expenses,

  (
    coalesce(
      sum(amount) filter (where account_type = 'income'),
      0
    )
    -
    coalesce(
      sum(amount) filter (where account_type = 'expense'),
      0
    )
  )::numeric(18,2) as net_income,

  case
    when coalesce(
      sum(amount) filter (where account_type = 'income'),
      0
    ) = 0 then 0
    else round(
      (
        (
          coalesce(
            sum(amount) filter (where account_type = 'income'),
            0
          )
          -
          coalesce(
            sum(amount) filter (where account_type = 'expense'),
            0
          )
        )
        /
        nullif(
          coalesce(
            sum(amount) filter (where account_type = 'income'),
            0
          ),
          0
        )
      ) * 100,
      2
    )
  end::numeric(8,2) as net_margin_percentage

from monthly_accounts
group by period_start
order by period_start desc;

-- ============================================================================
-- 5. BALANCE GENERAL
-- El resultado acumulado se presenta como patrimonio derivado.
-- ============================================================================

create or replace view public.finance_balance_sheet_v1
with (security_invoker = true)
as
with balances as (
  select
    fa.account_type,

    sum(
      case
        when fa.normal_balance = 'debit' then
          case
            when fle.direction = 'debit' then fle.amount
            else -fle.amount
          end
        else
          case
            when fle.direction = 'credit' then fle.amount
            else -fle.amount
          end
      end
    ) as balance

  from public.financial_accounts fa
  join public.financial_ledger_entries fle
    on fle.account_id = fa.id
  join public.financial_transactions ft
    on ft.id = fle.transaction_id

  where ft.status = 'posted'

  group by fa.account_type
),
totals as (
  select
    coalesce(
      sum(balance) filter (where account_type = 'asset'),
      0
    ) as total_assets,

    coalesce(
      sum(balance) filter (where account_type = 'liability'),
      0
    ) as total_liabilities,

    coalesce(
      sum(balance) filter (where account_type = 'income'),
      0
    )
    -
    coalesce(
      sum(balance) filter (where account_type = 'expense'),
      0
    ) as retained_result

  from balances
)
select
  current_date as statement_date,

  total_assets::numeric(18,2) as total_assets,

  total_liabilities::numeric(18,2) as total_liabilities,

  retained_result::numeric(18,2) as retained_result,

  (
    total_liabilities + retained_result
  )::numeric(18,2) as total_liabilities_and_equity,

  (
    total_assets
    -
    total_liabilities
    -
    retained_result
  )::numeric(18,2) as accounting_difference,

  (
    round(total_assets, 2)
    =
    round(total_liabilities + retained_result, 2)
  ) as is_balanced

from totals;

-- ============================================================================
-- 6. FLUJO DE EFECTIVO DIARIO
-- Por ahora usa únicamente cuentas de caja y bancos.
-- ============================================================================

create or replace view public.finance_cash_flow_v1
with (security_invoker = true)
as
select
  (
    ft.effective_at at time zone 'America/Mexico_City'
  )::date as finance_date,

  coalesce(
    sum(
      case
        when fle.direction = 'debit' then fle.amount
        else 0
      end
    ),
    0
  )::numeric(18,2) as cash_inflows,

  coalesce(
    sum(
      case
        when fle.direction = 'credit' then fle.amount
        else 0
      end
    ),
    0
  )::numeric(18,2) as cash_outflows,

  coalesce(
    sum(
      case
        when fle.direction = 'debit' then fle.amount
        else -fle.amount
      end
    ),
    0
  )::numeric(18,2) as net_cash_flow

from public.financial_ledger_entries fle
join public.financial_transactions ft
  on ft.id = fle.transaction_id
join public.financial_accounts fa
  on fa.id = fle.account_id

where ft.status = 'posted'
  and fa.code in ('asset.cash', 'asset.bank')

group by
  (
    ft.effective_at at time zone 'America/Mexico_City'
  )::date

order by finance_date desc;

-- ============================================================================
-- 7. RESUMEN FISCAL
-- ============================================================================

create or replace view public.finance_tax_summary_v1
with (security_invoker = true)
as
select
  date_trunc(
    'month',
    paid_at at time zone 'America/Mexico_City'
  )::date as period_start,

  count(*) as paid_payments,

  coalesce(
    sum(tax_base_amount),
    0
  )::numeric(18,2) as tax_base,

  coalesce(
    sum(platform_commission),
    0
  )::numeric(18,2) as platform_commission,

  coalesce(
    sum(platform_commission_iva_amount),
    0
  )::numeric(18,2) as platform_commission_iva,

  coalesce(
    sum(iva_withholding_amount),
    0
  )::numeric(18,2) as iva_withheld,

  coalesce(
    sum(isr_withholding_amount),
    0
  )::numeric(18,2) as isr_withheld,

  (
    coalesce(
      sum(platform_commission_iva_amount),
      0
    )
    -
    coalesce(
      sum(iva_withholding_amount),
      0
    )
  )::numeric(18,2) as estimated_net_iva,

  coalesce(
    sum(driver_earnings),
    0
  )::numeric(18,2) as gross_driver_earnings,

  coalesce(
    sum(driver_net_earnings),
    0
  )::numeric(18,2) as net_driver_earnings

from public.payment_transactions

where status = 'paid'
  and paid_at is not null

group by
  date_trunc(
    'month',
    paid_at at time zone 'America/Mexico_City'
  )::date

order by period_start desc;

-- ============================================================================
-- 8. KPIs EJECUTIVOS
-- ============================================================================

create or replace view public.finance_executive_kpis_v1
with (security_invoker = true)
as
with payment_metrics as (
  select
    count(*) filter (
      where status = 'paid'
    ) as paid_payments,

    coalesce(
      sum(total_amount) filter (
        where status = 'paid'
      ),
      0
    ) as gross_booking_value,

    coalesce(
      sum(platform_commission) filter (
        where status = 'paid'
      ),
      0
    ) as platform_revenue,

    coalesce(
      sum(driver_net_earnings) filter (
        where status = 'paid'
      ),
      0
    ) as driver_net_earnings,

    coalesce(
      avg(total_amount) filter (
        where status = 'paid'
      ),
      0
    ) as average_ticket,

    coalesce(
      sum(platform_commission_iva_amount) filter (
        where status = 'paid'
      ),
      0
    ) as iva_generated,

    coalesce(
      sum(iva_withholding_amount) filter (
        where status = 'paid'
      ),
      0
    ) as iva_withheld,

    coalesce(
      sum(isr_withholding_amount) filter (
        where status = 'paid'
      ),
      0
    ) as isr_withheld

  from public.payment_transactions
),
expense_metrics as (
  select
    coalesce(
      sum(
        case
          when fa.normal_balance = 'debit' then
            case
              when fle.direction = 'debit' then fle.amount
              else -fle.amount
            end
          else
            case
              when fle.direction = 'credit' then fle.amount
              else -fle.amount
            end
        end
      ),
      0
    ) as total_expenses

  from public.financial_accounts fa
  join public.financial_ledger_entries fle
    on fle.account_id = fa.id
  join public.financial_transactions ft
    on ft.id = fle.transaction_id

  where ft.status = 'posted'
    and fa.account_type = 'expense'
),
wallet_metrics as (
  select
    coalesce(sum(available_balance), 0) as available_balance,
    coalesce(sum(pending_balance), 0) as pending_balance,
    coalesce(sum(reserved_balance), 0) as reserved_balance,
    coalesce(sum(cash_debt), 0) as cash_debt
  from public.driver_wallets
)
select
  now() as generated_at,

  payment_metrics.paid_payments,

  payment_metrics.gross_booking_value::numeric(18,2)
    as gross_booking_value,

  payment_metrics.platform_revenue::numeric(18,2)
    as platform_revenue,

  expense_metrics.total_expenses::numeric(18,2)
    as total_expenses,

  (
    payment_metrics.platform_revenue
    -
    expense_metrics.total_expenses
  )::numeric(18,2) as net_operating_result,

  payment_metrics.driver_net_earnings::numeric(18,2)
    as driver_net_earnings,

  payment_metrics.average_ticket::numeric(18,2)
    as average_ticket,

  case
    when payment_metrics.gross_booking_value = 0 then 0
    else round(
      (
        payment_metrics.platform_revenue
        /
        payment_metrics.gross_booking_value
      ) * 100,
      2
    )
  end::numeric(8,2) as take_rate_percentage,

  case
    when payment_metrics.platform_revenue = 0 then 0
    else round(
      (
        (
          payment_metrics.platform_revenue
          -
          expense_metrics.total_expenses
        )
        /
        payment_metrics.platform_revenue
      ) * 100,
      2
    )
  end::numeric(8,2) as operating_margin_percentage,

  payment_metrics.iva_generated::numeric(18,2)
    as iva_generated,

  payment_metrics.iva_withheld::numeric(18,2)
    as iva_withheld,

  payment_metrics.isr_withheld::numeric(18,2)
    as isr_withheld,

  wallet_metrics.available_balance::numeric(18,2)
    as driver_available_balance,

  wallet_metrics.pending_balance::numeric(18,2)
    as driver_pending_balance,

  wallet_metrics.reserved_balance::numeric(18,2)
    as driver_reserved_balance,

  wallet_metrics.cash_debt::numeric(18,2)
    as driver_cash_debt

from payment_metrics
cross join expense_metrics
cross join wallet_metrics;

-- ============================================================================
-- 9. PERMISOS
-- ============================================================================

grant select on public.finance_general_ledger_v1 to authenticated;
grant select on public.finance_trial_balance_v1 to authenticated;
grant select on public.finance_profit_loss_v1 to authenticated;
grant select on public.finance_balance_sheet_v1 to authenticated;
grant select on public.finance_cash_flow_v1 to authenticated;
grant select on public.finance_tax_summary_v1 to authenticated;
grant select on public.finance_executive_kpis_v1 to authenticated;

commit;
