import Link from "next/link";

const reports = [
  {
    title: "Estados financieros",
    description: "Estado de resultados, balance general y flujo de efectivo.",
    href: "/dashboard/admin/finance/statements",
  },
  {
    title: "Libro diario",
    description:
      "Consulta pólizas, asientos, referencias y reversiones contables.",
    href: "/dashboard/admin/finance/journal",
  },
  {
    title: "Libro mayor",
    description: "Consulta cada asiento contable registrado en AXI.",
    href: "/dashboard/admin/finance/general-ledger",
  },
  {
    title: "Balanza de comprobación",
    description: "Saldos, cargos y abonos por cuenta contable.",
    href: "/dashboard/admin/finance/accounts",
  },
  {
    title: "Resumen fiscal",
    description: "IVA, ISR y retenciones agrupadas por periodo.",
    href: "/dashboard/admin/finance/taxes",
  },
  {
    title: "Conciliación",
    description: "Validación entre pagos, ledger y wallets.",
    href: "/dashboard/admin/finance/reconciliation",
  },
  {
    title: "Cierres diarios",
    description: "Snapshots financieros con folio e integridad.",
    href: "/dashboard/admin/finance/daily-closures",
  },
];

export default function FinanceReportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Finanzas</p>
        <h1 className="text-2xl font-bold text-slate-900">
          Centro de reportes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Acceso centralizado a reportes contables, fiscales y operativos.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="font-bold text-slate-900">{report.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {report.description}
            </p>
            <p className="mt-4 text-sm font-semibold text-blue-600">
              Abrir reporte →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
