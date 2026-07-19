"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  LockKeyhole,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/hooks/useLanguage";

export default function PaymentsPage() {
  const { t } = useLanguage();

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <Sparkles size={15} />
              {t("payments.finance")}
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              {t("payments.title")}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {t("payments.description")}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ShieldCheck
                  size={18}
                  className="text-yellow-400"
                />
                {t("payments.protectedOperation")}
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ReceiptText
                  size={18}
                  className="text-emerald-400"
                />
                {t("payments.digitalReceipts")}
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  {t("payments.systemStatus")}
                </p>

                <p className="mt-2 text-2xl font-black">
                  {t("payments.ready")}
                </p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <WalletCards size={27} />
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <Clock3
                  size={19}
                  className="mt-0.5 shrink-0 text-yellow-400"
                />

                <div>
                  <p className="text-sm font-black">
                    {t("payments.integrationPending")}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {t("payments.integrationDescription")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("payments.totalPaid")}
          value="$0.00"
          description={t("payments.noPayments")}
          icon={CircleDollarSign}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <MetricCard
          label={t("payments.pendingPayments")}
          value="$0.00"
          description={t("payments.noPendingCharges")}
          icon={Clock3}
          iconClass="bg-amber-100 text-amber-800"
        />

        <MetricCard
          label={t("payments.paymentMethods")}
          value="0"
          description={t("payments.noCards")}
          icon={CreditCard}
          iconClass="bg-blue-100 text-blue-700"
        />

        <MetricCard
          label={t("payments.receipts")}
          value="0"
          description={t("payments.noReceipts")}
          icon={FileText}
          iconClass="bg-violet-100 text-violet-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-5 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {t("payments.movements")}
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {t("payments.paymentHistory")}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {t("payments.historyDescription")}
              </p>
            </div>

            <button
              type="button"
              disabled
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white opacity-50"
            >
              <Plus size={18} />
              {t("payments.addMethod")}
            </button>
          </div>

          <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

            <div className="relative max-w-md text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                <ReceiptText size={35} />
              </span>

              <h3 className="mt-7 text-3xl font-black text-slate-950">
                {t("payments.noMovements")}
              </h3>

              <p className="mt-4 text-sm leading-7 text-slate-500">
                {t("payments.noMovementsDescription")}
              </p>

              <Link
                href="/dashboard/trips"
                className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-black text-black transition hover:bg-yellow-300"
              >
                {t("payments.viewTrips")}
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {t("payments.primaryMethod")}
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {t("payments.noMethodRegistered")}
                </h2>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <CreditCard size={23} />
              </span>
            </div>

            <div className="mt-6 rounded-[1.7rem] bg-[linear-gradient(135deg,#111827,#020617)] p-6 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">
                  AXI Mobility
                </span>

                <Banknote
                  size={22}
                  className="text-yellow-400"
                />
              </div>

              <p className="mt-10 text-lg font-black tracking-[0.22em] text-slate-400">
                •••• •••• •••• ••••
              </p>

              <div className="mt-7 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {t("payments.cardholder")}
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-300">
                    {t("payments.unregistered")}
                  </p>
                </div>

                <p className="text-sm font-black text-yellow-400">
                  AXI
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-400"
            >
              <Plus size={17} />
              {t("payments.comingSoon")}
            </button>
          </Card>

          <Card className="bg-[#0B0F19] text-white">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <LockKeyhole size={22} />
              </span>

              <div>
                <h2 className="text-lg font-black">
                  {t("payments.protectedPayments")}
                </h2>

                <p className="mt-2 text-sm leading-7 text-slate-400">
                  {t("payments.securityDescription")}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <SecurityItem
                label={t("payments.encryptedData")}
              />

              <SecurityItem
                label={t("payments.paymentConfirmation")}
              />

              <SecurityItem
                label={t("payments.receiptPerTrip")}
              />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof CreditCard;
  iconClass: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon size={23} />
        </span>

        <p className="text-3xl font-black">
          {value}
        </p>
      </div>

      <p className="mt-5 font-black">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </Card>
  );
}

function SecurityItem({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400">
        <CheckCircle2 size={16} />
      </span>

      <p className="text-sm font-bold text-slate-300">
        {label}
      </p>
    </div>
  );
}
