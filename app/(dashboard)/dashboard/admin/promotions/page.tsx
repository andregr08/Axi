"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth/roles";

type DiscountType =
  | "percentage"
  | "fixed";

type PromoCode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  maximum_discount: number | null;
  minimum_trip_amount: number;
  total_usage_limit: number | null;
  usage_limit_per_user: number;
  current_usage_count: number;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

export default function AdminPromotionsPage() {
  const router = useRouter();

  const [promotions, setPromotions] =
    useState<PromoCode[]>([]);

  const [code, setCode] =
    useState("");

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [discountType, setDiscountType] =
    useState<DiscountType>("percentage");

  const [discountValue, setDiscountValue] =
    useState("");

  const [maximumDiscount, setMaximumDiscount] =
    useState("");

  const [minimumAmount, setMinimumAmount] =
    useState("0");

  const [totalUsageLimit, setTotalUsageLimit] =
    useState("");

  const [usageLimitPerUser, setUsageLimitPerUser] =
    useState("1");

  const [expiresAt, setExpiresAt] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  async function loadPromotions() {
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
      profile?.role !== "admin"
    ) {
      router.replace("/dashboard");
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("promo_codes")
      .select(`
        id,
        code,
        name,
        description,
        discount_type,
        discount_value,
        maximum_discount,
        minimum_trip_amount,
        total_usage_limit,
        usage_limit_per_user,
        current_usage_count,
        starts_at,
        expires_at,
        active,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      setMessage(
        `Error cargando promociones: ${error.message}`
      );
    } else {
      setPromotions(
        (data ?? []) as PromoCode[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPromotions();
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  async function handleCreatePromotion(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanCode =
      code.trim().toUpperCase();

    const cleanName =
      name.trim();

    const parsedDiscount =
      Number(discountValue);

    const parsedMaximum =
      maximumDiscount.trim()
        ? Number(maximumDiscount)
        : null;

    const parsedMinimum =
      Number(minimumAmount || 0);

    const parsedTotalLimit =
      totalUsageLimit.trim()
        ? Number(totalUsageLimit)
        : null;

    const parsedUserLimit =
      Number(usageLimitPerUser || 1);

    if (cleanCode.length < 2) {
      setMessage(
        "El código debe tener al menos 2 caracteres."
      );
      return;
    }

    if (cleanName.length < 2) {
      setMessage(
        "El nombre debe tener al menos 2 caracteres."
      );
      return;
    }

    if (
      Number.isNaN(parsedDiscount) ||
      parsedDiscount <= 0
    ) {
      setMessage(
        "Escribe un descuento válido."
      );
      return;
    }

    if (
      discountType === "percentage" &&
      parsedDiscount > 100
    ) {
      setMessage(
        "El porcentaje no puede superar 100%."
      );
      return;
    }

    if (
      parsedMaximum !== null &&
      (
        Number.isNaN(parsedMaximum) ||
        parsedMaximum < 0
      )
    ) {
      setMessage(
        "El descuento máximo no es válido."
      );
      return;
    }

    if (
      Number.isNaN(parsedMinimum) ||
      parsedMinimum < 0
    ) {
      setMessage(
        "El monto mínimo no es válido."
      );
      return;
    }

    if (
      parsedTotalLimit !== null &&
      (
        Number.isNaN(parsedTotalLimit) ||
        parsedTotalLimit < 1
      )
    ) {
      setMessage(
        "El límite total debe ser mayor a cero."
      );
      return;
    }

    if (
      Number.isNaN(parsedUserLimit) ||
      parsedUserLimit < 1
    ) {
      setMessage(
        "El límite por usuario debe ser mayor a cero."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("promo_codes")
      .insert({
        code: cleanCode,
        name: cleanName,
        description:
          description.trim() || null,
        discount_type:
          discountType,
        discount_value:
          parsedDiscount,
        maximum_discount:
          parsedMaximum,
        minimum_trip_amount:
          parsedMinimum,
        total_usage_limit:
          parsedTotalLimit,
        usage_limit_per_user:
          parsedUserLimit,
        starts_at:
          new Date().toISOString(),
        expires_at:
          expiresAt
            ? new Date(expiresAt).toISOString()
            : null,
        active: true,
        created_by:
          session.user.id,
      });

    setSaving(false);

    if (error) {
      setMessage(
        `Error creando cupón: ${error.message}`
      );
      return;
    }

    setCode("");
    setName("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMaximumDiscount("");
    setMinimumAmount("0");
    setTotalUsageLimit("");
    setUsageLimitPerUser("1");
    setExpiresAt("");

    setMessage(
      "Cupón creado correctamente."
    );

    await loadPromotions();
  }

  async function togglePromotion(
    promotion: PromoCode
  ) {
    const nextStatus =
      !promotion.active;

    const confirmed = window.confirm(
      nextStatus
        ? `¿Activar el cupón ${promotion.code}?`
        : `¿Desactivar el cupón ${promotion.code}?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(promotion.id);
    setMessage("");

    const { error } = await supabase
      .from("promo_codes")
      .update({
        active: nextStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", promotion.id);

    if (error) {
      setMessage(
        `Error actualizando cupón: ${error.message}`
      );
    } else {
      setPromotions((current) =>
        current.map((item) =>
          item.id === promotion.id
            ? {
                ...item,
                active: nextStatus,
              }
            : item
        )
      );
    }

    setProcessingId(null);
  }

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
      return "Sin vencimiento";
    }

    return new Date(value).toLocaleString(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  const activeCount = promotions.filter(
    (promotion) => promotion.active
  ).length;

  const totalRedemptions =
    promotions.reduce(
      (total, promotion) =>
        total +
        Number(
          promotion.current_usage_count
        ),
      0
    );

  if (loading) {
    return <p>Cargando promociones...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Administración comercial
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Promociones
        </h1>

        <p className="mt-2 text-gray-600">
          Crea cupones, establece límites y controla su uso.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">
            Cupones creados
          </p>

          <p className="mt-3 text-3xl font-bold">
            {promotions.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Cupones activos
          </p>

          <p className="mt-3 text-3xl font-bold">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Canjes totales
          </p>

          <p className="mt-3 text-3xl font-bold">
            {totalRedemptions}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl p-4 text-sm ${
            message.includes("correctamente")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={handleCreatePromotion}
          className="h-fit space-y-5 rounded-2xl bg-white p-7 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-bold">
              Crear cupón
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Configura el descuento y sus condiciones.
            </p>
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-semibold"
            >
              Código
            </label>

            <input
              id="code"
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value.toUpperCase()
                )
              }
              maxLength={40}
              placeholder="Ejemplo: AXI20"
              className="w-full rounded-xl border px-4 py-3 uppercase outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-semibold"
            >
              Nombre de la promoción
            </label>

            <input
              id="name"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={120}
              placeholder="Ejemplo: Bienvenida AXI"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-semibold"
            >
              Descripción
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={3}
              maxLength={500}
              placeholder="Descripción opcional..."
              className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="discountType"
              className="mb-2 block text-sm font-semibold"
            >
              Tipo de descuento
            </label>

            <select
              id="discountType"
              value={discountType}
              onChange={(event) =>
                setDiscountType(
                  event.target.value as DiscountType
                )
              }
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="percentage">
                Porcentaje
              </option>

              <option value="fixed">
                Cantidad fija
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="discountValue"
              className="mb-2 block text-sm font-semibold"
            >
              {discountType === "percentage"
                ? "Porcentaje de descuento"
                : "Cantidad de descuento"}
            </label>

            <input
              id="discountValue"
              type="number"
              min="0.01"
              max={
                discountType === "percentage"
                  ? "100"
                  : undefined
              }
              step="0.01"
              value={discountValue}
              onChange={(event) =>
                setDiscountValue(
                  event.target.value
                )
              }
              placeholder={
                discountType === "percentage"
                  ? "Ejemplo: 20"
                  : "Ejemplo: 50"
              }
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          {discountType === "percentage" && (
            <div>
              <label
                htmlFor="maximumDiscount"
                className="mb-2 block text-sm font-semibold"
              >
                Descuento máximo
              </label>

              <input
                id="maximumDiscount"
                type="number"
                min="0"
                step="0.01"
                value={maximumDiscount}
                onChange={(event) =>
                  setMaximumDiscount(
                    event.target.value
                  )
                }
                placeholder="Sin límite"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="minimumAmount"
              className="mb-2 block text-sm font-semibold"
            >
              Monto mínimo del viaje
            </label>

            <input
              id="minimumAmount"
              type="number"
              min="0"
              step="0.01"
              value={minimumAmount}
              onChange={(event) =>
                setMinimumAmount(
                  event.target.value
                )
              }
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="totalUsageLimit"
                className="mb-2 block text-sm font-semibold"
              >
                Límite total
              </label>

              <input
                id="totalUsageLimit"
                type="number"
                min="1"
                value={totalUsageLimit}
                onChange={(event) =>
                  setTotalUsageLimit(
                    event.target.value
                  )
                }
                placeholder="Sin límite"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="usageLimitPerUser"
                className="mb-2 block text-sm font-semibold"
              >
                Límite por usuario
              </label>

              <input
                id="usageLimitPerUser"
                type="number"
                min="1"
                value={usageLimitPerUser}
                onChange={(event) =>
                  setUsageLimitPerUser(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="expiresAt"
              className="mb-2 block text-sm font-semibold"
            >
              Fecha de vencimiento
            </label>

            <input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) =>
                setExpiresAt(
                  event.target.value
                )
              }
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Creando..."
              : "Crear cupón"}
          </button>
        </form>

        <div>
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Cupones registrados
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Consulta condiciones, usos y disponibilidad.
            </p>
          </div>

          {promotions.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="font-semibold text-gray-700">
                Todavía no existen promociones.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {promotions.map((promotion) => {
                const processing =
                  processingId === promotion.id;

                const usageText =
                  promotion.total_usage_limit === null
                    ? `${promotion.current_usage_count} usos`
                    : `${promotion.current_usage_count} de ${promotion.total_usage_limit} usos`;

                return (
                  <article
                    key={promotion.id}
                    className="rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-6 lg:flex-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-lg bg-black px-3 py-2 font-mono font-bold text-white">
                            {promotion.code}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              promotion.active
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {promotion.active
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </div>

                        <h3 className="mt-4 text-xl font-bold">
                          {promotion.name}
                        </h3>

                        {promotion.description && (
                          <p className="mt-2 text-sm text-gray-600">
                            {promotion.description}
                          </p>
                        )}

                        <div className="mt-5 grid gap-2 text-sm text-gray-500 md:grid-cols-2">
                          <p>
                            Descuento:{" "}
                            {promotion.discount_type ===
                            "percentage"
                              ? `${Number(
                                  promotion.discount_value
                                ).toFixed(2)}%`
                              : formatMoney(
                                  promotion.discount_value
                                )}
                          </p>

                          <p>
                            Monto mínimo:{" "}
                            {formatMoney(
                              promotion.minimum_trip_amount
                            )}
                          </p>

                          <p>
                            Máximo:{" "}
                            {promotion.maximum_discount ===
                            null
                              ? "Sin límite"
                              : formatMoney(
                                  promotion.maximum_discount
                                )}
                          </p>

                          <p>
                            Límite por usuario:{" "}
                            {
                              promotion.usage_limit_per_user
                            }
                          </p>

                          <p>
                            Uso: {usageText}
                          </p>

                          <p>
                            Vence:{" "}
                            {formatDate(
                              promotion.expires_at
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="lg:min-w-44 lg:text-right">
                        <p className="text-3xl font-bold">
                          {
                            promotion.current_usage_count
                          }
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          canjes
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            togglePromotion(
                              promotion
                            )
                          }
                          disabled={processing}
                          className={`mt-5 w-full rounded-xl px-5 py-3 font-semibold disabled:opacity-50 ${
                            promotion.active
                              ? "border border-red-200 text-red-600"
                              : "bg-green-600 text-white"
                          }`}
                        >
                          {processing
                            ? "Actualizando..."
                            : promotion.active
                              ? "Desactivar"
                              : "Activar"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
