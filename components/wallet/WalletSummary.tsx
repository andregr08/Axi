"use client";

import WalletBalanceCard from "./WalletBalanceCard";

type Props = {
  available: number;
  pending: number;
  reserved: number;
  debt: number;
  lifetime: number;
};

export default function WalletSummary({
  available,
  pending,
  reserved,
  debt,
  lifetime,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <WalletBalanceCard
        title="Saldo disponible"
        amount={available}
      />

      <WalletBalanceCard
        title="Saldo pendiente"
        amount={pending}
      />

      <WalletBalanceCard
        title="Saldo reservado"
        amount={reserved}
      />

      <WalletBalanceCard
        title="Deuda por efectivo"
        amount={debt}
      />

      <WalletBalanceCard
        title="Ganancias históricas"
        amount={lifetime}
      />
    </div>
  );
}
