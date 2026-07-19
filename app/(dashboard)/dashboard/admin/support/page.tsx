"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Headphones,
  HelpCircle,
  Inbox,
  LifeBuoy,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

type TicketFilter =
  | "all"
  | "open"
  | "in-progress"
  | "resolved"
  | "urgent";

export default function AdminSupportPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<TicketFilter>("all");

  const validateAdmin = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (error || profile?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void validateAdmin();
  }, [validateAdmin]);

  function refreshSupport() {
    setRefreshing(true);

    window.setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[2rem] bg-slate-200"
            />
          ))}
        </div>

        <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <Sparkles size={15} />
              {t("adminSupport.hero.badge")}
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              {t("adminSupport.hero.title")}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {t("adminSupport.hero.description")}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Headphones
                  size={18}
                  className="text-yellow-400"
                />
                {t("adminSupport.hero.centralized")}
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ShieldCheck
                  size={18}
                  className="text-emerald-400"
                />
                {t("adminSupport.hero.protected")}
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  {t("adminSupport.hero.ticketSystem")}
                </p>

                <p className="mt-2 text-2xl font-black">
                  {t("adminSupport.hero.ready")}
                </p>
              </div>

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <LifeBuoy size={27} />
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
                    {t("adminSupport.hero.pendingConnection")}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {t("adminSupport.hero.pendingDescription")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("adminSupport.metrics.open.label")}
          value={0}
          description={t("adminSupport.metrics.open.description")}
          icon={Inbox}
          iconClass="bg-blue-100 text-blue-700"
        />

        <MetricCard
          label={t("adminSupport.metrics.inProgress.label")}
          value={0}
          description={t("adminSupport.metrics.inProgress.description")}
          icon={Headphones}
          iconClass="bg-amber-100 text-amber-800"
        />

        <MetricCard
          label={t("adminSupport.metrics.urgent.label")}
          value={0}
          description={t("adminSupport.metrics.urgent.description")}
          icon={AlertTriangle}
          iconClass="bg-red-100 text-red-700"
        />

        <MetricCard
          label={t("adminSupport.metrics.resolved.label")}
          value={0}
          description={t("adminSupport.metrics.resolved.description")}
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {t("adminSupport.inbox.badge")}
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {t("adminSupport.inbox.title")}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Los reportes aparecerán aquí cuando el backend de soporte esté
                conectado.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder={t("adminSupport.search.placeholder")}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5 sm:w-72"
                />
              </div>

              <button
                type="button"
                onClick={refreshSupport}
                disabled={refreshing}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? "animate-spin" : ""}
                />

                {refreshing
                  ? t("adminSupport.actions.refreshing")
                  : t("adminSupport.actions.refresh")}
              </button>
            </div>
          </div>

          <div className="mt-5 flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              ["all", t("adminSupport.filters.all")],
              ["open", t("adminSupport.filters.open")],
              ["in-progress", t("adminSupport.filters.inProgress")],
              ["urgent", t("adminSupport.filters.urgent")],
              ["resolved", t("adminSupport.filters.resolved")],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(value as TicketFilter)
                }
                className={cn(
                  "whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition",
                  filter === value
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-950"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-[480px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

          <div className="relative max-w-lg text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
              <MessageCircle size={35} />
            </span>

            <h3 className="mt-7 text-3xl font-black text-slate-950">
              {t("adminSupport.empty.title")}
            </h3>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              {t("adminSupport.empty.description")}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <SupportCategory
          title={t("adminSupport.categories.trip.title")}
          description={t("adminSupport.categories.trip.description")}
          icon={Zap}
          iconClass="bg-yellow-100 text-yellow-800"
        />

        <SupportCategory
          title={t("adminSupport.categories.account.title")}
          description={t("adminSupport.categories.account.description")}
          icon={LockKeyhole}
          iconClass="bg-blue-100 text-blue-700"
        />

        <SupportCategory
          title={t("adminSupport.categories.payments.title")}
          description={t("adminSupport.categories.payments.description")}
          icon={TicketCheck}
          iconClass="bg-emerald-100 text-emerald-700"
        />
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
  value: number;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            iconClass
          )}
        >
          <Icon size={23} />
        </span>

        <p className="text-4xl font-black">
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

function SupportCategory({
  title,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  const { t } = useLanguage();

  return (
    <Card>
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          iconClass
        )}
      >
        <Icon size={22} />
      </span>

      <h2 className="mt-5 text-lg font-black">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <div className="mt-5 flex items-center gap-2 text-xs font-black text-slate-400">
        <HelpCircle size={15} />
        {t("adminSupport.categories.available")}
      </div>
    </Card>
  );
}


