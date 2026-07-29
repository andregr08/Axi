-- =========================================================
-- AXI FINANCE INTELLIGENCE V1
-- Procesamiento analítico dentro de PostgreSQL
-- =========================================================

drop view if exists public.finance_intelligence_summary_v1;
drop view if exists public.finance_intelligence_daily_v1;

-- ---------------------------------------------------------
-- ANÁLISIS DIARIO
-- ---------------------------------------------------------

create view public.finance_intelligence_daily_v1
with (security_invoker = true)
as
with daily_base as (
  select
    finance_date,
    coalesce(paid_payments, 0)::numeric as paid_payments,
    coalesce(gross_revenue, 0)::numeric as gross_booking_value,
    coalesce(platform_commission, 0)::numeric as platform_revenue,
    coalesce(gross_driver_earnings, 0)::numeric
      as gross_driver_earnings,
    coalesce(net_driver_earnings, 0)::numeric
      as net_driver_earnings,
    coalesce(cash_amount, 0)::numeric as cash_amount,
    coalesce(digital_amount, 0)::numeric as digital_amount
  from public.finance_daily_revenue_v2
),
rolling_metrics as (
  select
    daily_base.*,

    avg(gross_booking_value) over (
      order by finance_date
      rows between 6 preceding and current row
    ) as moving_average_7d,

    avg(gross_booking_value) over (
      order by finance_date
      rows between 29 preceding and current row
    ) as moving_average_30d,

    stddev_pop(gross_booking_value) over (
      order by finance_date
      rows between 29 preceding and current row
    ) as standard_deviation_30d,

    sum(gross_booking_value) over (
      order by finance_date
      rows between 6 preceding and current row
    ) as rolling_gbv_7d,

    sum(platform_revenue) over (
      order by finance_date
      rows between 6 preceding and current row
    ) as rolling_platform_revenue_7d,

    count(*) over (
      order by finance_date
      rows between 29 preceding and current row
    ) as observed_days
  from daily_base
)
select
  finance_date,
  paid_payments,
  round(gross_booking_value, 2) as gross_booking_value,
  round(platform_revenue, 2) as platform_revenue,
  round(gross_driver_earnings, 2) as gross_driver_earnings,
  round(net_driver_earnings, 2) as net_driver_earnings,
  round(cash_amount, 2) as cash_amount,
  round(digital_amount, 2) as digital_amount,

  round(coalesce(moving_average_7d, 0), 2)
    as moving_average_7d,

  round(coalesce(moving_average_30d, 0), 2)
    as moving_average_30d,

  round(coalesce(standard_deviation_30d, 0), 2)
    as standard_deviation_30d,

  round(coalesce(rolling_gbv_7d, 0), 2)
    as rolling_gbv_7d,

  round(coalesce(rolling_platform_revenue_7d, 0), 2)
    as rolling_platform_revenue_7d,

  observed_days,

  case
    when observed_days < 5 then false
    when coalesce(standard_deviation_30d, 0) = 0 then false
    when abs(
      gross_booking_value - moving_average_30d
    ) >= standard_deviation_30d * 1.5 then true
    else false
  end as is_anomaly,

  case
    when observed_days < 5 then 'normal'
    when coalesce(standard_deviation_30d, 0) = 0 then 'normal'
    when gross_booking_value >
      moving_average_30d + standard_deviation_30d * 1.5
      then 'above'
    when gross_booking_value <
      moving_average_30d - standard_deviation_30d * 1.5
      then 'below'
    else 'normal'
  end as anomaly_direction,

  round(
    case
      when coalesce(moving_average_30d, 0) = 0 then 0
      else (
        (
          gross_booking_value - moving_average_30d
        ) / abs(moving_average_30d)
      ) * 100
    end,
    2
  ) as deviation_percentage

from rolling_metrics;

-- ---------------------------------------------------------
-- RESUMEN EJECUTIVO Y PRONÓSTICOS
-- ---------------------------------------------------------

