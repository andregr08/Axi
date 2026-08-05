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

export async function completeWithdrawalWithSpei(payload: {
  id: string;
  transferProvider: string;
  providerReference: string;
  providerTransferId?: string;
  speiTrackingKey?: string;
  receiptUrl?: string;
  providerPayload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc(
    "complete_withdrawal_with_spei",
    {
      p_request_id: payload.id,
      p_transfer_provider: payload.transferProvider,
      p_provider_reference: payload.providerReference,
      p_provider_transfer_id:
        payload.providerTransferId?.trim() || null,
      p_spei_tracking_key:
        payload.speiTrackingKey?.trim() || null,
      p_receipt_url:
        payload.receiptUrl?.trim() || null,
      p_provider_payload:
        payload.providerPayload ?? {},
    }
  );

  if (error) throw error;

  return data;
}

export async function reconcileWithdrawal(payload: {
  id: string;
  status: "matched" | "mismatch" | "not_required";
  notes?: string;
}) {
  const { data, error } = await supabase.rpc(
    "reconcile_withdrawal",
    {
      p_request_id: payload.id,
      p_reconciliation_status: payload.status,
      p_notes: payload.notes?.trim() || null,
    }
  );

  if (error) throw error;

  return data;
}

export async function failWithdrawal(
  id: string,
  failureReason: string
) {
  const { data, error } = await supabase.rpc(
    "fail_withdrawal",
    {
      p_request_id: id,
      p_failure_reason: failureReason,
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
      p_withdraw_request_id: id,
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

export async function startOriginalPaymentRefund(payload: {
  id: string;
  provider: string;
}) {
  const { data, error } = await supabase.rpc(
    "start_original_payment_refund",
    {
      p_refund_id: payload.id,
      p_provider: payload.provider.trim(),
    }
  );

  if (error) throw error;

  return data;
}

export async function completeOriginalPaymentRefund(payload: {
  id: string;
  providerReference: string;
  providerRefundId: string;
  completedAmount: number;
  providerPayload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc(
    "complete_original_payment_refund",
    {
      p_refund_id: payload.id,
      p_provider_reference:
        payload.providerReference.trim(),
      p_provider_refund_id:
        payload.providerRefundId.trim(),
      p_completed_amount:
        payload.completedAmount,
      p_provider_payload:
        payload.providerPayload ?? {},
    }
  );

  if (error) throw error;

  return data;
}

export async function failOriginalPaymentRefund(payload: {
  id: string;
  failureReason: string;
  providerReference?: string;
  providerPayload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc(
    "fail_original_payment_refund",
    {
      p_refund_id: payload.id,
      p_failure_reason:
        payload.failureReason.trim(),
      p_provider_reference:
        payload.providerReference?.trim() || null,
      p_provider_payload:
        payload.providerPayload ?? {},
    }
  );

  if (error) throw error;

  return data;
}

export async function cancelOriginalPaymentRefund(payload: {
  id: string;
  cancellationReason: string;
}) {
  const { data, error } = await supabase.rpc(
    "cancel_original_payment_refund",
    {
      p_refund_id: payload.id,
      p_cancellation_reason:
        payload.cancellationReason.trim(),
    }
  );

  if (error) throw error;

  return data;
}

export async function reverseOriginalPaymentRefund(payload: {
  id: string;
  reversalReason: string;
}) {
  const { data, error } = await supabase.rpc(
    "reverse_original_payment_refund",
    {
      p_refund_id: payload.id,
      p_reversal_reason:
        payload.reversalReason.trim(),
    }
  );

  if (error) throw error;

  return data;
}

export async function reconcileOriginalPaymentRefund(payload: {
  id: string;
  status: "matched" | "mismatch";
  notes?: string;
}) {
  const { data, error } = await supabase.rpc(
    "reconcile_original_payment_refund",
    {
      p_refund_id: payload.id,
      p_reconciliation_status:
        payload.status,
      p_notes:
        payload.notes?.trim() || null,
    }
  );

  if (error) throw error;

  return data;
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
