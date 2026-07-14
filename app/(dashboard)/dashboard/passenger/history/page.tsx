"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PassengerActivity = {
  trip_id: string;
  origin_address: string;
  destination_address: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  final_price: number;
  amount_due: number;
  payment_method: string | null;
  payment_status: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_rating: number | null;
  review_rating: number | null;
  review_comment: string | null;
};

const tripStatusLabels: Record<string, string> = {
  requested: "Solicitado",
  searching: "Buscando conductor",
  accepted: "Aceptado",
  driver_arriving: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mercado_pago: "Mercado Pago",
};

export default function PassengerHistoryPage() {
  const router = useRouter();

  const [activity, setActivity] =
    useState<PassengerActivity[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  async function loadHistory() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (
      profileError ||
      profile?.role !== "passenger"
    ) {
      router.replace("/dashboard");
      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_passenger_activity_history",
      {
        result_limit: 100,
      }
    );

    if (error) {
      setMessage(
        `Error cargando historial: ${error.message}`
      );
    } else {
      setActivity(
        (data ?? []) as PassengerActivity[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  function formatMoney(
    value: number | null
  ) {
    return `$${Number(
      value ?? 0
    ).toFixed(2)} MXN`;
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return "Sin fecha";
    }

    return new Date(value).toLocaleString(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  const completedTrips = activity.filter(
    (item) => item.status === "completed"
  );

  const cancelledTrips = activity.filter(
    (item) => item.status === "cancelled"
  );

  const pendingPayments = activity.filter(
    (item) =>
      item.status === "completed" &&
      item.payment_status !== "paid"
  );

  const totalSpent = completedTrips.reduce(
    (total, item) =>
      total + Number(
        item.amount_due ??
        item.final_price ??
        0
      ),
    0
  );

  if (loading) {
    return <p>Cargando historial...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Cuenta de pasajero
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Historial de viajes
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta tus viajes, pagos, recibos y calificaciones.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-4">
        <div className="rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">
            Total gastado
          </p>

          <p className="mt-3 text-3xl font-bold">
            {formatMoney(totalSpent)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes completados
          </p>

          <p className="mt-3 text-3xl font-bold">
            {completedTrips.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Viajes cancelados
          </p>

          <p className="mt-3 text-3xl font-bold">
            {cancelledTrips.length}
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
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      {activity.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="font-semibold text-gray-700">
            Todavía no tienes viajes registrados.
          </p>

          <Link
            href="/dashboard/trips/new"
            className="mt-5 inline-block rounded-xl bg-black px-5 py-3 font-semibold text-white"
          >
            Solicitar viaje
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {activity.map((item) => {
            const isCompleted =
              item.status === "completed";

            const paymentPending =
              isCompleted &&
              item.payment_status !== "paid";

            return (
              <article
                key={item.trip_id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-6 xl:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">
                        {item.origin_address}
                      </h2>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                        {tripStatusLabels[item.status] ??
                          item.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-500">
                      hacia {item.destination_address}
                    </p>

                    <div className="mt-4 grid gap-2 text-sm text-gray-500">
                      <p>
                        Solicitado:{" "}
                        {formatDate(item.requested_at)}
                      </p>

                      {item.completed_at && (
                        <p>
                          Completado:{" "}
                          {formatDate(item.completed_at)}
                        </p>
                      )}

                      <p>
                        Conductor:{" "}
                        {item.driver_name ||
                          "Sin conductor asignado"}
                      </p>

                      {item.driver_rating !== null && (
                        <p>
                          Calificación del conductor:{" "}
                          {Number(
                            item.driver_rating
                          ).toFixed(2)}{" "}
                          ★
                        </p>
                      )}
                    </div>

                    {item.review_rating !== null && (
                      <div className="mt-5 rounded-xl bg-yellow-50 p-4">
                        <p className="font-semibold text-yellow-800">
                          Tu calificación:{" "}
                          {item.review_rating} de 5 ★
                        </p>

                        <p className="mt-1 text-sm text-yellow-800">
                          {item.review_comment ||
                            "No escribiste comentario."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="xl:min-w-80 xl:text-right">
                    <p className="text-3xl font-bold">
                      {formatMoney(
                        item.amount_due ??
                          item.final_price
                      )}
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                      Método:{" "}
                      {item.payment_method
                        ? paymentMethodLabels[
                            item.payment_method
                          ] ?? item.payment_method
                        : "No seleccionado"}
                    </p>

                    <p
                      className={`mt-1 text-sm font-semibold ${
                        item.payment_status === "paid"
                          ? "text-green-600"
                          : "text-yellow-700"
                      }`}
                    >
                      Pago:{" "}
                      {paymentStatusLabels[
                        item.payment_status
                      ] ?? item.payment_status}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3 xl:justify-end">
                      <Link
                        href={`/dashboard/trips/${item.trip_id}`}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold"
                      >
                        Ver viaje
                      </Link>

                      {paymentPending && (
                        <Link
                          href={`/dashboard/trips/${item.trip_id}/payment`}
                          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
                        >
                          Pagar
                        </Link>
                      )}

                      {isCompleted && (
                        <Link
                          href={`/dashboard/trips/${item.trip_id}/receipt`}
                          className="rounded-lg border px-4 py-2 text-sm font-semibold"
                        >
                          Recibo
                        </Link>
                      )}

                      {isCompleted &&
                        item.driver_id &&
                        item.review_rating === null && (
                          <Link
                            href={`/dashboard/trips/${item.trip_id}/review`}
                            className="rounded-lg border px-4 py-2 text-sm font-semibold"
                          >
                            Calificar
                          </Link>
                        )}

                      {item.driver_id && (
                        <Link
                          href={`/dashboard/trips/${item.trip_id}/report`}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
                        >
                          Reportar
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
