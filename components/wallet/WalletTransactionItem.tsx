"use client";

import { Card } from "@/components/ui/Card";
import type { WalletTransaction } from "@/lib/wallet";

type Props = {
  transaction: WalletTransaction;
};

export default function WalletTransactionItem({
  transaction,
}: Props) {
  return (
    <Card className="p-4 flex items-center justify-between">

      <div>

        <p className="font-medium">
          {transaction.description ?? transaction.transaction_type}
        </p>

        <p className="text-xs text-gray-500">
          {new Date(transaction.created_at).toLocaleString("es-MX")}
        </p>

      </div>

      <p className="font-bold">
        $
        {transaction.amount.toLocaleString("es-MX", {
          minimumFractionDigits:2,
        })}
      </p>

    </Card>
  );
}
