"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    title: "Resumen",
    items: [
      ["Dashboard financiero", "/dashboard/admin/finance"],
      ["Reportes", "/dashboard/admin/finance/reports"],
    ],
  },
  {
    title: "Contabilidad",
    items: [
      ["Estados financieros", "/dashboard/admin/finance/statements"],
      ["Libro mayor", "/dashboard/admin/finance/general-ledger"],
      ["Cuentas contables", "/dashboard/admin/finance/accounts"],
      ["Cierres diarios", "/dashboard/admin/finance/daily-closures"],
    ],
  },
  {
    title: "Operación",
    items: [
      ["Wallets", "/dashboard/admin/finance/wallets"],
      ["Promociones", "/dashboard/admin/finance/promotions"],
      ["Reembolsos", "/dashboard/admin/finance/refunds"],
      ["Retiros", "/dashboard/admin/finance/withdrawals"],
      ["Deudas en efectivo", "/dashboard/admin/finance/cash-debts"],
      ["Ajustes manuales", "/dashboard/admin/finance/manual-adjustments"],
    ],
  },
  {
    title: "Control",
    items: [
      ["Conciliación", "/dashboard/admin/finance/reconciliation"],
      ["Centro fiscal", "/dashboard/admin/finance/taxes"],
      ["Auditoría", "/dashboard/admin/finance/audit"],
    ],
  },
];

export default function FinanceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
          AXI
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Centro Financiero
        </h2>
      </div>

      <nav className="space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </h3>

            <div className="space-y-1">
              {section.items.map(([label, href]) => {
                const isActive =
                  href === "/dashboard/admin/finance"
                    ? pathname === href
                    : pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      "block rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
