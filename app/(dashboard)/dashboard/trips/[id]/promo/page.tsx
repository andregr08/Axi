"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TripPromo = {
  id: string;
  passenger_id: string;
  status: string;
  origin_address: string;
  destination_address: string;
  estimated_price: number | null;
  final_price: number | null;
  amount_due: number | null;
  promo_code: string | null;
  discount_amount: number;
};

type PromoValidation = {
  valid: boolean;
  promo_id: string | null;
  normalized_code: string | null;
  discount_amount: number;
  final_amount: number;
  message: string;
};

export default function TripPromoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] =
    useState<TripPromo | null>(null);

  const [code, setCode] =
    useState("");

  const [validation, setValidation] =
    useState<PromoValidation | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [validating, setValidating] =
    useState(false);

  const [applying, setApplying] =
    useState(false);

  const [message, setMessage] =
    useState("");

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
        status,
        origin_address,
        destination_address,
        estimated_price,
        final_price,
        amount_due,
        promo_code,
        discount_amount
      `)
      .eq("id", tripId)
      .single();

    if (error || !data) {
      setMessage(
        `No fue posible cargar el viaje: ${
          error?.message ??
          "Viaje no encontrado"
        }`
      );

      setLoading(false);
      return;
    }

    if (
      data.passenger_id !==
      session.user.id
    ) {
      setMessage(
        "Solo el pasajero puede aplicar promociones."
      );

      setLoading(false);
      return;
    }

    if (
      ["completed", "cancelled"].includes(
        data.status
      )
    ) {
      setMessage(
        "Ya no puedes aplicar promociones a este viaje."
      );

      setLoading(false);
      return;
    }

    setTrip(data as TripPromo);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTrip();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [tripId]);

  function getBaseAmount() {
    return Number(
      trip?.amount_due ??
      trip?.final_price ??
      trip?.estimated_price ??
      0
    );
  }

  async function validateCode(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanCode =
      code.trim().toUpperCase();

    if (cleanCode.length < 2) {
      setMessage(
        "Escribe un código promocional válido."
      );
      return;
    }

    setValidating(true);
    setMessage("");
    setValidation(null);

    const { data, error } =
      await supabase.rpc(
        "validate_promo_code",
        {
          promo_code_value:
            cleanCode,
          trip_amount_value:
            getBaseAmount(),
        }
      );

    setValidating(false);

    if (error) {
      setMessage(
        `Error validando cupón: ${error.message}`
      );
      return;
    }

    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    setValidation(
      result as PromoValidation
    );

    if (!result?.valid) {
      setMessage(
        result?.message ||
        "El cupón no es válido."
      );
    }
  }

  async function applyCode() {
    if (
      !trip ||
      !validation?.valid
    ) {
      return;
    }

    const confirmed = window.confirm(
      `¿Aplicar el cupón ${validation.normalized_code} y ahorrar $${Number(
        validation.discount_amount
      ).toFixed(2)} MXN?`
    );

    if (!confirmed) {
      return;
    }

    setApplying(true);
    setMessage("");

    const { error } =
      await supabase.rpc(
        "apply_promo_to_trip",
        {
          requested_trip_id:
            trip.id,
          promo_code_value:
            validation.normalized_code,
        }
      );

    setApplying(false);

    if (error) {
      setMessage(
        `Error aplicando cupón: ${error.message}`
      );
      return;
    }

    setMessage(
      "Cupón aplicado correctamente."
    );

    await loadTrip();

    window.setTimeout(() => {
      router.push(
        `/dashboard/trips/${trip.id}`
      );
      router.refresh();
    }, 1000);
  }

  function formatMoney(
    value: number | null
  ) {
    return `$${Number(
      value ?? 0
    ).toFixed(2)} MXN`;
  }

  if (loading) {
    return <p>Cargando promoción...</p>;
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {message || "No fue posible abrir las promociones."}
        </div>
      </section>
    );
  }

  const baseAmount = getBaseAmount();

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Promociones
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Aplicar cupón
        </h1>

        <p className="mt-2 text-gray-600">
          Ingresa un código promocional antes de pagar.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="rounded-xl bg-gray-50 p-5">
          <p className="text-sm text-gray-500">
            Viaje
          </p>

          <p className="mt-2 font-semibold">
            {trip.origin_address}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            hacia {trip.destination_address}
          </p>

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <span className="text-gray-600">
              Precio actual
            </span>

            <span className="text-xl font-bold">
              {formatMoney(baseAmount)}
            </span>
          </div>
        </div>

        {trip.promo_code ? (
          <div className="rounded-xl bg-green-50 p-5 text-green-700">
            <p className="font-semibold">
              Cupón aplicado: {trip.promo_code}
            </p>

            <p className="mt-2">
              Descuento:{" "}
              {formatMoney(trip.discount_amount)}
            </p>
          </div>
        ) : (
          <form
            onSubmit={validateCode}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="promoCode"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Código promocional
              </label>

              <input
                id="promoCode"
                value={code}
                onChange={(event) => {
                  setCode(
                    event.target.value.toUpperCase()
                  );
                  setValidation(null);
                  setMessage("");
                }}
                maxLength={40}
                placeholder="Ejemplo: AXI20"
                className="w-full rounded-xl border px-4 py-3 uppercase outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={
                validating ||
                code.trim().length < 2
              }
              className="w-full rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              {validating
                ? "Validando..."
                : "Validar cupón"}
            </button>
          </form>
        )}

        {validation?.valid && !trip.promo_code && (
          <div className="rounded-xl bg-green-50 p-5">
            <p className="font-semibold text-green-700">
              {validation.message}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between gap-4">
                <span className="text-green-700">
                  Precio original
                </span>

                <span className="font-semibold text-green-700">
                  {formatMoney(baseAmount)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-green-700">
                  Descuento
                </span>

                <span className="font-semibold text-green-700">
                  -
                  {formatMoney(
                    validation.discount_amount
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-green-200 pt-3 text-xl">
                <span className="font-bold text-green-800">
                  Nuevo total
                </span>

                <span className="font-bold text-green-800">
                  {formatMoney(
                    validation.final_amount
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={applyCode}
              disabled={applying}
              className="mt-5 w-full rounded-xl bg-green-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {applying
                ? "Aplicando..."
                : "Aplicar cupón"}
            </button>
          </div>
        )}

        {message && (
          <div
            className={`rounded-xl p-4 text-sm ${
              message.includes("correctamente")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/trips/${trip.id}`
              )
            }
            className="flex-1 rounded-xl border px-5 py-3 font-semibold hover:bg-gray-50"
          >
            Volver al viaje
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/trips/${trip.id}/payment`
              )
            }
            className="flex-1 rounded-xl bg-black px-5 py-3 font-semibold text-white"
          >
            Ir al pago
          </button>
        </div>
      </div>
    </section>
  );
}
