"use client";

import Link from "next/link";

const items = [
  ["Resumen", "/dashboard/admin/finance"],
  ["Wallets", "/dashboard/admin/finance/wallets"],
  ["Promociones", "/dashboard/admin/finance/promotions"],
  ["Reembolsos", "/dashboard/admin/finance/refunds"],
  ["Retiros", "/dashboard/admin/finance/withdrawals"],
  ["Deudas en efectivo", "/dashboard/admin/finance/cash-debts"],
  ["Ajustes manuales", "/dashboard/admin/finance/manual-adjustments"],
  ["Auditoría", "/dashboard/admin/finance/audit"],
  [
    "Cierres diarios",
    "/dashboard/admin/finance/daily-closures",
  ],
];

export default function FinanceSidebar() {
  return (
    <aside className="w-72 rounded-xl border bg-white p-4">
      <h2 className="mb-4 text-lg font-bold">
        Centro Financiero
      </h2>

      <nav className="space-y-2">
        {items.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="block rounded-lg px-3 py-2 transition hover:bg-gray-100"
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
