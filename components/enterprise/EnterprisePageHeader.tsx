"use client";

import type { ReactNode } from "react";

interface EnterprisePageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function EnterprisePageHeader({
  eyebrow,
  title,
  description,
  actions,
}: EnterprisePageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        {eyebrow && (
          <p className="text-sm font-medium text-blue-600">{eyebrow}</p>
        )}

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>

        {description && (
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </header>
  );
}
