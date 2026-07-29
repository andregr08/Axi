"use client";

import type { ReactNode } from "react";

interface EnterpriseEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EnterpriseEmptyState({
  title,
  description,
  icon,
  action,
}: EnterpriseEmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}

      <h2 className="font-semibold text-slate-900">{title}</h2>

      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
