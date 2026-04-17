import Link from "next/link";
import type { ReactNode } from "react";

interface StatusChip {
  label: string;
  pulsing?: boolean;
  color?: string;
}

interface AppHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  status?: StatusChip;
}

export function AppHeader({
  title,
  subtitle,
  actions,
  backHref,
  status,
}: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-10 h-16 px-5 flex items-center gap-3 border-b border-white/5 text-white"
      style={{ backgroundColor: "#0B1929", boxShadow: "0 1px 0 rgba(255,255,255,0.03)" }}
    >
      {backHref && (
        <Link
          href={backHref}
          aria-label="Back"
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold leading-tight tracking-tight truncate">{title}</h1>
        {subtitle && (
          <div className="text-white/50 text-xs leading-tight truncate">{subtitle}</div>
        )}
      </div>

      {status && (
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${status.pulsing ? "animate-pulse" : ""}`}
            style={{ backgroundColor: status.color ?? "#10B981" }}
          />
          <span className="text-xs font-medium text-white/80 truncate max-w-[260px]">
            {status.label}
          </span>
        </div>
      )}

      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}
