import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Optional icon — pass a Lucide-style inline SVG or any ReactNode */
  icon?: ReactNode;
  /** Headline — keep short, ~6 words */
  title: string;
  /** Optional 1-2 sentence explanation */
  description?: ReactNode;
  /** Optional primary action */
  action?: {
    label: string;
    href: string;
  };
  /** Compact variant reduces vertical padding */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`text-center flex flex-col items-center justify-center ${
        compact ? "py-8 px-4" : "py-14 px-6"
      } ${className}`}
    >
      {icon && (
        <div className="mb-4 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-1.5 max-w-sm">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00929C] hover:bg-[#007a82] text-white text-sm font-semibold transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
