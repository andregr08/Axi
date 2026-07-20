"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  RefreshCw,
  Search,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

import {
  getFinanceAuditLogs,
} from "@/lib/finance/adminQueries";

type AuditLog = {
  id: string;
  event_type: string | null;
  action: string | null;
  admin_id: string | null;
  target_id: string | null;
  amount: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function money(value: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0));
}

export default function FinanceAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadLogs() {
    try {
      setLoading(true);

      const data = await getFinanceAuditLogs();

      setLogs(data as AuditLog[]);
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const value = search.toLowerCase();

    return logs.filter((log) =>
      JSON.stringify(log)
        .toLowerCase()
        .includes(value)
    );
  }, [logs, search]);

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm text-neutral-500">
            Finanzas
          </p>

          <h1 className="text-3xl font-bold">
            Auditoría
          </h1>

        </div>

        <Button
          variant="outline"
          onClick={() => void loadLogs()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>

      </div>

      <Card className="p-6">

        <div className="mb-6 flex items-center gap-2">

          <Search className="h-5 w-5 text-neutral-400" />

          <input
            className="w-full rounded-lg border p-2"
            placeholder="Buscar..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

        <div className="space-y-3">

          {loading ? (
            <div className="flex min-h-52 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <Activity className="mb-3 h-10 w-10 text-neutral-300" />

              <p className="font-semibold text-neutral-900">
                No hay registros
              </p>

              <p className="mt-1 text-sm text-neutral-500">
                No encontramos movimientos que coincidan con la búsqueda.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-neutral-200 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                        {log.event_type || "Evento financiero"}
                      </span>

                      {log.action && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {log.action}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-neutral-600">
                      <p>
                        <span className="font-semibold text-neutral-900">
                          Administrador:
                        </span>{" "}
                        {log.admin_id || "Sistema"}
                      </p>

                      <p>
                        <span className="font-semibold text-neutral-900">
                          Registro afectado:
                        </span>{" "}
                        {log.target_id || "No especificado"}
                      </p>

                      <p>
                        <span className="font-semibold text-neutral-900">
                          Fecha:
                        </span>{" "}
                        {formatDate(log.created_at)}
                      </p>
                    </div>

                    {log.metadata &&
                      Object.keys(log.metadata).length > 0 && (
                        <details className="pt-2">
                          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
                            Ver detalles
                          </summary>

                          <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-100">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                  </div>

                  {log.amount !== null && (
                    <div className="shrink-0 lg:text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Monto
                      </p>

                      <p className="mt-1 text-xl font-bold text-neutral-950">
                        {money(log.amount)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