create view public.finance_intelligence_summary_v1
with (security_invoker = true)
as
with ordered_days as (
  select
    finance_date,
    gross_booking_value,
    platform_revenue,
    cash_amount,
    digital_amount,
    row_number() over (
      order by finance_date desc
    ) as reverse_position
  from public.finance_intelligence_daily_v1
  where gross_booking_value > 0
     or paid_payments > 0
),
period_metrics as (
  select
    count(*) filter (
      where reverse_position <= 30
    ) as observed_days,

    avg(gross_booking_value) filter (
      where reverse_position <= 30
    ) as average_daily_gbv,

    avg(platform_revenue) filter (
      where reverse_position <= 30
    ) as average_daily_platform_revenue,

    stddev_pop(gross_booking_value) filter (
      where reverse_position <= 30
    ) as gbv_standard_deviation,

    sum(gross_booking_value) filter (
      where reverse_position between 1 and 7
    ) as recent_7d_gbv,

    sum(gross_booking_value) filter (
      where reverse_position between 8 and 14
    ) as previous_7d_gbv,

    sum(cash_amount) filter (
      where reverse_position <= 30
    ) as cash_amount_30d,

    sum(digital_amount) filter (
      where reverse_position <= 30
    ) as digital_amount_30d

  from ordered_days
),
combined as (
  select
    now() as generated_at,

    coalesce(period_metrics.observed_days, 0)
      as observed_days,

    coalesce(period_metrics.average_daily_gbv, 0)
      as average_daily_gbv,

    coalesce(
      period_metrics.average_daily_platform_revenue,
      0
    ) as average_daily_platform_revenue,

    coalesce(period_metrics.recent_7d_gbv, 0)
      as recent_7d_gbv,

    coalesce(period_metrics.previous_7d_gbv, 0)
      as previous_7d_gbv,

    coalesce(period_metrics.gbv_standard_deviation, 0)
      as gbv_standard_deviation,

    coalesce(period_metrics.cash_amount_30d, 0)
      as cash_amount_30d,

    coalesce(period_metrics.digital_amount_30d, 0)
      as digital_amount_30d,

    coalesce(executive.gross_booking_value, 0)::numeric
      as gross_booking_value,

    coalesce(executive.platform_revenue, 0)::numeric
      as platform_revenue,

    coalesce(executive.total_expenses, 0)::numeric
      as total_expenses,

    coalesce(executive.net_operating_result, 0)::numeric
      as net_operating_result

  from period_metrics
  cross join public.finance_executive_kpis_v1 executive
)
select
  generated_at,
  observed_days,

  round(average_daily_gbv, 2)
    as average_daily_gbv,

  round(average_daily_platform_revenue, 2)
    as average_daily_platform_revenue,

  round(recent_7d_gbv, 2)
    as recent_7d_gbv,

  round(previous_7d_gbv, 2)
    as previous_7d_gbv,

  round(
    case
      when previous_7d_gbv = 0 then
        case
          when recent_7d_gbv > 0 then 100
          else 0
        end
      else (
        (
          recent_7d_gbv - previous_7d_gbv
        ) / abs(previous_7d_gbv)
      ) * 100
    end,
    2
  ) as seven_day_growth_percentage,

  round(average_daily_gbv * 30, 2)
    as projected_gbv_30d,

  round(average_daily_gbv * 60, 2)
    as projected_gbv_60d,

  round(average_daily_gbv * 90, 2)
    as projected_gbv_90d,

  round(average_daily_platform_revenue * 30, 2)
    as projected_platform_revenue_30d,

  round(average_daily_platform_revenue * 60, 2)
    as projected_platform_revenue_60d,

  round(average_daily_platform_revenue * 90, 2)
    as projected_platform_revenue_90d,

  round(
    case
      when platform_revenue = 0 then 0
      else (
        net_operating_result / platform_revenue
      ) * 100
    end,
    2
  ) as operating_margin_percentage,

  round(
    case
      when gross_booking_value = 0 then 0
      else (
        platform_revenue / gross_booking_value
      ) * 100
    end,
    2
  ) as platform_take_rate_percentage,

  round(
    case
      when platform_revenue = 0 then 0
      else (
        total_expenses / platform_revenue
      ) * 100
    end,
    2
  ) as expense_ratio_percentage,

  round(
    case
      when average_daily_gbv = 0 then 0
      else (
        gbv_standard_deviation / average_daily_gbv
      ) * 100
    end,
    2
  ) as volatility_percentage,

  round(
    case
      when cash_amount_30d + digital_amount_30d = 0
        then 0
      else (
        cash_amount_30d /
        (cash_amount_30d + digital_amount_30d)
      ) * 100
    end,
    2
  ) as cash_share_percentage,

  round(
    case
      when cash_amount_30d + digital_amount_30d = 0
        then 0
      else (
        digital_amount_30d /
        (cash_amount_30d + digital_amount_30d)
      ) * 100
    end,
    2
  ) as digital_share_percentage,

  case
    when previous_7d_gbv = 0 and recent_7d_gbv > 0
      then 'growing'
    when previous_7d_gbv = 0
      then 'stable'
    when (
      (
        recent_7d_gbv - previous_7d_gbv
      ) / abs(previous_7d_gbv)
    ) * 100 >= 5
      then 'growing'
    when (
      (
        recent_7d_gbv - previous_7d_gbv
      ) / abs(previous_7d_gbv)
    ) * 100 <= -5
      then 'declining'
    else 'stable'
  end as revenue_trend,

  round(
    average_daily_platform_revenue *
    30 *
    case
      when platform_revenue = 0 then 0
      else net_operating_result / platform_revenue
    end,
    2
  ) as projected_operating_result_30d,

  round(
    average_daily_platform_revenue *
    60 *
    case
      when platform_revenue = 0 then 0
      else net_operating_result / platform_revenue
    end,
    2
  ) as projected_operating_result_60d,

  round(
    average_daily_platform_revenue *
    90 *
    case
      when platform_revenue = 0 then 0
      else net_operating_result / platform_revenue
    end,
    2
  ) as projected_operating_result_90d

from combined;

grant select
on public.finance_intelligence_daily_v1
to authenticated;

grant select
on public.finance_intelligence_summary_v1
to authenticated;

comment on view public.finance_intelligence_daily_v1 is
  'Métricas financieras diarias, medias móviles y anomalías de AXI.';

comment on view public.finance_intelligence_summary_v1 is
  'Resumen ejecutivo, rentabilidad y pronósticos financieros de AXI.';
