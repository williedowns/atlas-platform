export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { AutoRefresh } from "@/components/AutoRefresh";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function compact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function minutesAgo(isoString: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default async function FloorModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: show } = await supabase
    .from("shows")
    .select("*, location:locations(*)")
    .eq("id", id)
    .single();

  if (!show) notFound();

  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, total, deposit_paid, is_contingent, created_at,
      customer:customers(first_name, last_name),
      sales_rep:profiles(id, full_name),
      line_items
    `)
    .eq("show_id", id)
    .not("status", "in", '("draft","cancelled")')
    .order("created_at", { ascending: false });

  const rows = (contracts ?? []) as any[];
  const confirmed = rows.filter((c) => !c.is_contingent && c.status !== "quote");
  const contingent = rows.filter((c) => c.is_contingent);
  const quotes = rows.filter((c) => c.status === "quote");

  const totalRevenue = confirmed.reduce((s, c) => s + (c.total ?? 0), 0);
  const totalDeposits = confirmed.reduce((s, c) => s + (c.deposit_paid ?? 0), 0);
  const totalUnits = confirmed.reduce((s, c) => {
    const items = Array.isArray(c.line_items) ? c.line_items : [];
    return s + items.reduce((q: number, li: any) => q + (li?.quantity ?? 1), 0);
  }, 0);

  // ── Rep leaderboard ────────────────────────────────────────────────────────
  const repMap = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const c of confirmed) {
    const rep = c.sales_rep as { id?: string; full_name?: string } | null;
    const repId = rep?.id ?? "unknown";
    const repName = rep?.full_name ?? "Unassigned";
    const e = repMap.get(repId) ?? { id: repId, name: repName, count: 0, revenue: 0 };
    e.count += 1;
    e.revenue += c.total ?? 0;
    repMap.set(repId, e);
  }
  const leaderboard = Array.from(repMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // ── Recent activity feed ───────────────────────────────────────────────────
  const recentActivity = rows.slice(0, 10);

  const startDate = new Date(show.start_date);
  const endDate = new Date(show.end_date);
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const now = new Date();
  const todayISO = new Date().toISOString().split("T")[0];
  const dayNum = Math.min(totalDays, Math.max(1, Math.round((now.getTime() - startDate.getTime()) / 86400000) + 1));

  return (
    <div className="min-h-screen bg-[#010F21] text-white">
      <AutoRefresh intervalMs={20_000} />
      {/* Header strip */}
      <header className="px-10 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">Live</span>
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight">{show.name}</h1>
            <p className="text-white/50 text-sm">
              {show.venue_name} · {show.city}, {show.state}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Day</p>
            <p className="text-3xl font-black leading-tight tabular-nums">
              {dayNum} <span className="text-white/30 text-xl">/ {totalDays}</span>
            </p>
          </div>
          <div className="text-right" suppressHydrationWarning>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Now</p>
            <p className="text-3xl font-black leading-tight tabular-nums">{formatTime(now)}</p>
          </div>
          <Link
            href={`/shows/${id}`}
            className="text-white/40 hover:text-white/80 text-xs transition-colors"
          >
            ← Exit floor mode
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <div className="px-10 py-8 grid grid-cols-4 gap-6">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest">Revenue</p>
          <p className="text-6xl font-black text-[#00929C] tabular-nums leading-tight mt-2">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-white/40 text-xs mt-2">{confirmed.length} confirmed contracts</p>
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest">Units Sold</p>
          <p className="text-6xl font-black text-white tabular-nums leading-tight mt-2">{totalUnits}</p>
          <p className="text-white/40 text-xs mt-2">Across {compact(confirmed.length)} deals</p>
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest">Deposits</p>
          <p className="text-6xl font-black text-emerald-400 tabular-nums leading-tight mt-2">
            {formatCurrency(totalDeposits)}
          </p>
          <p className="text-white/40 text-xs mt-2">Collected on show floor</p>
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest">In Pipeline</p>
          <p className="text-6xl font-black text-amber-400 tabular-nums leading-tight mt-2">
            {contingent.length + quotes.length}
          </p>
          <p className="text-white/40 text-xs mt-2">
            {contingent.length} contingent · {quotes.length} quotes
          </p>
        </div>
      </div>

      {/* Main body — leaderboard + activity */}
      <div className="px-10 pb-10 grid grid-cols-5 gap-8">
        {/* Leaderboard */}
        <section className="col-span-2">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xl font-black">Rep Leaderboard</h2>
            <span className="text-white/30 text-xs uppercase tracking-widest">
              {leaderboard.length} reps
            </span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-white/40 text-sm">No sales logged yet today.</p>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((rep, i) => {
                const rankColor =
                  i === 0
                    ? "bg-amber-400 text-amber-900"
                    : i === 1
                    ? "bg-slate-300 text-slate-800"
                    : i === 2
                    ? "bg-orange-300 text-orange-900"
                    : "bg-white/10 text-white/70";
                return (
                  <li
                    key={rep.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      i === 0
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-black text-sm ${rankColor}`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg truncate">{rep.name}</p>
                      <p className="text-xs text-white/40">{rep.count} contract{rep.count === 1 ? "" : "s"}</p>
                    </div>
                    <p className="text-2xl font-black text-[#00929C] tabular-nums">
                      {formatCurrency(rep.revenue)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Activity feed */}
        <section className="col-span-3">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xl font-black">Live Activity</h2>
            <span className="text-white/30 text-xs uppercase tracking-widest">Last 10</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-white/40 text-sm">No activity yet today.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((c) => {
                const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
                const rep = Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep;
                const isToday = c.created_at?.startsWith(todayISO);
                const statusLabel = c.is_contingent
                  ? "Contingent"
                  : c.status === "quote"
                  ? "Quote"
                  : "Signed";
                const statusColor = c.is_contingent
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : c.status === "quote"
                  ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">
                          {customer?.first_name} {customer?.last_name}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5 truncate">
                        {rep?.full_name ?? "Unassigned"} · {c.contract_number}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black tabular-nums">{formatCurrency(c.total)}</p>
                      <p className="text-[10px] text-white/40" suppressHydrationWarning>
                        {isToday ? minutesAgo(c.created_at) : new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Footer brand strip */}
      <footer className="px-10 py-4 border-t border-white/5 flex items-center justify-between text-white/30 text-xs">
        <span className="uppercase tracking-widest">Show Floor Mode</span>
        <span className="uppercase tracking-widest">Powered by Salta</span>
      </footer>
    </div>
  );
}
