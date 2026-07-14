import Link from "next/link";
import { Navigation } from "lucide-react";
import { cn } from "@/utils/cn";

interface LogoProps {
  href?: string;
  dark?: boolean;
  compact?: boolean;
  className?: string;
}

export function Logo({
  href = "/",
  dark = false,
  compact = false,
  className,
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-3", className)}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-black shadow-lg shadow-yellow-400/20">
        <Navigation size={22} strokeWidth={2.5} />
      </span>

      {!compact && (
        <span>
          <span
            className={cn(
              "block text-2xl font-black tracking-tight",
              dark ? "text-white" : "text-slate-950"
            )}
          >
            AXI
          </span>
          <span
            className={cn(
              "block text-[10px] font-bold uppercase tracking-[0.22em]",
              dark ? "text-slate-400" : "text-slate-500"
            )}
          >
            Mobility
          </span>
        </span>
      )}
    </Link>
  );
}
