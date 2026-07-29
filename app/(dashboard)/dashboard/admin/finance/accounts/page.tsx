"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import EnterpriseReportTable from "@/components/finance/EnterpriseReportTable";
import FinanceReportToolbar from "@/components/finance/FinanceReportToolbar";

import {
  createFinancialFilename,
  exportFinancialCsv,
  formatCurrency,
  formatDateTime,
  getFinancialView,
  normalizeSearchValue,
  sumFinancialColumn,
  type FinancialRow,
} from "@/lib/finance/enterpriseReports";

const accountTypeLabels: Record<string, string> = {
  asset: "Activo",
  liability: "Pasivo",
  equity: "Capital",
  income: "Ingreso",
  expense: "Gasto",
};

export default function FinancialAccountsPage() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      setRows(
        await getFinancialView("finance_trial_balance_v1", {
          orderBy: "account_code",
          ascending: true,
          limit: 5000,
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la balanza.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const normalized = normalizeSearchValue(search);

    return rows.filter((row) => {
      const matchesType = type === "all" || row.account_type === type;

      const matchesSearch =
        !normalized ||
        [row.account_code, row.account_name, row.account_type].some((value) =>
          normalizeSearchValue(value).includes(normalized),
        );

      return matchesType && matchesSearch;
    });
  }, [rows, search, type]);

  const totalDebits = sumFinancialColumn(filteredRows, "total_debits");

  const totalCredits = sumFinancialColumn(filteredRows, "total_credits");

  const difference = totalDebits - totalCredits;

  function handleExport() {
    try {
      exportFinancialCsv({
        filename: createFinancialFilename("balanza-de-comprobacion"),
        rows: filteredRows,
        columns: [
          {
            key: "account_code",
            label: "Código",
          },
          {
            key: "account_name",
            label: "Cuenta",
          },
          {
            key: "account_type",
            label: "Tipo",
            format: (value) =>
              accountTypeLabels[String(value)] ?? String(value ?? ""),
          },
          {
            key: "total_debits",
            label: "Debe",
          },
          {
            key: "total_credits",
            label: "Haber",
          },
          {
            key: "balance",
            label: "Saldo",
          },
          {
            key: "last_movement_at",
            label: "Último movimiento",
            format: formatDateTime,
          },
        ],
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar la balanza.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-blue-600">Contabilidad</p>

        <h1 className="text-2xl font-bold text-slate-900">
          Balanza de comprobación
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Catálogo, cargos, abonos y saldos de las cuentas contables de AXI.
        </p>
      </header>

      <FinanceReportToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código o nombre de cuenta"
        onRefresh={() => void loadData()}
        onExport={handleExport}
        loading={loading}
        exportDisabled={filteredRows.length === 0}
      >
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
        >
          <option value="all">Todas las cuentas</option>
          <option value="asset">Activos</option>
          <option value="liability">Pasivos</option>
          <option value="equity">Capital</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>

        <p className="self-center text-sm text-slate-500">
          {filteredRows.length} cuentas visibles
        </p>
      </FinanceReportToolbar>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cuentas" value={String(filteredRows.length)} />

        <MetricCard label="Total debe" value={formatCurrency(totalDebits)} />

        <MetricCard label="Total haber" value={formatCurrency(totalCredits)} />

        <MetricCard
          label="Diferencia"
          value={formatCurrency(difference)}
          detail={
            Math.abs(difference) < 0.005
              ? "Balanza cuadrada"
              : "Requiere revisión"
          }
          warning={Math.abs(difference) >= 0.005}
        />
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando cuentas…</p>}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <EnterpriseReportTable
          rows={filteredRows}
          emptyMessage="No hay cuentas que coincidan con los filtros."
          columns={[
            {
              key: "account_code",
              label: "Código",
            },
            {
              key: "account_name",
              label: "Cuenta",
            },
            {
              key: "account_type",
              label: "Tipo",
              render: (value) =>
                accountTypeLabels[String(value)] ?? String(value ?? "—"),
            },
            {
              key: "total_debits",
              label: "Debe",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "total_credits",
              label: "Haber",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "balance",
              label: "Saldo",
              align: "right",
              render: formatCurrency,
            },
            {
              key: "last_movement_at",
              label: "Último movimiento",
              render: formatDateTime,
            },
          ]}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5",
        warning ? "border-red-200 bg-red-50" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <p
        className={warning ? "text-sm text-red-700" : "text-sm text-slate-500"}
      >
        {label}
      </p>

      <p
        className={[
          "mt-2 text-2xl font-bold",
          warning ? "text-red-900" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>

      {detail && (
        <p
          className={[
            "mt-1 text-xs",
            warning ? "text-red-700" : "text-slate-500",
          ].join(" ")}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
