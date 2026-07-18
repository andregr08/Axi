import { supabase } from "@/lib/supabaseClient";

export async function approveWithdrawal(id: string) {
  const { data, error } = await supabase.rpc(
    "approve_withdrawal",
    {
      p_request_id: id,
    }
  );

  if (error) throw error;

  return data;
}

export async function rejectWithdrawal(
  id: string,
  reason: string
) {
  const { error } = await supabase.rpc(
    "reject_withdrawal",
    {
      p_request_id: id,
      p_reason: reason,
    }
  );

  if (error) throw error;
}

export async function approveBonus(id: string) {
  const { data, error } = await supabase.rpc(
    "approve_bonus_request",
    {
      p_request_id: id,
    }
  );

  if (error) throw error;

  return data;
}

export async function rejectBonus(
  id: string,
  reason: string
) {
  const { error } = await supabase.rpc(
    "reject_bonus_request",
    {
      p_request_id: id,
      p_reason: reason,
    }
  );

  if (error) throw error;
}

export async function approveIncentive(id: string) {
  const { data, error } = await supabase.rpc(
    "approve_incentive",
    {
      p_incentive_id: id,
    }
  );

  if (error) throw error;

  return data;
}

export async function rejectIncentive(
  id: string,
  reason: string
) {
  const { error } = await supabase.rpc(
    "reject_incentive",
    {
      p_incentive_id: id,
      p_reason: reason,
    }
  );

  if (error) throw error;
}

export async function createManualAdjustment(payload: {
  driver_id: string;
  amount: number;
  balance_type: "available" | "pending";
  adjustment_type: "credit" | "debit";
  reason: string;
}) {
  const { data, error } = await supabase.rpc(
    "create_manual_wallet_adjustment",
    {
      p_driver_id: payload.driver_id,
      p_amount: payload.amount,
      p_balance_type: payload.balance_type,
      p_adjustment_type: payload.adjustment_type,
      p_reason: payload.reason,
    }
  );

  if (error) throw error;

  return data;
}

export async function approveRefund(id: string) {
  const { data, error } = await supabase.rpc(
    "approve_refund",
    {
      refund_id: id,
    }
  );

  if (error) throw error;

  return data;
}

export async function rejectRefund(
  id: string,
  reason: string
) {
  const { error } = await supabase.rpc(
    "reject_refund",
    {
      refund_id: id,
      rejection_reason: reason,
    }
  );

  if (error) throw error;
}


export async function registerCashDebtPayment(payload: {
  driverId: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc(
    "register_cash_debt_payment",
    {
      p_driver_id: payload.driverId,
      p_amount: payload.amount,
      p_payment_method: payload.paymentMethod ?? "cash",
      p_reference: payload.reference ?? null,
      p_notes: payload.notes ?? null,
    }
  );

  if (error) throw error;

  return data;
}
