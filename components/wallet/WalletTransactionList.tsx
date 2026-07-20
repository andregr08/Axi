"use client";

import type { WalletTransaction } from "@/lib/wallet";

import WalletTransactionItem from "./WalletTransactionItem";
import WalletEmptyState from "./WalletEmptyState";

type Props = {
  transactions: WalletTransaction[];
};

export default function WalletTransactionList({
  transactions,
}: Props) {

  if (!transactions.length) {
    return <WalletEmptyState />;
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <WalletTransactionItem
          key={transaction.id}
          transaction={transaction}
        />
      ))}
    </div>
  );
}
