"use client";

import Link from "next/link";
import {
  ArrowRight,
  CarFront,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface HeroProps {
  name?: string;
  role?: "admin" | "driver" | "passenger";
}

type HeroRole =
  | "admin"
  | "driver"
  | "passenger";

type HeroContent = {
  eyebrowKey: string;
  titleKey: string;
  descriptionKey: string;
  primaryLabelKey: string;
  primaryHref: string;
  secondaryLabelKey: string;
  secondaryHref: string;
};

const content: Record<
  HeroRole,
  HeroContent
> = {
  admin: {
    eyebrowKey: "hero.admin.eyebrow",
    titleKey: "hero.admin.title",
    descriptionKey:
      "hero.admin.description",
    primaryLabelKey:
      "hero.admin.primaryLabel",
    primaryHref: "/dashboard/trips",
    secondaryLabelKey:
      "hero.admin.secondaryLabel",
    secondaryHref: "/dashboard/vehicles",
  },

  driver: {
    eyebrowKey: "hero.driver.eyebrow",
    titleKey: "hero.driver.title",
    descriptionKey:
      "hero.driver.description",
    primaryLabelKey:
      "hero.driver.primaryLabel",
    primaryHref: "/dashboard/trips",
    secondaryLabelKey:
      "hero.driver.secondaryLabel",
    secondaryHref: "/dashboard/vehicles",
  },

  passenger: {
    eyebrowKey: "hero.passenger.eyebrow",
    titleKey: "hero.passenger.title",
    descriptionKey:
      "hero.passenger.description",
    primaryLabelKey:
      "hero.passenger.primaryLabel",
    primaryHref: "/dashboard/trips/new",
    secondaryLabelKey:
      "hero.passenger.secondaryLabel",
    secondaryHref: "/dashboard/trips",
  },
};

export function Hero({
  name,
  role = "passenger",
}: HeroProps) {
  const { t } = useLanguage();

  const data = content[role];

  const displayName =
    name || t("common.user");

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />

      <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative grid items-center gap-10 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
            <Sparkles size={14} />

            {t(data.eyebrowKey)}
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-400">
            {t("hero.greeting")},{" "}
            {displayName}
          </p>

          <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            {t(data.titleKey)}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            {t(data.descriptionKey)}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={data.primaryHref}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 font-bold text-black transition hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-xl hover:shadow-yellow-400/20"
            >
              {t(data.primaryLabelKey)}

              <ArrowRight size={18} />
            </Link>

            <Link
              href={data.secondaryHref}
              className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              {t(data.secondaryLabelKey)}
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <div className="rounded-[1.6rem] bg-yellow-400 p-6 text-black shadow-2xl shadow-yellow-400/10">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-yellow-400">
                  <CarFront size={24} />
                </span>

                <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-black uppercase tracking-wider">
                  AXI
                </span>
              </div>

              <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em]">
                {t("hero.card.eyebrow")}
              </p>

              <p className="mt-2 text-3xl font-black leading-tight">
                {t("hero.card.titleLineOne")}
                <br />
                {t("hero.card.titleLineTwo")}
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/10 p-3">
                  <MapPin size={18} />

                  <p className="mt-2 text-xs font-bold">
                    {t(
                      "hero.card.fasterRoutes"
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-black/10 p-3">
                  <ShieldCheck size={18} />

                  <p className="mt-2 text-xs font-bold">
                    {t(
                      "hero.card.safeTrips"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
