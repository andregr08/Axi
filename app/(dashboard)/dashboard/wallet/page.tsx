"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDownToLine,
  LoaderCircle,
  Wallet,
} from "lucide-react";

import {
  loadWallet,
  requestDriverWithdrawal,
  type DriverWallet,
  type WalletTransaction,
} from "@/lib/wallet";

import WalletSummary from "@/components/wallet/WalletSummary";
import WalletTransactionList from "@/components/wallet/WalletTransactionList";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export default function WalletPage() {
  const [wallet, setWallet] =
    useState<DriverWallet | null>(null);

  const [transactions, setTransactions] =
    useState<WalletTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [showWithdrawalForm, setShowWithdrawalForm] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [clabe, setClabe] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await loadWallet();

      setWallet(data.wallet);
      setTransactions(data.transactions);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la wallet."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const withdrawableBalance = useMemo(() => {
    if (!wallet) return 0;

    return Math.max(
      Number(wallet.available_balance) -
        Number(wallet.cash_debt),
      0
    );
  }, [wallet]);

  async function handleWithdrawal(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!wallet) return;

    const parsedAmount = Number(amount);
    const normalizedClabe = clabe.replace(/\D/g, "");

    setMessage("");
    setErrorMessage("");

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Ingresa un monto válido.");
      return;
    }

    if (parsedAmount > withdrawableBalance) {
      setErrorMessage(
        `Tu saldo máximo retirable es ${moneyFormatter.format(
          withdrawableBalance
        )}.`
      );
      return;
    }

    if (!bankName.trim() || !accountHolder.trim()) {
      setErrorMessage(
        "Ingresa el banco y el nombre del titular."
      );
      return;
    }

    if (normalizedClabe.length !== 18) {
      setErrorMessage(
        "La CLABE debe contener exactamente 18 dígitos."
      );
      return;
    }

    try {
      setSubmitting(true);

      await requestDriverWithdrawal({
        amount: parsedAmount,
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        clabe: normalizedClabe,
      });

      setAmount("");
      setBankName("");
      setAccountHolder("");
      setClabe("");
      setShowWithdrawalForm(false);
      setMessage(
        "Retiro solicitado. El dinero quedó reservado hasta confirmar la transferencia."
      );

      await fetchWallet();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo solicitar el retiro."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <Card className="p-10 text-center">
          <Wallet className="mx-auto mb-4 h-10 w-10 text-gray-400" />

          <h2 className="text-xl font-bold">
            Wallet no disponible
          </h2>

          <p className="mt-3 text-gray-500">
            {errorMessage ||
              "No encontramos información financiera."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Wallet
          </h1>

          <p className="text-gray-500">
            Consulta tus ganancias, deudas y retiros.
          </p>
        </div>

        <Button
          disabled={withdrawableBalance <= 0}
          onClick={() =>
            setShowWithdrawalForm((current) => !current)
          }
        >
          <ArrowDownToLine className="mr-2 h-4 w-4" />
          Solicitar retiro
        </Button>
      </div>

      {message && (
        <Card className="border-green-200 bg-green-50 p-4 text-green-700">
          {message}
        </Card>
      )}

      {errorMessage && (
        <Card className="border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </Card>
      )}

      <WalletSummary
        available={Number(wallet.available_balance)}
        pending={Number(wallet.pending_balance)}
        reserved={Number(wallet.reserved_balance ?? 0)}
        debt={Number(wallet.cash_debt)}
        lifetime={Number(wallet.lifetime_earnings)}
      />

      <Card className="p-5">
        <p className="font-semibold">
          Saldo máximo retirable
        </p>

        <p className="mt-1 text-2xl font-black">
          {moneyFormatter.format(withdrawableBalance)}
        </p>

        <p className="mt-2 text-sm text-gray-500">
          La deuda en efectivo se descuenta automáticamente
          antes de liberar un retiro.
        </p>
      </Card>

      {showWithdrawalForm && (
        <Card className="p-6">
          <form
            className="space-y-5"
            onSubmit={handleWithdrawal}
          >
            <div>
              <h2 className="text-xl font-bold">
                Solicitar transferencia SPEI
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                El monto se moverá de disponible a reservado
                mientras el proveedor procesa el pago.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                <span>Monto</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={withdrawableBalance}
                  required
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 font-normal outline-none focus:border-slate-900"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold">
                <span>Banco</span>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(event) =>
                    setBankName(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 font-normal outline-none focus:border-slate-900"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold">
                <span>Nombre del titular</span>
                <input
                  type="text"
                  required
                  value={accountHolder}
                  onChange={(event) =>
                    setAccountHolder(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 font-normal outline-none focus:border-slate-900"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold">
                <span>CLABE de 18 dígitos</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={18}
                  required
                  value={clabe}
                  onChange={(event) =>
                    setClabe(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 18)
                    )
                  }
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 font-mono font-normal outline-none focus:border-slate-900"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Solicitando..."
                  : "Confirmar solicitud"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() =>
                  setShowWithdrawalForm(false)
                }
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div>
        <h2 className="mb-4 text-xl font-semibold">
          Movimientos recientes
        </h2>

        <WalletTransactionList
          transactions={transactions}
        />
      </div>
    </div>
  );
}
