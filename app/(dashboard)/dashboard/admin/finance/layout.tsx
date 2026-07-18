import type { ReactNode } from "react";
import FinanceSidebar from "@/components/finance/FinanceSidebar";

export default function FinanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <FinanceSidebar />
      <main>{children}</main>
    </div>
  );
}
