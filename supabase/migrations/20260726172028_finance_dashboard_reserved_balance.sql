create or replace view public.finance_dashboard_summary as
select
  (
    select count(*)
    from public.driver_wallets
  ) as total_wallets,

  (
    select coalesce(sum(available_balance), 0)
    from public.driver_wallets
  ) as total_available_balance,

  (
    select coalesce(sum(pending_balance), 0)
    from public.driver_wallets
  ) as total_pending_balance,

  (
    select count(*)
    from public.withdraw_requests
    where status in ('pending', 'approved', 'processing')
  ) as pending_withdrawals,

  (
    select coalesce(sum(amount), 0)
    from public.withdraw_requests
    where status in ('pending', 'approved', 'processing')
  ) as pending_withdrawal_amount,

  0::bigint as pending_bonus_requests,
  0::numeric as pending_bonus_amount,
  0::bigint as pending_incentives,
  0::numeric as pending_incentive_amount,

  (
    select coalesce(sum(reserved_balance), 0)
    from public.driver_wallets
  ) as total_reserved_balance;
