import { Card } from "@/components/ui/Card";
import type { WalletTransaction } from "@/lib/wallet";

type Props = {
  transaction: WalletTransaction;
};

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const transactionLabels: Record<string, string> = {
  driver_cancellation_fee: "Cargo por cancelación",
  cash_trip_commission: "Comisión AXI por viaje en efectivo",
  digital_earning_pending: "Ganancia digital pendiente",
  digital_earning_reopened: "Ganancia digital reabierta",
  digital_earning_released: "Ganancia digital confirmada",
  digital_earning_available: "Ganancia disponible",
  digital_earning_reversed: "Ganancia digital cancelada",
  automatic_cash_debt_offset: "Deuda descontada automáticamente",
  automatic_debt_offset_before_withdrawal:
    "Descuento de deuda antes del retiro",
  automatic_debt_payment_before_withdrawal:
    "Pago automático de deuda",
  withdrawal_reserved: "Saldo reservado para retiro",
  withdrawal_paid: "Retiro transferido",
  withdrawal_failed: "Transferencia fallida",
  withdrawal_rejected: "Retiro rechazado",
  withdrawal_returned: "Saldo devuelto",
};

const balanceLabels: Record<string, string> = {
  available: "Disponible",
  pending: "Pendiente",
  reserved: "Reservado",
  cash_debt: "Deuda en efectivo",
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export default function WalletTransactionItem({
  transaction,
}: Props) {
  const amount = toNumber(transaction.amount);
  const balanceBefore = toNumber(transaction.balance_before);
  const balanceAfter = toNumber(transaction.balance_after);

  const title =
    transaction.description?.trim() ||
    transactionLabels[transaction.transaction_type] ||
    transaction.transaction_type;

  const balanceLabel =
    balanceLabels[transaction.balance_type ?? ""] ||
    transaction.balance_type ||
    "Saldo";

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-slate-900">
          {title}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {balanceLabel}
          </span>

          <span className="text-xs text-gray-500">
            {new Date(transaction.created_at).toLocaleString(
              "es-MX",
            )}
          </span>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Saldo: {moneyFormatter.format(balanceBefore)}
          {" → "}
          {moneyFormatter.format(balanceAfter)}
        </p>
      </div>

      <p className="text-lg font-black text-slate-900">
        {amount > 0 ? "+" : ""}
        {moneyFormatter.format(amount)}
      </p>
    </Card>
  );
}
