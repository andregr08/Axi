"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import {
  getJournalAccount,
  getJournalTransactionDetail,
  reverseJournalTransaction,
  type JournalTransactionDetail,
} from "@/lib/finance/journal";

function money(value: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Identifier({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-xs text-slate-700">{value}</p>
    </div>
  );
}

export default function FinanceTransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const transactionId = params.id;

  const [detail, setDetail] = useState<JournalTransactionDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getJournalTransactionDetail(transactionId);

      setDetail(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la póliza.",
      );
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const entries = detail?.entries ?? [];

    return entries.reduce(
      (result, entry) => {
        if (entry.direction === "debit") {
          result.debits += Number(entry.amount);
        } else {
          result.credits += Number(entry.amount);
        }

        return result;
      },
      { debits: 0, credits: 0 },
    );
  }, [detail]);

  const balanced = Math.abs(totals.debits - totals.credits) < 0.005;

  async function handleReverse() {
    if (!detail) {
      return;
    }

    const reason = window
      .prompt(
        "Escribe el motivo contable de la reversión. Este movimiento quedará registrado permanentemente:",
      )
      ?.trim();

    if (!reason) {
      return;
    }

    const confirmed = window.confirm(
      [
        "¿Confirmas la reversión de esta póliza?",
        "",
        `Folio: ${detail.transaction.ledger_folio ?? "Sin folio"}`,
        `Motivo: ${reason}`,
        "",
        "La póliza original no se eliminará. Se creará una póliza inversa.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    try {
      setReversing(true);
      setError("");
      setMessage("");

      const reversalId = await reverseJournalTransaction(
        detail.transaction.id,
        reason,
      );

      setMessage(
        "La póliza se revirtió correctamente. Abriendo la póliza de reversión.",
      );

      router.push(`/dashboard/admin/finance/transactions/${reversalId}`);
    } catch (reverseError) {
      setError(
        reverseError instanceof Error
          ? reverseError.message
          : "No fue posible revertir la póliza.",
      );
    } finally {
      setReversing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/admin/finance/journal"
          className="inline-flex items-center text-sm font-semibold text-blue-600"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Regresar al libro diario
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { transaction, entries, reversal, original } = detail;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/dashboard/admin/finance/journal"
            className="inline-flex items-center text-sm font-semibold text-blue-600"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Libro diario
          </Link>

          <p className="mt-5 text-sm font-medium text-blue-600">
            Póliza contable
          </p>

          <h1 className="mt-1 font-mono text-2xl font-bold text-slate-900">
            {transaction.ledger_folio ?? "Sin folio"}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {transaction.description ?? "Sin descripción"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </button>

          {transaction.status === "posted" &&
            !reversal &&
            !transaction.reversal_of_transaction_id && (
              <button
                type="button"
                onClick={() => void handleReverse()}
                disabled={reversing}
                className="inline-flex items-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <RotateCcw
                  className={`mr-2 h-4 w-4 ${reversing ? "animate-spin" : ""}`}
                />
                Revertir póliza
              </button>
            )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {reversal && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <p className="font-semibold text-red-900">
                Esta póliza fue revertida
              </p>
              <p className="mt-1 text-sm text-red-700">
                La operación permanece visible por trazabilidad.
              </p>

              <Link
                href={`/dashboard/admin/finance/transactions/${reversal.id}`}
                className="mt-3 inline-block text-sm font-semibold text-red-800 underline"
              >
                Abrir póliza de reversión {reversal.ledger_folio ?? ""}
              </Link>
            </div>
          </div>
        </div>
      )}

      {original && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="font-semibold text-blue-900">
            Esta es una póliza de reversión
          </p>

          <Link
            href={`/dashboard/admin/finance/transactions/${original.id}`}
            className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
          >
            Abrir póliza original {original.ledger_folio ?? ""}
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Estado</p>
          <p className="mt-2 text-xl font-bold capitalize text-slate-900">
            {transaction.status}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Tipo</p>
          <p className="mt-2 break-words text-lg font-bold text-slate-900">
            {transaction.transaction_type}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Debe</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {money(totals.debits, transaction.currency)}
          </p>
        </div>

        <div
          className={[
            "rounded-2xl border p-5",
            balanced
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          <p className={balanced ? "text-emerald-700" : "text-red-700"}>
            Haber
          </p>

          <p
            className={[
              "mt-2 text-xl font-bold",
              balanced ? "text-emerald-900" : "text-red-900",
            ].join(" ")}
          >
            {money(totals.credits, transaction.currency)}
          </p>

          <p
            className={[
              "mt-1 text-xs font-semibold",
              balanced ? "text-emerald-700" : "text-red-700",
            ].join(" ")}
          >
            {balanced ? "Póliza balanceada" : "Requiere revisión"}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-bold text-slate-900">Asientos contables</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cargos y abonos de la póliza.
            </p>
          </div>

          {balanced && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Cuenta
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Debe
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Haber
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const account = getJournalAccount(entry);

                return (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-slate-500">
                      {entry.entry_number}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-slate-900">
                        {account.code}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {account.name}
                      </p>
                    </td>

                    <td className="max-w-md px-4 py-3 text-slate-600">
                      {entry.description ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800">
                      {entry.direction === "debit"
                        ? money(Number(entry.amount), entry.currency)
                        : "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800">
                      {entry.direction === "credit"
                        ? money(Number(entry.amount), entry.currency)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-4 text-right font-bold text-slate-900"
                >
                  Totales
                </td>

                <td className="px-4 py-4 text-right font-bold text-slate-900">
                  {money(totals.debits, transaction.currency)}
                </td>

                <td className="px-4 py-4 text-right font-bold text-slate-900">
                  {money(totals.credits, transaction.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">Trazabilidad</h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Identifier label="Transacción" value={transaction.id} />
          <Identifier label="Viaje" value={transaction.trip_id} />
          <Identifier label="Pago" value={transaction.payment_id} />
          <Identifier label="Reembolso" value={transaction.refund_id} />
          <Identifier label="Retiro" value={transaction.withdrawal_id} />
          <Identifier
            label="Wallet conductor"
            value={transaction.wallet_transaction_id}
          />
          <Identifier
            label="Wallet pasajero"
            value={transaction.passenger_wallet_transaction_id}
          />
          <Identifier
            label="Referencia proveedor"
            value={transaction.provider_reference}
          />
          <Identifier
            label="Llave de idempotencia"
            value={transaction.idempotency_key}
          />
          <Identifier label="Creada por" value={transaction.created_by} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fecha efectiva
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {dateTime(transaction.effective_at)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Publicada
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {dateTime(transaction.posted_at)}
            </p>
          </div>
        </div>

        {Object.keys(transaction.metadata ?? {}).length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Ver metadatos técnicos
            </summary>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(transaction.metadata, null, 2)}
            </pre>
          </details>
        )}
      </section>
    </div>
  );
}
