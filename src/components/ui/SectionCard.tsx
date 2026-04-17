import Link from "next/link";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  accentColor?: string;
  children: React.ReactNode;
  className?: string;
  /** Override body wrapper classes. Pass "p-0" for flush list rows. */
  bodyClassName?: string;
  /** Optional node rendered in the header, between title and view-all link */
  headerAccessory?: React.ReactNode;
}

const DEFAULT_ACCENT = "#00929C";

export function SectionCard({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = "View all →",
  accentColor = DEFAULT_ACCENT,
  children,
  className = "",
  bodyClassName = "p-6",
  headerAccessory,
}: SectionCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {headerAccessory}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-semibold hover:underline flex-shrink-0"
            style={{ color: accentColor }}
          >
            {viewAllLabel}
          </Link>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
