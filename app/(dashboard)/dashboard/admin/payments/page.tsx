"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";

type PaymentTransaction = {
  id: string;
  trip_id: string;
  method: string;
  status: string;
  total_amount: number;
  platform_commission: number;
  driver_earnings: number;
  created_at: string;
};

export default function AdminPaymentsPage() {
  const router = useRouter();

  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPayments() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!isAdmin(profile?.role)) {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("payment_transactions")
      .select(`
        id,
        trip_id,
        method,
        status,
        total_amount,
        platform_commission,
        driver_earnings,
        created_at
      `)
      .order("created_at", { ascending: false });

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

  if (loading) {
    return <p>Cargando pagos...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración financiera
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Transacciones
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta los pagos registrados en AXI.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      {payments.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="font-semibold">
            No hay transacciones registradas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <article
              key={payment.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <p className="font-semibold">
                Método: {payment.method}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Estado: {payment.status}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Total: ${Number(payment.total_amount).toFixed(2)} MXN
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Comisión AXI: $
                {Number(payment.platform_commission).toFixed(2)}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Ganancia conductor: $
                {Number(payment.driver_earnings).toFixed(2)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {new Date(payment.created_at).toLocaleString("es-MX")}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
