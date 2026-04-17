import Link from "next/link";

interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  accentColor?: string;
  size?: "default" | "lg";
  href?: string;
}

const DEFAULT_ACCENT = "#00929C";

export function KpiCard({
  label,
  value,
  sublabel,
  trend,
  trendValue,
  accentColor = DEFAULT_ACCENT,
  size = "default",
  href,
}: KpiCardProps) {
  const trendColor = trend === "up" ? "#059669" : trend === "down" ? "#DC2626" : "#64748B";
  const trendArrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "→";

  const body = (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow h-full">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
          {label}
        </p>
        {trend && trendValue && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ color: trendColor, backgroundColor: `${trendColor}15` }}
          >
            {trendArrow} {trendValue}
          </span>
        )}
      </div>
      <p
        className={`${size === "lg" ? "text-4xl" : "text-3xl"} font-black mt-2 tracking-tight`}
        style={{ color: accentColor }}
      >
        {value}
      </p>
      {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
