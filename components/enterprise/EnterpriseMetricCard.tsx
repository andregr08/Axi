"use client";

import type { ReactNode } from "react";

type MetricTone = "default" | "success" | "warning" | "danger" | "info";

interface EnterpriseMetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
}

const toneClasses: Record<
  MetricTone,
  {
    container: string;
    label: string;
    value: string;
    detail: string;
    icon: string;
  }
> = {
  default: {
    container: "border-slate-200 bg-white",
    label: "text-slate-500",
    value: "text-slate-900",
    detail: "text-slate-500",
    icon: "bg-slate-100 text-slate-600",
  },
  success: {
    container: "border-emerald-200 bg-emerald-50",
    label: "text-emerald-700",
    value: "text-emerald-900",
    detail: "text-emerald-700",
    icon: "bg-emerald-100 text-emerald-700",
  },
  warning: {
    container: "border-amber-200 bg-amber-50",
    label: "text-amber-700",
    value: "text-amber-900",
    detail: "text-amber-700",
    icon: "bg-amber-100 text-amber-700",
  },
  danger: {
    container: "border-red-200 bg-red-50",
    label: "text-red-700",
    value: "text-red-900",
    detail: "text-red-700",
    icon: "bg-red-100 text-red-700",
  },
  info: {
    container: "border-blue-200 bg-blue-50",
    label: "text-blue-700",
    value: "text-blue-900",
    detail: "text-blue-700",
    icon: "bg-blue-100 text-blue-700",
  },
};

export default function EnterpriseMetricCard({
  label,
  value,
  detail,
  icon,
  tone = "default",
}: EnterpriseMetricCardProps) {
  const classes = toneClasses[tone];

  return (
    <div className={["rounded-2xl border p-5", classes.container].join(" ")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={["text-sm", classes.label].join(" ")}>{label}</p>

          <div
            className={[
              "mt-2 text-2xl font-bold tracking-tight",
              classes.value,
            ].join(" ")}
          >
            {value}
          </div>

          {detail && (
            <div className={["mt-1 text-xs", classes.detail].join(" ")}>
              {detail}
            </div>
          )}
        </div>

        {icon && (
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              classes.icon,
            ].join(" ")}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
