"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";
import type {
  TripDetailRole,
  TripDetailStatus,
} from "@/components/trips/detail/TripDetailTypes";

type TripDetailHeaderProps = {
  role: TripDetailRole;
  status: TripDetailStatus;
  requestedAt: string;
  displayPrice: string;
  statusLabel: string;
  title: string;
  description: string;
};

function getStatusVariant(
  status: TripDetailStatus
): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";

  if (
    status === "requested" ||
    status === "searching" ||
    status === "accepted"
  ) {
    return "warning";
  }

  return "default";
}

export function TripDetailHeader({
  role,
  status,
  requestedAt,
  displayPrice,
  statusLabel,
  title,
  description,
}: TripDetailHeaderProps) {
  const { locale } = useLanguage();

  const passengerEnglish =
    role === "passenger" &&
    locale === "en";

  const backHref =
    role === "driver"
      ? "/dashboard/driver/available-trips"
      : role === "passenger"
        ? "/dashboard/trips"
        : "/dashboard/admin/trips";

  const backLabel =
    role === "driver"
      ? "Volver a viajes disponibles"
      : role === "passenger"
        ? passengerEnglish
          ? "Back to my rides"
          : "Volver a mis viajes"
        : "Volver a viajes";

  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />
          {backLabel}
        </Link>

        <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <CalendarDays size={16} />
          {requestedAt}
        </span>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:px-9 sm:py-10",
          isCancelled
            ? "bg-[linear-gradient(120deg,#450a0a,#7f1d1d)]"
            : isCompleted
              ? "bg-[linear-gradient(120deg,#052e16,#166534)]"
              : role === "driver"
                ? "bg-[linear-gradient(120deg,#111827,#0f172a)]"
                : "bg-[#0B0F19]"
        )}
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge
              variant={getStatusVariant(status)}
              className="border border-white/10"
            >
              {statusLabel}
            </Badge>

            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {description}
            </p>
          </div>

          <div className="min-w-64 rounded-3xl border border-white/10 bg-white/10 px-6 py-5 backdrop-blur-xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
              <CircleDollarSign size={16} />
              {passengerEnglish
                ? "Ride price"
                : "Precio del viaje"}
            </p>

            <p className="mt-2 text-4xl font-black">
              {displayPrice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
