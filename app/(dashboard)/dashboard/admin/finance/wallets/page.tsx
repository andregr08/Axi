"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  RefreshCw,
  Search,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { getWallets } from "@/lib/finance/adminQueries";

type ProfileData = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type WalletRow = {
  driver_id: string;
  available_balance: number | string | null;
  pending_balance: number | string | null;
  lifetime_earnings: number | string | null;
  total_withdrawn: number | string | null;
  updated_at: string | null;
  profiles?: ProfileData | ProfileData[] | null;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function getProfile(
  profile: ProfileData | ProfileData[] | null | undefined
): ProfileData | null {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile ?? null;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadWallets = useCallback(async (refresh = false) => {
    try {
      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getWallets();
      setWallets((data ?? []) as WalletRow[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las wallets."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const totals = useMemo(() => {
    return wallets.reduce(
      (summary, wallet) => {
        summary.available += Number(wallet.available_balance ?? 0);
        summary.pending += Number(wallet.pending_balance ?? 0);
        summary.earnings += Number(wallet.lifetime_earnings ?? 0);
        return summary;
      },
      {
        available: 0,
        pending: 0,
        earnings: 0,
      }
    );
  }, [wallets]);

  const filteredWallets = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return wallets;

    return wallets.filter((wallet) => {
      const profile = getProfile(wallet.profiles);

      return [
        profile?.full_name,
        profile?.email,
        profile?.role,
        wallet.driver_id,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [search, wallets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Finanzas
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
            Wallets de conductores
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Consulta saldos, ganancias y retiros acumulados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadWallets(true)}
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Actualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Wallets activas"
          value={String(wallets.length)}
          icon={UsersRound}
        />

        <SummaryCard
          title="Saldo disponible"
          value={money(totals.available)}
          icon={WalletCards}
        />

        <SummaryCard
          title="Saldo pendiente"
          value={money(totals.pending)}
          icon={CircleDollarSign}
        />

        <SummaryCard
          title="Ganancias históricas"
          value={money(totals.earnings)}
          icon={CircleDollarSign}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">
              Conductores
            </h2>

            <p className="text-sm text-neutral-500">
              {filteredWallets.length} resultado
              {filteredWallets.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conductor o correo"
              className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              No se pudieron cargar las wallets
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <WalletCards className="mb-3 h-9 w-9 text-neutral-300" />

            <p className="font-semibold text-neutral-800">
              No hay wallets para mostrar
            </p>

            <p className="mt-1 text-sm text-neutral-500">
              Cambia la búsqueda o verifica que existan conductores registrados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <TableHeader>Conductor</TableHeader>
                  <TableHeader>Disponible</TableHeader>
                  <TableHeader>Pendiente</TableHeader>
                  <TableHeader>Ganancias</TableHeader>
                  <TableHeader>Retirado</TableHeader>
                  <TableHeader>Actualización</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {filteredWallets.map((wallet) => {
                  const profile = getProfile(wallet.profiles);

                  return (
                    <tr
                      key={wallet.driver_id}
                      className="transition hover:bg-neutral-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-semibold text-neutral-900">
                          {profile?.full_name || "Conductor sin nombre"}
                        </p>

                        <p className="text-sm text-neutral-500">
                          {profile?.email || wallet.driver_id}
                        </p>
                      </td>

                      <TableValue>
                        <span className="font-semibold text-emerald-700">
                          {money(wallet.available_balance)}
                        </span>
                      </TableValue>

                      <TableValue>
                        {money(wallet.pending_balance)}
                      </TableValue>

                      <TableValue>
                        {money(wallet.lifetime_earnings)}
                      </TableValue>

                      <TableValue>
                        {money(wallet.total_withdrawn)}
                      </TableValue>

                      <TableValue>
                        {wallet.updated_at
                          ? new Intl.DateTimeFormat("es-MX", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(wallet.updated_at))
                          : "Sin fecha"}
                      </TableValue>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type IconComponent = React.ComponentType<{
  className?: string;
}>;

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: IconComponent;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-950">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-100 p-3">
          <Icon className="h-5 w-5 text-neutral-700" />
        </div>
      </div>
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
      {children}
    </th>
  );
}

function TableValue({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="whitespace-nowrap px-5 py-4 text-sm text-neutral-700">
      {children}
    </td>
  );
}
