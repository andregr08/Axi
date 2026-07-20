"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

import {
  createManualAdjustment,
} from "@/lib/finance/adminActions";

import {
  getDrivers,
} from "@/lib/finance/adminQueries";

type Driver = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function ManualAdjustmentsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [driverId, setDriverId] = useState("");

  const [amount, setAmount] = useState("");

  const [balanceType, setBalanceType] = useState<
    "available" | "pending"
  >("available");

  const [adjustmentType, setAdjustmentType] = useState<
    "credit" | "debit"
  >("credit");

  const [reason, setReason] = useState("");

  async function loadDrivers() {
    try {
      setLoading(true);

      const data = await getDrivers();

      setDrivers(data);
    } catch (error) {
      console.error(error);
      alert("No se pudieron cargar los conductores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    const value = search.toLowerCase();

    return drivers.filter((driver) => {
      return (
        driver.full_name
          ?.toLowerCase()
          .includes(value) ||
        driver.email
          ?.toLowerCase()
          .includes(value)
      );
    });
  }, [drivers, search]);

  async function submit() {
    if (!driverId) {
      alert("Selecciona un conductor.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Ingresa un monto válido.");
      return;
    }

    if (!reason.trim()) {
      alert("Escribe un motivo.");
      return;
    }

    const ok = confirm(
      "¿Aplicar este ajuste manual?"
    );

    if (!ok) return;

    try {
      setSaving(true);

      await createManualAdjustment({
        driver_id: driverId,
        amount: Number(amount),
        balance_type: balanceType,
        adjustment_type: adjustmentType,
        reason,
      });

      alert("Ajuste aplicado correctamente.");

      setAmount("");
      setReason("");

    } catch (error) {
      console.error(error);

      alert("No fue posible aplicar el ajuste.");
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
            Ajustes Manuales
          </h1>

        </div>

        <Button
          variant="outline"
          onClick={() => void loadDrivers()}
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
            placeholder="Buscar conductor..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">

          {loading ? (
            <p className="text-center text-neutral-500">
              Cargando conductores...
            </p>
          ) : (
            filteredDrivers.map((driver) => (
              <button
                key={driver.id}
                type="button"
                onClick={() => setDriverId(driver.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  driverId === driver.id
                    ? "border-black bg-neutral-100"
                    : "hover:bg-neutral-50"
                }`}
              >
                <p className="font-semibold">
                  {driver.full_name || "Sin nombre"}
                </p>

                <p className="text-sm text-neutral-500">
                  {driver.email}
                </p>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="space-y-5 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Tipo de ajuste
          </label>

          <select
            value={adjustmentType}
            onChange={(e) =>
              setAdjustmentType(
                e.target.value as
                  | "credit"
                  | "debit"
              )
            }
            className="w-full rounded-lg border p-2"
          >
            <option value="credit">
              Agregar saldo
            </option>

            <option value="debit">
              Descontar saldo
            </option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Balance
          </label>

          <select
            value={balanceType}
            onChange={(e) =>
              setBalanceType(
                e.target.value as
                  | "available"
                  | "pending"
              )
            }
            className="w-full rounded-lg border p-2"
          >
            <option value="available">
              Disponible
            </option>

            <option value="pending">
              Pendiente
            </option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Monto
          </label>

          <input
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value)
            }
            className="w-full rounded-lg border p-2"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Motivo
          </label>

          <textarea
            rows={4}
            value={reason}
            onChange={(e) =>
              setReason(e.target.value)
            }
            className="w-full rounded-lg border p-2"
            placeholder="Describe el motivo..."
          />
        </div>

        <Button
          disabled={saving}
          onClick={() => void submit()}
          className="w-full"
        >
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Aplicando...
            </>
          ) : adjustmentType === "credit" ? (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar saldo
            </>
          ) : (
            <>
              <MinusCircle className="mr-2 h-4 w-4" />
              Descontar saldo
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}
