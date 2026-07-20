"use client";

import { Card } from "@/components/ui/Card";

type Props = {
  title: string;
  amount: number;
};

export default function WalletBalanceCard({
  title,
  amount,
}: Props) {
  return (
    <Card className="p-6">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <h2 className="mt-2 text-3xl font-bold">
        $
        {amount.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
        })}
      </h2>
    </Card>
  );
}
