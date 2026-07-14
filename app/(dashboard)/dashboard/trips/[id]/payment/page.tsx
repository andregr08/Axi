"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PaymentMethod = "cash" | "card" | "mercado_pago";

type TripPayment = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
  origin_address: string;
  destination_address: string;
  fare_subtotal: number | null;
  booking_fee: number | null;
  final_price: number | null;
  payment_method: PaymentMethod | null;
  payment_status: string;
  tip_amount: number;
  amount_due: number | null;
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mercado_pago: "Mercado Pago",
};

export default function TripPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] = useState<TripPayment | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTrip();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [tripId]);

  async function loadTrip() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("trips")
      .select(`
        id,
        passenger_id,
        driver_id,
        status,
        origin_address,
        destination_address,
        fare_subtotal,
        booking_fee,
        final_price,
        payment_method,
        payment_status,
        tip_amount,
        amount_due
      `)
      .eq("id", tripId)
      .single();

    if (error || !data) {
      setMessage(
        `No fue posible cargar el pago: ${
          error?.message ?? "Viaje no encontrado"
        }`
      );
      setLoading(false);
      return;
    }

    if (data.passenger_id !== session.user.id) {
      setMessage("Solo el pasajero puede configurar el pago.");
      setLoading(false);
      return;
    }

    if (data.status !== "completed") {
      setMessage("El pago estará disponible cuando termine el viaje.");
      setLoading(false);
      return;
    }

    const loadedTrip = data as TripPayment;

    setTrip(loadedTrip);

    if (loadedTrip.payment_method) {
      setMethod(loadedTrip.payment_method);
    }

    if (loadedTrip.tip_amount > 0) {
      setTip(Number(loadedTrip.tip_amount));
    }

    setLoading(false);
  }

  function selectTip(value: number) {
    setTip(value);
    setCustomTip("");
  }

  function handleCustomTip(value: string) {
    setCustomTip(value);

    const parsedValue = Number(value);

    if (value === "" || Number.isNaN(parsedValue) || parsedValue < 0) {
      setTip(0);
      return;
    }

    setTip(parsedValue);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trip) return;

    if (tip < 0 || tip > 10000) {
      setMessage("Escribe una propina válida.");
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas el pago de $${totalAmount.toFixed(2)} MXN mediante ${
        paymentMethodLabels[method]
      }?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("create_trip_payment", {
      requested_trip_id: trip.id,
      selected_method: method,
      selected_tip: tip,
    });

    setSaving(false);

    if (error) {
      setMessage(`Error generando pago: ${error.message}`);
      return;
    }

    if (method === "cash") {
      setMessage("Pago en efectivo registrado correctamente.");

      window.setTimeout(() => {
        router.push(`/dashboard/trips/${trip.id}/receipt`);
        router.refresh();
      }, 1200);

      return;
    }

    setMessage(
      `${paymentMethodLabels[method]} quedó seleccionado. La integración del proveedor se conectará después.`
    );

    await loadTrip();
  }

  const baseAmount = Number(trip?.final_price ?? 0);
  const totalAmount = baseAmount + tip;

  if (loading) {
    return <p>Cargando pago...</p>;
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible abrir el pago."}
        </div>
      </section>
    );
  }

  const paymentCompleted = trip.payment_status === "paid";

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Viaje completado
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Método de pago
        </h1>

        <p className="mt-2 text-gray-600">
          Elige cómo pagar y agrega una propina opcional.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-7 rounded-2xl bg-white p-8 shadow-sm"
      >
        <div className="rounded-xl bg-gray-50 p-5">
          <p className="text-sm text-gray-500">Recorrido</p>

          <p className="mt-2 font-semibold">
            {trip.origin_address}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            hacia {trip.destination_address}
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-bold">
            Método de pago
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["cash", "Efectivo"],
                ["card", "Tarjeta"],
                ["mercado_pago", "Mercado Pago"],
              ] as [PaymentMethod, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`rounded-xl border px-4 py-4 font-semibold transition ${
                  method === value
                    ? "border-black bg-black text-white"
                    : "hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {method !== "cash" && (
            <p className="mt-3 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
              La conexión real con este proveedor se agregará después.
              Por ahora quedará registrado como pago pendiente.
            </p>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-lg font-bold">
            Propina para el conductor
          </h2>

          <div className="grid grid-cols-4 gap-3">
            {[0, 10, 20, 50].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => selectTip(value)}
                className={`rounded-xl border px-3 py-3 font-semibold ${
                  tip === value && customTip === ""
                    ? "border-black bg-black text-white"
                    : "hover:bg-gray-50"
                }`}
              >
                {value === 0 ? "Sin propina" : `$${value}`}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="customTip"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Otra cantidad
            </label>

            <input
              id="customTip"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              value={customTip}
              onChange={(event) =>
                handleCustomTip(event.target.value)
              }
              placeholder="Ejemplo: 35"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border p-5">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Viaje</span>
            <span className="font-semibold">
              ${baseAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Propina</span>
            <span className="font-semibold">
              ${tip.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between gap-4 border-t pt-3 text-xl">
            <span className="font-bold">Total</span>
            <span className="font-bold">
              ${totalAmount.toFixed(2)} MXN
            </span>
          </div>
        </div>

        {paymentCompleted && (
          <div className="rounded-xl bg-green-50 p-4 text-green-700">
            Este viaje ya aparece como pagado.
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-gray-100 p-4 text-sm">
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/trips/${trip.id}`)
            }
            className="flex-1 rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
          >
            Volver
          </button>

          <button
            type="submit"
            disabled={saving || paymentCompleted}
            className="flex-1 rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Procesando..."
              : paymentCompleted
                ? "Pago completado"
                : `Confirmar $${totalAmount.toFixed(2)}`}
          </button>
        </div>
      </form>
    </section>
  );
}
