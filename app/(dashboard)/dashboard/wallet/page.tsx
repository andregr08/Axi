"use client";

import { useEffect, useState } from "react";

import {
  loadWallet,
  type DriverWallet,
  type WalletTransaction,
} from "@/lib/wallet";

import WalletSummary from "@/components/wallet/WalletSummary";
import WalletTransactionList from "@/components/wallet/WalletTransactionList";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

import {
  LoaderCircle,
  Wallet,
  ArrowDownToLine,
  Banknote,
} from "lucide-react";

export default function WalletPage() {
  const [wallet, setWallet] =
    useState<DriverWallet | null>(null);

  const [transactions, setTransactions] =
    useState<WalletTransaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const data = await loadWallet();

        setWallet(data.wallet);
        setTransactions(data.transactions);
      } finally {
        setLoading(false);
      }
    }

    fetchWallet();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="mx-auto max-w-xl py-16">

        <Card className="p-10 text-center">

          <Wallet className="mx-auto mb-4 h-10 w-10 text-gray-400" />

          <h2 className="text-xl font-bold">
            Wallet no disponible
          </h2>

          <p className="mt-3 text-gray-500">
            No encontramos información financiera.
          </p>

        </Card>

      </div>
    );
  }

  return (
    <div className="space-y-8">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <h1 className="text-3xl font-bold">
            Wallet
          </h1>

          <p className="text-gray-500">
            Administra tus ganancias y movimientos.
          </p>

        </div>

        <div className="flex gap-3">

          <Button disabled>

            <ArrowDownToLine className="mr-2 h-4 w-4" />

            Solicitar retiro

          </Button>

          <Button
            variant="outline"
            disabled
          >

            <Banknote className="mr-2 h-4 w-4" />

            Pagar deuda

          </Button>

        </div>

      </div>

      <WalletSummary
        available={wallet.available_balance}
        pending={wallet.pending_balance}
        debt={wallet.cash_debt}
        lifetime={wallet.lifetime_earnings}
      />

      <div>

        <h2 className="mb-4 text-xl font-semibold">
          Movimientos recientes
        </h2>

        <WalletTransactionList
          transactions={transactions}
        />

      </div>

    </div>
  );
}
