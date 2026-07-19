"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/lib/supabaseClient";

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
  const { t } = useLanguage();

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
        `${t("adminPromotions.errors.loading")}: ${error.message}`
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
        t("adminPromotions.validation.code")
      );
      return;
    }

    if (cleanName.length < 2) {
      setMessage(
        t("adminPromotions.validation.name")
      );
      return;
    }

    if (
      Number.isNaN(parsedDiscount) ||
      parsedDiscount <= 0
    ) {
      setMessage(
        t("adminPromotions.validation.discount")
      );
      return;
    }

    if (
      discountType === "percentage" &&
      parsedDiscount > 100
    ) {
      setMessage(
        t("adminPromotions.validation.percentage")
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
        t("adminPromotions.validation.maximumDiscount")
      );
      return;
    }

    if (
      Number.isNaN(parsedMinimum) ||
      parsedMinimum < 0
    ) {
      setMessage(
        t("adminPromotions.validation.minimumAmount")
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
        t("adminPromotions.validation.totalLimit")
      );
      return;
    }

    if (
      Number.isNaN(parsedUserLimit) ||
      parsedUserLimit < 1
    ) {
      setMessage(
        t("adminPromotions.validation.userLimit")
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
        `${t("adminPromotions.errors.creating")}: ${error.message}`
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
      t("adminPromotions.messages.created")
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
        ? `${t("adminPromotions.confirm.activate")} ${promotion.code}?`
        : `${t("adminPromotions.confirm.deactivate")} ${promotion.code}?`
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
        `${t("adminPromotions.errors.updating")}: ${error.message}`
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
      return t("adminPromotions.noExpiration");
    }

    return new Date(value).toLocaleString(undefined, {
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
    return <p>{t("adminPromotions.loading")}</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          {t("adminPromotions.eyebrow")}
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          {t("adminPromotions.title")}
        </h1>

        <p className="mt-2 text-gray-600">
          {t("adminPromotions.description")}
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">
            {t("adminPromotions.stats.created")}
          </p>

          <p className="mt-3 text-3xl font-bold">
            {promotions.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            {t("adminPromotions.stats.active")}
          </p>

          <p className="mt-3 text-3xl font-bold">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            {t("adminPromotions.stats.redemptions")}
          </p>

          <p className="mt-3 text-3xl font-bold">
            {totalRedemptions}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl p-4 text-sm ${
            message === t("adminPromotions.messages.created")
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
              {t("adminPromotions.form.title")}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {t("adminPromotions.form.description")}
            </p>
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-semibold"
            >
              {t("adminPromotions.form.code")}
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
              placeholder={t("adminPromotions.form.codePlaceholder")}
              className="w-full rounded-xl border px-4 py-3 uppercase outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-semibold"
            >
              {t("adminPromotions.form.name")}
            </label>

            <input
              id="name"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={120}
              placeholder={t("adminPromotions.form.namePlaceholder")}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-semibold"
            >
              {t("adminPromotions.form.promotionDescription")}
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={3}
              maxLength={500}
              placeholder={t("adminPromotions.form.descriptionPlaceholder")}
              className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="discountType"
              className="mb-2 block text-sm font-semibold"
            >
              {t("adminPromotions.form.discountType")}
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
                {t("adminPromotions.form.percentage")}
              </option>

              <option value="fixed">
                {t("adminPromotions.form.fixed")}
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="discountValue"
              className="mb-2 block text-sm font-semibold"
            >
              {discountType === "percentage"
                ? t("adminPromotions.form.discountPercentage")
                : t("adminPromotions.form.discountAmount")}
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
                  ? t("adminPromotions.form.percentagePlaceholder")
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
                {t("adminPromotions.form.maximumDiscount")}
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
                placeholder={t("adminPromotions.noLimit")}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="minimumAmount"
              className="mb-2 block text-sm font-semibold"
            >
              {t("adminPromotions.form.minimumTripAmount")}
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
                {t("adminPromotions.form.totalUsageLimit")}
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
                placeholder={t("adminPromotions.noLimit")}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="usageLimitPerUser"
                className="mb-2 block text-sm font-semibold"
              >
                {t("adminPromotions.form.userLimit")}
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
              {t("adminPromotions.form.expiration")}
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
              ? t("adminPromotions.form.creating")
              : t("adminPromotions.form.create")}
          </button>
        </form>

        <div>
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              {t("adminPromotions.list.title")}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {t("adminPromotions.list.description")}
            </p>
          </div>

          {promotions.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="font-semibold text-gray-700">
                {t("adminPromotions.list.empty")}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {promotions.map((promotion) => {
                const processing =
                  processingId === promotion.id;

                const usageText =
                  promotion.total_usage_limit === null
                    ? `${promotion.current_usage_count} ${t("adminPromotions.uses")}`
                    : `${promotion.current_usage_count} ${t("adminPromotions.of")} ${promotion.total_usage_limit} ${t("adminPromotions.uses")}`;

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
                              ? t("adminPromotions.status.active")
                              : t("adminPromotions.status.inactive")}
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
                            {t("adminPromotions.details.discount")}:{" "}
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
                            {t("adminPromotions.details.minimumAmount")}:{" "}
                            {formatMoney(
                              promotion.minimum_trip_amount
                            )}
                          </p>

                          <p>
                            {t("adminPromotions.details.maximum")}:{" "}
                            {promotion.maximum_discount ===
                            null
                              ? t("adminPromotions.noLimit")
                              : formatMoney(
                                  promotion.maximum_discount
                                )}
                          </p>

                          <p>
                            {t("adminPromotions.form.userLimit")}:{" "}
                            {
                              promotion.usage_limit_per_user
                            }
                          </p>

                          <p>
                            {t("adminPromotions.details.usage")}: {usageText}
                          </p>

                          <p>
                            {t("adminPromotions.details.expires")}:{" "}
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
                          {t("adminPromotions.redemptions")}
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
                            ? t("adminPromotions.actions.updating")
                            : promotion.active
                              ? t("adminPromotions.actions.deactivate")
                              : t("adminPromotions.actions.activate")}
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
