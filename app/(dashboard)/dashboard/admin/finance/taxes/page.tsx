"use client";

import { useCallback, useEffect, useState } from "react";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import {
  formatCurrency,
  formatDate,
  getFinancialView,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

export default function FinanceTaxesPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      setRows(
        await getFinancialView("finance_tax_summary_v1", {
          orderBy: "period_start",
          limit: 60,
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar el resumen fiscal.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Finanzas</p>
        <h1 className="text-2xl font-bold text-slate-900">Centro fiscal</h1>
        <p className="mt-1 text-sm text-slate-500">
          IVA generado y retenciones calculadas sobre los pagos.
        </p>
      </header>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Este módulo es un control operativo. La declaración oficial debe ser
        revisada por el contador de AXI.
      </div>

      <button
        type="button"
        onClick={() => void loadData()}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Actualizar
      </button>

      {loading && <p className="text-sm text-slate-500">Cargando impuestos…</p>}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <EnterpriseReportTable
          rows={rows}
          emptyMessage="Todavía no existen pagos fiscales registrados."
          columns={[
            {
              key: "period_start",
              label: "Periodo",
              render: formatDate,
            },
            {
              key: "tax_base",
              label: "Base fiscal",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "platform_commission",
              label: "Comisión AXI",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "platform_commission_iva",
              label: "IVA generado",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "iva_withheld",
              label: "IVA retenido",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "isr_withheld",
              label: "ISR retenido",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "estimated_net_iva",
              label: "IVA neto estimado",
              align: "right",
              render: formatCurrency,
            },
          ]}
        />
      )}
    </div>
  );
}
