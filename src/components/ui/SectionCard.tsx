import Link from "next/link";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  accentColor?: string;
  children: React.ReactNode;
  className?: string;
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
}: SectionCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-semibold hover:underline"
            style={{ color: accentColor }}
          >
            {viewAllLabel}
          </Link>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
