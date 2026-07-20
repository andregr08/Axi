"use client";

import { Wallet } from "lucide-react";

export default function WalletEmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">

      <Wallet className="mx-auto mb-4 h-10 w-10 text-gray-400" />

      <h3 className="text-lg font-semibold">
        Sin movimientos
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        Tus movimientos aparecerán aquí conforme completes viajes.
      </p>

    </div>
  );
}
