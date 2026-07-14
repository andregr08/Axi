"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "admin" | "driver" | "passenger";

type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

type PaymentTransaction = {
  id: string;
  trip_id: string;
  passenger_id: string;
  driver_id: string | null;
  method: "cash" | "card" | "mercado_pago";
  status: PaymentStatus;
  subtotal: number;
  booking_fee: number;
  tip_amount: number;
  total_amount: number;
  platform_commission: number;
  driver_earnings: number;
  paid_at: string | null;
  created_at: string;
  trips:
    | {
        origin_address: string;
        destination_address: string;
      }
    | {
        origin_address: string;
        destination_address: string;
      }[]
    | null;
};

const methodLabels = {
  cash: "Efectivo",
  card: "Tarjeta",
  mercado_pago: "Mercado Pago",
};

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

export default function PaymentsPage() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");


  async function loadPayments() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      setMessage("No fue posible cargar tu perfil.");
      setLoading(false);
      return;
    }

    const currentRole = profile.role as UserRole;
    setRole(currentRole);

    let query = supabase
      .from("payment_transactions")
      .select(`
        id,
        trip_id,
        passenger_id,
        driver_id,
        method,
        status,
        subtotal,
        booking_fee,
        tip_amount,
        total_amount,
        platform_commission,
        driver_earnings,
        paid_at,
        created_at,
        trips:trip_id (
          origin_address,
          destination_address
        )
      `)
      .order("created_at", { ascending: false });

    if (currentRole === "passenger") {
      query = query.eq("passenger_id", session.user.id);
    }

    if (currentRole === "driver") {
      query = query.eq("driver_id", session.user.id);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(`Error cargando pagos: ${error.message}`);
    } else {
      setPayments((data ?? []) as PaymentTransaction[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPayments();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function getTrip(payment: PaymentTransaction) {
    return Array.isArray(payment.trips)
      ? payment.trips[0]
      : payment.trips;
  }

  function formatMoney(value: number) {
    return `$${Number(value ?? 0).toFixed(2)} MXN`;
  }

  function formatDate(value: string | null) {
    if (!value) return "Pendiente";

    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const paidPayments = payments.filter(
    (payment) => payment.status === "paid"
  );

  const pendingPayments = payments.filter(
    (payment) =>
      payment.status === "pending" ||
      payment.status === "processing"
  );

  const totalPaid = paidPayments.reduce(
    (total, payment) => total + Number(payment.total_amount),
    0
  );

  const driverTotal = paidPayments.reduce(
    (total, payment) => total + Number(payment.driver_earnings),
    0
  );

  const platformTotal = paidPayments.reduce(
    (total, payment) => total + Number(payment.platform_commission),
    0
  );

  if (loading) {
    return <p>Cargando pagos...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Finanzas
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Pagos
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta las transacciones relacionadas con tus viajes.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Pagos completados
          </p>
          <p className="mt-3 text-3xl font-bold">
            {paidPayments.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Pagos pendientes
          </p>
          <p className="mt-3 text-3xl font-bold">
            {pendingPayments.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            {role === "driver"
              ? "Mis ganancias"
              : role === "admin"
                ? "Comisión AXI"
                : "Total pagado"}
          </p>

          <p className="mt-3 text-3xl font-bold">
            {formatMoney(
              role === "driver"
                ? driverTotal
                : role === "admin"
                  ? platformTotal
                  : totalPaid
            )}
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="space-y-5">
        {payments.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-gray-700">
              No hay pagos registrados
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Las transacciones aparecerán cuando se complete un viaje.
            </p>
          </div>
        ) : (
          payments.map((payment) => {
            const trip = getTrip(payment);

            return (
              <article
                key={payment.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="text-lg font-bold">
                      {trip?.origin_address || "Origen no disponible"}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      hacia{" "}
                      {trip?.destination_address ||
                        "Destino no disponible"}
                    </p>

                    <p className="mt-3 text-sm text-gray-500">
                      Método: {methodLabels[payment.method]}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Estado: {statusLabels[payment.status]}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Fecha:{" "}
                      {formatDate(
                        payment.paid_at ?? payment.created_at
                      )}
                    </p>
                  </div>

                  <div className="lg:text-right">
                    <p className="text-2xl font-bold">
                      {formatMoney(
                        role === "driver"
                          ? payment.driver_earnings
                          : role === "admin"
                            ? payment.platform_commission
                            : payment.total_amount
                      )}
                    </p>

                    {payment.tip_amount > 0 && (
                      <p className="mt-1 text-sm text-green-600">
                        Propina: {formatMoney(payment.tip_amount)}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3 lg:justify-end">
                      {payment.status !== "paid" &&
                        role === "passenger" && (
                          <Link
                            href={`/dashboard/trips/${payment.trip_id}/payment`}
                            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
                          >
                            Completar pago
                          </Link>
                        )}

                      <Link
                        href={`/dashboard/trips/${payment.trip_id}/receipt`}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold"
                      >
                        Ver recibo
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
