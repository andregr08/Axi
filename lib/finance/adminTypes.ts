export type Wallet = {
  driver_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  total_withdrawn: number;
  updated_at: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
};

export type WithdrawalRequest = {
  id: string;
  driver_id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
};

export type BonusRequest = {
  id: string;
  driver_id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
};

export type Incentive = {
  id: string;
  driver_id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
};

export type FinanceTransaction = {
  id: string;
  driver_id: string;
  driver_name: string;
  transaction_type: string;
  balance_type: string;
  amount: number;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  total_withdrawn: number;
};

export type FinanceDashboard = {
  total_wallets: number;
  total_available_balance: number;
  total_pending_balance: number;
  pending_withdrawals: number;
  pending_withdrawal_amount: number;
  pending_bonus_requests: number;
  pending_bonus_amount: number;
  pending_incentives: number;
  pending_incentive_amount: number;
};
