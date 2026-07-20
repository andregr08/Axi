"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { markCommissionPaid } from "@/lib/finance/adminActions";
import { getCommissions } from "@/lib/finance/adminQueries";

type Commission = {
  id: string;
  trip_id: string | null;
  driver_id: string;
  full_name: string | null;
  phone: string | null;
  rating: number | null;
  total_trips: number | null;
  account_active: boolean | null;
  trip_amount: number | string;
  commission_rate: number | string;
  commission_amount: number | string;
  status: "pending" | "paid" | "cancelled" | string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0));
}

function date(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CommissionsPage() {
  const [rows, setRows] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCommissions();
      setRows(data as Commission[]);
    } catch (error) {
      console.error("Error cargando comisiones:", error);
      alert("No fue posible cargar las comisiones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => {
      const values = [
        row.full_name,
        row.phone,
        row.status,
        row.trip_id,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    return rows.reduce(
      (result, row) => {
        const amount = Number(row.commission_amount ?? 0);

        result.totalAmount += amount;

        if (row.status === "paid") {
          result.paidCount += 1;
          result.paidAmount += amount;
        } else if (row.status === "pending") {
          result.pendingCount += 1;
          result.pendingAmount += amount;
        }

        return result;
      },
      {
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        paidCount: 0,
        pendingCount: 0,
      }
    );
  }, [rows]);

  async function payCommission(id: string) {
    const confirmed = window.confirm(
      "¿Confirmas que esta comisión ya fue pagada?"
    );

    if (!confirmed) return;

    try {
      setPayingId(id);
      await markCommissionPaid(id);
      await load();
      alert("Comisión marcada como pagada.");
    } catch (error) {
      console.error("Error pagando comisión:", error);
      alert("No fue posible registrar el pago.");
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-neutral-500">Finanzas</p>

          <h1 className="text-3xl font-bold">
            Comisiones
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Consulta y administra las comisiones generadas por los viajes.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Actualizar
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-neutral-500">
            Comisiones totales
          </p>

          <p className="mt-2 text-2xl font-bold">
            {money(summary.totalAmount)}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {rows.length} registros
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-neutral-500">
            Pendientes
          </p>

          <p className="mt-2 text-2xl font-bold text-orange-600">
            {money(summary.pendingAmount)}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {summary.pendingCount} pendientes
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-neutral-500">
            Pagadas
          </p>

          <p className="mt-2 text-2xl font-bold text-green-600">
            {money(summary.paidAmount)}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {summary.paidCount} pagadas
          </p>
        </Card>
      </section>

      <Card className="p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por conductor, teléfono, viaje o estado..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 outline-none transition focus:border-neutral-400"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-neutral-500">
            Cargando comisiones...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <BadgeDollarSign className="mx-auto h-8 w-8 text-neutral-400" />

            <p className="mt-3 font-medium">
              No hay comisiones para mostrar
            </p>

            <p className="mt-1 text-sm text-neutral-500">
              Los registros aparecerán aquí cuando sean generados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">
                    Conductor
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Monto del viaje
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Tasa
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Comisión
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Estado
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Fecha
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const isPaid = row.status === "paid";
                  const isCancelled = row.status === "cancelled";
                  const isPaying = payingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-neutral-100"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold">
                          {row.full_name || "Sin nombre"}
                        </p>

                        <p className="text-xs text-neutral-500">
                          {row.phone || "Sin teléfono"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {money(row.trip_amount)}
                      </td>

                      <td className="px-5 py-4">
                        {Number(row.commission_rate ?? 0)}%
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {money(row.commission_amount)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isPaid
                              ? "bg-green-100 text-green-700"
                              : isCancelled
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {isPaid
                            ? "Pagada"
                            : isCancelled
                              ? "Cancelada"
                              : "Pendiente"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-neutral-500">
                        {date(row.paid_at ?? row.created_at)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {row.status === "pending" ? (
                          <Button
                            size="sm"
                            disabled={isPaying}
                            onClick={() =>
                              void payCommission(row.id)
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />

                            {isPaying
                              ? "Registrando..."
                              : "Marcar pagada"}
                          </Button>
                        ) : (
                          <span className="text-xs text-neutral-400">
                            Sin acciones
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
