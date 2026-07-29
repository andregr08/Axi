"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EnterpriseMetricCard,
  EnterprisePageHeader,
} from "@/components/enterprise";
import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import FinanceReportToolbar from "@/components/finance/FinanceReportToolbar";

import {
  createFinancialFilename,
  exportFinancialCsv,
  formatCurrency,
  formatDate,
  getFinancialView,
  getMexicoToday,
  getMexicoYearStart,
  sumFinancialColumn,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

export default function FinanceTaxesPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [dateFrom, setDateFrom] = useState(getMexicoYearStart());
  const [dateTo, setDateTo] = useState(getMexicoToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      setRows(
        await getFinancialView("finance_tax_summary_v1", {
          orderBy: "period_start",
          limit: 240,
          filters: [
            {
              column: "period_start",
              operator: "gte",
              value: dateFrom,
            },
            {
              column: "period_start",
              operator: "lte",
              value: dateTo,
            },
          ],
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
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(
    () => ({
      taxBase: sumFinancialColumn(rows, "tax_base"),
      generatedIva: sumFinancialColumn(rows, "platform_commission_iva"),
      retainedIva: sumFinancialColumn(rows, "iva_withheld"),
      retainedIsr: sumFinancialColumn(rows, "isr_withheld"),
      estimatedNetIva: sumFinancialColumn(rows, "estimated_net_iva"),
    }),
    [rows],
  );

  function handleExport() {
    try {
      exportFinancialCsv({
        filename: createFinancialFilename("resumen-fiscal", dateFrom, dateTo),
        rows,
        columns: [
          {
            key: "period_start",
            label: "Periodo",
            format: formatDate,
          },
          {
            key: "tax_base",
            label: "Base fiscal",
          },
          {
            key: "platform_commission",
            label: "Comisión AXI",
          },
          {
            key: "platform_commission_iva",
            label: "IVA generado",
          },
          {
            key: "iva_withheld",
            label: "IVA retenido",
          },
          {
            key: "isr_withheld",
            label: "ISR retenido",
          },
          {
            key: "estimated_net_iva",
            label: "IVA neto estimado",
          },
        ],
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar el resumen fiscal.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        eyebrow="Finanzas"
        title="Centro fiscal"
        description="IVA generado y retenciones calculadas sobre los pagos procesados por AXI."
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Este módulo funciona como control operativo interno. Las declaraciones,
        cálculos definitivos y obligaciones oficiales deben ser revisados por el
        contador de AXI.
      </div>

      <FinanceReportToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onRefresh={() => void loadData()}
        onExport={handleExport}
        loading={loading}
        exportDisabled={rows.length === 0}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <EnterpriseMetricCard
          label="Base fiscal"
          value={formatCurrency(totals.taxBase)}
          tone="info"
        />

        <EnterpriseMetricCard
          label="IVA generado"
          value={formatCurrency(totals.generatedIva)}
          tone="default"
        />

        <EnterpriseMetricCard
          label="IVA retenido"
          value={formatCurrency(totals.retainedIva)}
          tone="warning"
        />

        <EnterpriseMetricCard
          label="ISR retenido"
          value={formatCurrency(totals.retainedIsr)}
          tone="warning"
        />

        <EnterpriseMetricCard
          label="IVA neto estimado"
          value={formatCurrency(totals.estimatedNetIva)}
          tone={
            totals.estimatedNetIva > 0
              ? "danger"
              : totals.estimatedNetIva < 0
                ? "success"
                : "default"
          }
        />
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Cargando impuestos…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <EnterpriseReportTable
          rows={rows}
          emptyMessage="No existen datos fiscales para el periodo seleccionado."
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
