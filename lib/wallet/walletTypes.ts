export type DriverWallet = {
  id: string;
  driver_id: string;

  available_balance: number;
  pending_balance: number;
  cash_debt: number;

  lifetime_earnings: number;
  total_withdrawn: number;

  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: string;

  wallet_id: string;
  driver_id: string;

  trip_id: string | null;
  payment_transaction_id: string | null;

  transaction_type: string;
  balance_type: string | null;

  amount: number;

  balance_before: number;
  balance_after: number;

  description: string | null;

  metadata: Record<string, unknown>;

  created_by: string | null;
  created_at: string;
};

export type WalletSummary = {
  available: number;
  pending: number;
  debt: number;
  lifetime: number;
  withdrawn: number;
};

export type WithdrawalRequest = {
  amount: number;
  destination: string;
};
