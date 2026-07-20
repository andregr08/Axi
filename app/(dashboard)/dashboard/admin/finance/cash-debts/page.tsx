"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  RefreshCw,
  Search,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

import {
  getCashDebts,
} from "@/lib/finance/adminQueries";

import {
  registerCashDebtPayment,
} from "@/lib/finance/adminActions";

type CashDebtRow = {
  driver_id: string;
  full_name: string | null;
  phone: string | null;
  rating: number | null;
  wallet_id: string;
  available_balance: number;
  pending_balance: number;
  cash_debt: number;
  lifetime_earnings: number;
  total_withdrawn: number;
  wallet_updated_at: string | null;
  last_payment_at: string | null;
  total_paid: number;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0));
}

export default function CashDebtsPage() {
  const [rows, setRows] = useState<CashDebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [driverId, setDriverId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getCashDebts();

      setRows(data as CashDebtRow[]);
    } catch (error) {
      console.error(error);
      alert("No fue posible cargar las deudas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const value = search.toLowerCase();

    return rows.filter((row) =>
      (row.full_name ?? "")
        .toLowerCase()
        .includes(value)
    );
  }, [rows, search]);

  async function submit() {
    if (!driverId) {
      alert("Selecciona un conductor.");
      return;
    }

    if (Number(amount) <= 0) {
      alert("Monto inválido.");
      return;
    }

    try {
      setSaving(true);

      await registerCashDebtPayment({
        driverId,
        amount: Number(amount),
        paymentMethod: "cash",
        reference,
        notes,
      });

      alert("Pago registrado.");

      setAmount("");
      setReference("");
      setNotes("");
      setDriverId("");

      await load();
    } catch (error) {
      console.error(error);
      alert("No fue posible registrar el pago.");
    } finally {
      setSaving(false);
    }

  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm text-neutral-500">
            Finanzas
          </p>

          <h1 className="text-3xl font-bold">
            Deudas en efectivo
          </h1>

          <p className="text-sm text-neutral-500">
            Administra los pagos de efectivo de los conductores.
          </p>

        </div>

        <Button
          variant="outline"
          onClick={() => void load()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>

      </div>

      <Card className="p-5">

        <div className="relative">

          <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conductor..."
            className="w-full rounded-xl border pl-10 pr-4 py-2"
          />

        </div>

      </Card>

      <Card className="overflow-hidden">

        {loading ? (

          <div className="p-10 text-center">
            Cargando...
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead className="bg-neutral-50">

                <tr>

                  <th className="px-5 py-3 text-left">
                    Conductor
                  </th>

                  <th className="px-5 py-3 text-left">
                    Disponible
                  </th>

                  <th className="px-5 py-3 text-left">
                    Deuda
                  </th>

                  <th className="px-5 py-3 text-left">
                    Total pagado
                  </th>

                  <th className="px-5 py-3 text-left">
                    Acción
                  </th>

                </tr>

              </thead>

              <tbody>

                {filtered.map((row) => (

                  <tr
                    key={row.driver_id}
                    className="border-t"
                  >

                    <td className="px-5 py-4">

                      <p className="font-semibold">
                        {row.full_name}
                      </p>

                      <p className="text-sm text-neutral-500">
                        {row.phone}
                      </p>

                    </td>

                    <td className="px-5 py-4 font-semibold text-green-700">
                      {money(row.available_balance)}
                    </td>

                    <td className="px-5 py-4 font-semibold text-red-600">
                      {money(row.cash_debt)}
                    </td>

                    <td className="px-5 py-4">
                      {money(row.total_paid)}
                    </td>

                    <td className="px-5 py-4">

                      <Button
                        size="sm"
                        onClick={() =>
                          setDriverId(row.driver_id)
                        }
                      >
                        Seleccionar
                      </Button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </Card>

      <Card className="p-6">

        <div className="mb-5 flex items-center gap-3">

          <div className="rounded-xl bg-neutral-100 p-3">
            <CircleDollarSign className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              Registrar pago de deuda
            </h2>

            <p className="text-sm text-neutral-500">
              Selecciona un conductor y registra el efectivo entregado.
            </p>
          </div>

        </div>

        <div className="grid gap-4 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm font-medium">
              Conductor
            </label>

            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5"
            >
              <option value="">
                Selecciona un conductor
              </option>

              {rows.map((row) => (
                <option
                  key={row.driver_id}
                  value={row.driver_id}
                >
                  {row.full_name || "Sin nombre"} — deuda {money(row.cash_debt)}
                </option>
              ))}
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm font-medium">
              Monto pagado
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border px-4 py-2.5"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm font-medium">
              Referencia
            </label>

            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Folio, recibo o referencia"
              className="w-full rounded-xl border px-4 py-2.5"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm font-medium">
              Notas
            </label>

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales"
              className="w-full rounded-xl border px-4 py-2.5"
            />

          </div>

        </div>

        <div className="mt-5 flex justify-end">

          <Button
            onClick={() => void submit()}
            disabled={saving}
          >
            <CircleDollarSign className="mr-2 h-4 w-4" />
            {saving ? "Registrando..." : "Registrar pago"}
          </Button>

        </div>

      </Card>

    </div>
  );
}
