export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import RealtimeRefresher from "../_components/RealtimeRefresher";

interface Opp {
  id: string;
  name: string;
  status: string;
  value_estimate: number | null;
  probability: number | null;
  expected_close_date: string | null;
  owner_id: string | null;
  stage_id: string | null;
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
  stage_entered_at: string;
  owner: { id: string; full_name: string | null } | null;
  stage: { name: string; is_won: boolean; is_lost: boolean; sla_hours: number | null; color: string | null } | null;
  pipeline: { name: string } | null;
  primary_contact: { id: string; first_name: string; last_name: string | null } | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CrmForecastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    redirect("/dashboard");
  }

  const orgPerms = (profile?.organization as any)?.role_permissions;

  // Pull all open + recently-closed opps. Recently-closed feeds "trailing
  // performance" callouts; only open opps feed forward-looking forecast.
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: oppsRaw } = await supabase
    .from("opportunities")
    .select(`
      id, name, status, value_estimate, probability, expected_close_date,
      owner_id, stage_id, pipeline_id, created_at, updated_at, stage_entered_at,
      owner:profiles!owner_id(id, full_name),
      stage:pipeline_stages!stage_id(name, is_won, is_lost, sla_hours, color),
      pipeline:pipelines(name),
      primary_contact:contacts!primary_contact_id(id, first_name, last_name)
    `)
    .or(`status.eq.open,updated_at.gte.${ninetyDaysAgo.toISOString()}`)
    .order("expected_close_date", { ascending: true, nullsFirst: false })
    .limit(2000);

  const opps = (oppsRaw ?? []) as unknown as Opp[];
  const openOpps = opps.filter((o) => o.status === "open");
  const wonOpps = opps.filter((o) => o.status === "won");
  const lostOpps = opps.filter((o) => o.status === "lost");

  // ─── KPI strip totals
  const totalOpenValue = openOpps.reduce((s, o) => s + (o.value_estimate ?? 0), 0);
  const totalWeighted = openOpps.reduce(
    (s, o) => s + (o.value_estimate ?? 0) * ((o.probability ?? 0) / 100),
    0
  );
  const wonValueLast90 = wonOpps.reduce((s, o) => s + (o.value_estimate ?? 0), 0);
  const lostValueLast90 = lostOpps.reduce((s, o) => s + (o.value_estimate ?? 0), 0);
  const winRate = wonOpps.length + lostOpps.length > 0
    ? wonOpps.length / (wonOpps.length + lostOpps.length)
    : null;

  // ─── Rep leaderboard
  interface RepStats {
    id: string;
    name: string;
    openCount: number;
    openValue: number;
    weighted: number;
    wonCount: number;
    wonValue: number;
  }
  const repMap = new Map<string, RepStats>();
  for (const o of openOpps) {
    const ownerId = o.owner_id ?? "_unassigned";
    const ownerName = o.owner?.full_name ?? "Unassigned";
    const existing = repMap.get(ownerId) ?? {
      id: ownerId,
      name: ownerName,
      openCount: 0,
      openValue: 0,
      weighted: 0,
      wonCount: 0,
      wonValue: 0,
    };
    existing.openCount += 1;
    existing.openValue += o.value_estimate ?? 0;
    existing.weighted += (o.value_estimate ?? 0) * ((o.probability ?? 0) / 100);
    repMap.set(ownerId, existing);
  }
  for (const o of wonOpps) {
    const ownerId = o.owner_id ?? "_unassigned";
    const ownerName = o.owner?.full_name ?? "Unassigned";
    const existing = repMap.get(ownerId) ?? {
      id: ownerId,
      name: ownerName,
      openCount: 0,
      openValue: 0,
      weighted: 0,
      wonCount: 0,
      wonValue: 0,
    };
    existing.wonCount += 1;
    existing.wonValue += o.value_estimate ?? 0;
    repMap.set(ownerId, existing);
  }
  const reps = Array.from(repMap.values()).sort((a, b) => b.weighted - a.weighted);

  // ─── Monthly forecast: next 6 months
  interface MonthBucket {
    key: string;
    label: string;
    committed: number;        // open opps with stage.is_won OR probability >= 90
    bestCase: number;         // open opps with probability 50-89
    pipeline: number;         // all open opps in month (sum value_estimate)
    weighted: number;         // sum (value * probability / 100)
    count: number;
  }
  const months: MonthBucket[] = [];
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      key: monthKey(d),
      label: monthLabel(d),
      committed: 0,
      bestCase: 0,
      pipeline: 0,
      weighted: 0,
      count: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  let noDateValue = 0;
  let noDateCount = 0;

  for (const o of openOpps) {
    const value = o.value_estimate ?? 0;
    const prob = o.probability ?? 0;
    if (!o.expected_close_date) {
      noDateValue += value;
      noDateCount += 1;
      continue;
    }
    const closeDate = new Date(o.expected_close_date);
    const key = monthKey(closeDate);
    const idx = monthIndex.get(key);
    if (idx === undefined) continue; // outside the 6-month window
    const bucket = months[idx];
    bucket.pipeline += value;
    bucket.weighted += value * (prob / 100);
    bucket.count += 1;
    if (prob >= 90) {
      bucket.committed += value;
    } else if (prob >= 50) {
      bucket.bestCase += value;
    }
  }

  const maxMonthValue = Math.max(...months.map((m) => m.pipeline), 1);

  // ─── Deals at risk: in-stage longer than SLA, or in-stage longer than 14d if no SLA
  const now = Date.now();
  interface AtRiskOpp {
    opp: Opp;
    daysInStage: number;
    slaDays: number | null;
    overByDays: number;
  }
  const atRisk: AtRiskOpp[] = [];
  for (const o of openOpps) {
    // Use stage_entered_at (set by moveOpportunityStage on every stage move).
    // This is accurate to the actual time spent in the current stage, not
    // affected by edits to other fields.
    const since = new Date(o.stage_entered_at).getTime();
    const daysInStage = Math.floor((now - since) / 86400000);
    const slaHours = o.stage?.sla_hours ?? null;
    const slaDays = slaHours != null ? Math.ceil(slaHours / 24) : null;
    const threshold = slaDays ?? 14;
    if (daysInStage > threshold) {
      atRisk.push({ opp: o, daysInStage, slaDays, overByDays: daysInStage - threshold });
    }
  }
  atRisk.sort((a, b) => (b.opp.value_estimate ?? 0) - (a.opp.value_estimate ?? 0));
  const atRiskValue = atRisk.reduce((s, r) => s + (r.opp.value_estimate ?? 0), 0);

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Forecast"
        subtitle={`${openOpps.length} open deals · ${formatCurrency(totalOpenValue)} pipeline · ${formatCurrency(totalWeighted)} weighted`}
        backHref="/crm"
      />

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Pipeline" value={formatCurrency(totalOpenValue)} sublabel={`${openOpps.length} open`} accent="#0B1929" />
          <KpiCard label="Weighted" value={formatCurrency(totalWeighted)} sublabel="value × probability" accent="#00929C" />
          <KpiCard label="Won (90d)" value={formatCurrency(wonValueLast90)} sublabel={`${wonOpps.length} deals`} accent="#22c55e" />
          <KpiCard label="Lost (90d)" value={formatCurrency(lostValueLast90)} sublabel={`${lostOpps.length} deals`} accent="#ef4444" />
          <KpiCard
            label="Win rate"
            value={winRate != null ? `${Math.round(winRate * 100)}%` : "—"}
            sublabel={winRate != null ? "last 90 days" : "no closed deals"}
            accent="#7c3aed"
          />
        </section>

        {/* Rep leaderboard */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rep leaderboard</h3>
              <p className="text-[11px] text-slate-500">Ranked by weighted pipeline (open value × probability)</p>
            </div>
            <span className="text-[11px] text-slate-400">{reps.length} rep{reps.length === 1 ? "" : "s"}</span>
          </div>
          {reps.length === 0 ? (
            <p className="p-5 text-center text-sm text-slate-400 italic">No deals yet. Reps will appear here as they own opportunities.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 px-4 py-2">Rep</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-bold text-slate-500 px-4 py-2">Open</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-bold text-slate-500 px-4 py-2">Pipeline</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-bold text-slate-500 px-4 py-2">Weighted</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-bold text-slate-500 px-4 py-2">Won 90d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reps.map((r, idx) => {
                  const initials = r.name === "Unassigned" ? "—" : r.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums w-4">#{idx + 1}</span>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            r.id === "_unassigned" ? "bg-slate-200 text-slate-500" : "bg-gradient-to-br from-[#00929C] to-[#007a82] text-white"
                          }`}>
                            {initials}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">{r.openCount}</td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">{formatCurrency(r.openValue)}</td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums font-bold text-[#00929C]">{formatCurrency(r.weighted)}</td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-green-700">{r.wonCount > 0 ? formatCurrency(r.wonValue) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* 6-month forecast */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">6-month forecast</h3>
            <p className="text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" />Committed (≥90%)</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400" />Best case (50-89%)</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-300" />Pipeline (≤50%)</span>
            </p>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {months.map((m) => {
              const lowProb = m.pipeline - m.committed - m.bestCase;
              const commitedPct = (m.committed / maxMonthValue) * 100;
              const bestCasePct = (m.bestCase / maxMonthValue) * 100;
              const lowPct = (lowProb / maxMonthValue) * 100;
              return (
                <div key={m.key} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{m.label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(m.pipeline)}</p>
                  <p className="text-[10px] text-slate-500">{m.count} deal{m.count === 1 ? "" : "s"} · {formatCurrency(m.weighted)} weighted</p>
                  {/* Stacked bar */}
                  <div className="mt-2 h-2 bg-slate-200 rounded overflow-hidden flex">
                    {commitedPct > 0 && <div style={{ width: `${commitedPct}%` }} className="bg-green-500" title={`Committed: ${formatCurrency(m.committed)}`} />}
                    {bestCasePct > 0 && <div style={{ width: `${bestCasePct}%` }} className="bg-blue-400" title={`Best case: ${formatCurrency(m.bestCase)}`} />}
                    {lowPct > 0 && <div style={{ width: `${lowPct}%` }} className="bg-slate-400" title={`Pipeline (<50%): ${formatCurrency(lowProb)}`} />}
                  </div>
                </div>
              );
            })}
          </div>
          {noDateCount > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/50 text-[11px] text-amber-800">
              <strong>{noDateCount} open deal{noDateCount === 1 ? "" : "s"}</strong> worth{" "}
              <strong className="tabular-nums">{formatCurrency(noDateValue)}</strong> have no expected close date — they're excluded from this forecast.
              {" "}<Link href="/crm/pipeline" className="font-semibold underline text-amber-900">Fix on the Kanban</Link>
            </div>
          )}
        </section>

        {/* Deals at risk */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Deals at risk</h3>
              <p className="text-[11px] text-slate-500">
                Open deals stuck in their current stage beyond the SLA (or 14 days if no SLA)
              </p>
            </div>
            {atRisk.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[11px] font-bold text-red-700 tabular-nums">
                {atRisk.length} · {formatCurrency(atRiskValue)}
              </span>
            )}
          </div>
          {atRisk.length === 0 ? (
            <p className="p-5 text-center text-sm text-green-700 italic">All open deals are within their stage SLA. Clean board.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {atRisk.slice(0, 20).map((r) => {
                const contactName = r.opp.primary_contact
                  ? [r.opp.primary_contact.first_name, r.opp.primary_contact.last_name].filter(Boolean).join(" ")
                  : null;
                return (
                  <li key={r.opp.id}>
                    <Link
                      href={`/crm/opportunities/${r.opp.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-900 group-hover:text-[#00929C] transition-colors truncate">
                            {r.opp.name}
                          </p>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                            +{r.overByDays}d overdue
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {r.opp.stage?.color && (
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.opp.stage.color }} />
                          )}
                          <p className="text-[11px] text-slate-500 truncate">
                            {r.opp.stage?.name ?? "—"} · {r.daysInStage}d in stage
                            {r.slaDays != null && ` · SLA ${r.slaDays}d`}
                            {contactName && ` · ${contactName}`}
                            {r.opp.owner?.full_name && ` · ${r.opp.owner.full_name}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">
                        {formatCurrency(r.opp.value_estimate ?? 0)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {atRisk.length > 20 && (
            <div className="px-5 py-2 border-t border-slate-100 text-center text-[11px] text-slate-500">
              Showing top 20 by value · {atRisk.length - 20} more
            </div>
          )}
        </section>
      </main>

      <RealtimeRefresher tables={["opportunities"]} />
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sublabel}</p>
    </div>
  );
}
