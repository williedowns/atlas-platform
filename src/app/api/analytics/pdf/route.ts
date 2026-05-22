// Owner-facing analytics PDF report.
// Mirrors the data on src/app/analytics/page.tsx exactly — same queries, same
// filters, same okRows definition. The numbers on this PDF must equal what
// Willie sees on screen.
//
// Adds an AI Insights & Recommendations section powered by a pure rule-based
// engine (src/lib/analytics-insights.ts). No LLM call. Every sentence in the
// insights section references real values from the snapshot.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { isMainProduct } from "@/lib/inventory-constants";
import { lowDepositInfo } from "@/lib/low-deposit";
import { effectiveDeposit } from "@/lib/effective-deposit";
import { COMPANY_NAME, CORPORATE_NAME } from "@/lib/brand";
import { fetchBuildingSalesForPeriod, summarizeBuildingSales } from "@/lib/building-sales";
import {
  generateInsights,
  type AnalyticsSnapshot,
  type Finding,
  type Recommendation,
} from "@/lib/analytics-insights";

type Period = "today" | "week" | "month" | "year" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year (YTD)",
  all: "All Time",
};

function getPeriodRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { gte: start.toISOString(), lte: new Date(start.getTime() + 86400000).toISOString() };
  }
  if (period === "week") {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return { gte: start.toISOString(), lte: new Date(start.getTime() + 7 * 86400000).toISOString() };
  }
  if (period === "month") {
    return {
      gte: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      lte: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  }
  if (period === "year") {
    return {
      gte: new Date(now.getFullYear(), 0, 1).toISOString(),
      lte: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
    };
  }
  return {};
}

function getPriorPeriodRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    return { gte: start.toISOString(), lte: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1).toISOString() };
  }
  if (period === "week") {
    const day = now.getDay();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - day);
    thisWeekStart.setHours(0, 0, 0, 0);
    const start = new Date(thisWeekStart);
    start.setFullYear(start.getFullYear() - 1);
    return { gte: start.toISOString(), lte: new Date(start.getTime() + 7 * 86400000).toISOString() };
  }
  if (period === "month") {
    return {
      gte: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString(),
      lte: new Date(now.getFullYear() - 1, now.getMonth() + 1, 1).toISOString(),
    };
  }
  if (period === "year") {
    return {
      gte: new Date(now.getFullYear() - 1, 0, 1).toISOString(),
      lte: new Date(now.getFullYear(), 0, 1).toISOString(),
    };
  }
  return {};
}

// ── Brand palette ─────────────────────────────────────────────────────────
const NAVY: [number, number, number] = [1, 15, 33];        // #010F21
const TEAL: [number, number, number] = [0, 146, 156];      // #00929C
const AMBER: [number, number, number] = [217, 119, 6];     // #d97706
const EMERALD: [number, number, number] = [5, 150, 105];   // #059669
const RED: [number, number, number] = [220, 38, 38];       // #dc2626
const SLATE_DARK: [number, number, number] = [30, 41, 59];
const SLATE_MED: [number, number, number] = [100, 116, 139];
const SLATE_LIGHT: [number, number, number] = [203, 213, 225];
const SLATE_BG: [number, number, number] = [248, 250, 252];

// Page geometry (portrait letter)
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_BOTTOM = PAGE_H - 22; // reserve for footer

type PDFCtx = { doc: jsPDF; y: number };

function ensureSpace(ctx: PDFCtx, needed: number) {
  if (ctx.y + needed > PAGE_BOTTOM) {
    ctx.doc.addPage();
    ctx.y = MARGIN;
  }
}

function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function drawSectionHeader(ctx: PDFCtx, title: string, subtitle?: string) {
  ensureSpace(ctx, 18);
  setFill(ctx.doc, NAVY);
  ctx.doc.rect(MARGIN, ctx.y, CONTENT_W, 9, "F");
  setColor(ctx.doc, [255, 255, 255]);
  ctx.doc.setFontSize(11);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(title.toUpperCase(), MARGIN + 3, ctx.y + 6);
  if (subtitle) {
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(8.5);
    ctx.doc.text(subtitle, MARGIN + CONTENT_W - 3, ctx.y + 6, { align: "right" });
  }
  ctx.y += 13;
  setColor(ctx.doc, SLATE_DARK);
}

function truncate(doc: jsPDF, str: string, maxW: number): string {
  if (doc.getTextWidth(str) <= maxW) return str;
  while (str.length > 1 && doc.getTextWidth(str + "…") > maxW) str = str.slice(0, -1);
  return str + "…";
}

type Column = { label: string; x: number; w: number; align?: "left" | "right" };

function drawTableHeader(ctx: PDFCtx, cols: Column[]) {
  setFill(ctx.doc, SLATE_BG);
  ctx.doc.rect(MARGIN, ctx.y - 4, CONTENT_W, 7, "F");
  ctx.doc.setFontSize(7.5);
  ctx.doc.setFont("helvetica", "bold");
  setColor(ctx.doc, SLATE_MED);
  cols.forEach((c) => {
    if (c.align === "right") ctx.doc.text(c.label, c.x + c.w, ctx.y, { align: "right" });
    else ctx.doc.text(c.label, c.x, ctx.y);
  });
  ctx.y += 3;
  setDraw(ctx.doc, SLATE_LIGHT);
  ctx.doc.line(MARGIN, ctx.y, MARGIN + CONTENT_W, ctx.y);
  ctx.y += 5;
}

function drawTableRow(
  ctx: PDFCtx,
  cols: Column[],
  values: { text: string; color?: [number, number, number]; bold?: boolean }[],
  zebra: boolean
) {
  if (ctx.y > PAGE_BOTTOM - 7) {
    ctx.doc.addPage();
    ctx.y = MARGIN;
    drawTableHeader(ctx, cols);
  }
  if (zebra) {
    setFill(ctx.doc, [251, 252, 253]);
    ctx.doc.rect(MARGIN, ctx.y - 4, CONTENT_W, 7, "F");
  }
  ctx.doc.setFontSize(8);
  ctx.doc.setFont("helvetica", "normal");
  values.forEach((v, i) => {
    const col = cols[i];
    setColor(ctx.doc, v.color ?? SLATE_DARK);
    ctx.doc.setFont("helvetica", v.bold ? "bold" : "normal");
    const text = truncate(ctx.doc, v.text, col.w - 2);
    if (col.align === "right") ctx.doc.text(text, col.x + col.w, ctx.y, { align: "right" });
    else ctx.doc.text(text, col.x, ctx.y);
  });
  ctx.y += 7;
  setColor(ctx.doc, SLATE_DARK);
  ctx.doc.setFont("helvetica", "normal");
}

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  delta?: { pct: number; positive: boolean } | null,
  sublabel?: string,
  accent?: [number, number, number]
) {
  setDraw(doc, SLATE_LIGHT);
  doc.setLineWidth(0.3);
  setFill(doc, [255, 255, 255]);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  // Top accent bar
  if (accent) {
    setFill(doc, accent);
    doc.rect(x, y, w, 1.2, "F");
  }

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  setColor(doc, SLATE_MED);
  doc.text(label.toUpperCase(), x + 3, y + 7);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  setColor(doc, accent ?? SLATE_DARK);
  doc.text(value, x + 3, y + 16);

  // jsPDF's default Helvetica lacks ▲/▼ glyphs (they render as garbage like
  // "%²"). Use plain text + the green/red color to convey direction. The
  // color is the signal — no "+" prefix on positives (industry convention).
  if (delta) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    setColor(doc, delta.positive ? EMERALD : RED);
    const prefix = delta.positive ? "" : "-";
    doc.text(`${prefix}${Math.abs(delta.pct).toFixed(1)}%`, x + 3, y + 21);
    if (sublabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      setColor(doc, SLATE_MED);
      doc.text(sublabel, x + 3, y + 25);
    }
  } else if (sublabel) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(doc, SLATE_MED);
    doc.text(sublabel, x + 3, y + 22);
  }

  setColor(doc, SLATE_DARK);
}

// Wrap text into lines for jsPDF
function wrapText(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW);
}

// Find a finding-level color
function levelAccent(level: Finding["level"]): [number, number, number] {
  if (level === "warning") return RED;
  if (level === "positive") return EMERALD;
  return SLATE_MED;
}

// ── ROUTE ─────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const { hasPermission } = await import("@/lib/permissions");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "analytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period: Period = (["today", "week", "month", "year", "all"].includes(searchParams.get("period") ?? "")
    ? searchParams.get("period")
    : "month") as Period;

  const range = getPeriodRange(period);
  const priorRange = getPriorPeriodRange(period);

  // Mirror the analytics page queries exactly.
  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, total, cost, deposit_paid, balance_due, status, is_contingent, created_at, financing,
      signature_metadata,
      customer:customers(first_name, last_name),
      show:shows(id, name, venue_name, city, state, start_date, end_date),
      location:locations(id, name, type),
      sales_rep:profiles!contracts_sales_rep_id_fkey(id, full_name),
      line_items
    `)
    .not("status", "in", '("cancelled","quote","draft")');
  if (range.gte) query = query.gte("created_at", range.gte);
  if (range.lte) query = query.lt("created_at", range.lte);

  let priorQuery = supabase
    .from("contracts")
    .select("total, cost, deposit_paid, is_contingent, status, financing")
    .not("status", "in", '("cancelled","quote","draft")');
  if (priorRange.gte) priorQuery = priorQuery.gte("created_at", priorRange.gte);
  if (priorRange.lte) priorQuery = priorQuery.lt("created_at", priorRange.lte);

  const outstandingQuery = supabase
    .from("contracts")
    .select(`
      id, contract_number, total, deposit_paid, balance_due, status, created_at,
      customer:customers(first_name, last_name)
    `)
    .not("status", "eq", "cancelled")
    .not("idempotency_key", "is", null)
    .gt("balance_due", 0)
    .order("created_at", { ascending: true });

  const goalsQuery = supabase
    .from("sales_goals")
    .select("rep_id, target_revenue")
    .eq("period_start", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));

  const commissionQuery = supabase.from("commission_rates").select("rep_id, rate_pct");

  let showsCostQuery = supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date, total_cost")
    .limit(500);
  if (range.gte) showsCostQuery = showsCostQuery.gte("end_date", range.gte.split("T")[0]);
  if (range.lte) showsCostQuery = showsCostQuery.lt("start_date", range.lte.split("T")[0]);

  let cancelledQuery = supabase
    .from("contracts")
    .select(`
      id, total, created_at,
      sales_rep:profiles!contracts_sales_rep_id_fkey(id, full_name)
    `)
    .eq("status", "cancelled");
  if (range.gte) cancelledQuery = cancelledQuery.gte("created_at", range.gte);
  if (range.lte) cancelledQuery = cancelledQuery.lt("created_at", range.lte);

  const [
    { data: contracts },
    { data: priorContracts },
    { data: outstanding },
    { data: goalRows },
    { data: commissionRows },
    { data: showsInPeriod },
    { data: cancelledRows },
    buildingRows,
  ] = await Promise.all([
    query, priorQuery, outstandingQuery, goalsQuery, commissionQuery, showsCostQuery, cancelledQuery,
    fetchBuildingSalesForPeriod(supabase, range),
  ]);
  const buildingSummary = summarizeBuildingSales(buildingRows);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (contracts ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priorRows = (priorContracts ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outstandingRows = (outstanding ?? []) as any[];

  // ── Aggregations — MIRROR analytics/page.tsx exactly ─────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmedRows = rows.filter((c: any) => !c.is_contingent);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contingentRows = rows.filter((c: any) => c.is_contingent);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmedRevenue = confirmedRows.reduce((s: number, c: any) => s + (c.total ?? 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contingentRevenue = contingentRows.reduce((s: number, c: any) => s + (c.total ?? 0), 0);
  const grossRevenueAll = confirmedRevenue + contingentRevenue;
  const contingentCount = contingentRows.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const okRows = confirmedRows.filter((c: any) => !lowDepositInfo(c).isLow);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const okPriorRows = priorRows.filter((c: any) => !c.is_contingent).filter((c: any) => !lowDepositInfo(c).isLow);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalRevenue = okRows.reduce((s: number, c: any) => s + (c.total ?? 0), 0);
  // Total Deposits per William Downs Sr. clarification 2026-05-21: includes
  // financed amounts run at point of sale (Wells Fargo etc.), not just cash.
  const depositSplit = okRows.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: { cash: number; financed: number }, c: any) => {
      const e = effectiveDeposit(c);
      acc.cash += e.cash;
      acc.financed += e.financed;
      return acc;
    },
    { cash: 0, financed: 0 },
  );
  const cashDeposits = depositSplit.cash;
  const financeDeposits = depositSplit.financed;
  const totalDeposits = cashDeposits + financeDeposits;
  const contractCount = okRows.length;
  const avgDeal = contractCount > 0 ? totalRevenue / contractCount : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priorRevenue = okPriorRows.reduce((s: number, c: any) => s + (c.total ?? 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priorDeposits = okPriorRows.reduce((s: number, c: any) => s + effectiveDeposit(c).total, 0);
  const priorCount = okPriorRows.length;

  const revDelta = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : null;
  const depDelta = priorDeposits > 0 ? ((totalDeposits - priorDeposits) / priorDeposits) * 100 : null;
  const cntDelta = priorCount > 0 ? ((contractCount - priorCount) / priorCount) * 100 : null;

  // Net profit — two cost categories now that we have real per-deal data:
  //   1. totalContractCost — sum of contracts.cost (per-deal COGS imported
  //      from Lori XLSX: spa wholesale + freight + delivery + options).
  //   2. totalShowCost — per-show booth/staffing overhead.
  // Both are real out-of-pocket. True net subtracts both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalContractCost = okRows.reduce((s: number, c: any) => {
    const n = Number(c.cost ?? 0);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalShowCost = (showsInPeriod ?? []).reduce((s: number, sh: any) => {
    const n = sh.total_cost == null ? 0 : Number(sh.total_cost);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const netProfit = totalRevenue - totalContractCost - totalShowCost;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const okContractsWithCost = okRows.filter((c: any) => {
    const n = Number(c.cost ?? 0);
    return Number.isFinite(n) && n > 0;
  }).length;

  // Cancellations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelled = (cancelledRows ?? []) as any[];
  const cancelCount = cancelled.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelTotal = cancelled.reduce((s: number, c: any) => s + (c.total ?? 0), 0);
  const cancelDenom = cancelCount + contractCount;
  const cancelRate = cancelDenom > 0 ? (cancelCount / cancelDenom) * 100 : null;

  // Velocity
  const velocityDays: number[] = [];
  for (const c of okRows) {
    const sig = c.signature_metadata as { consented_at?: string } | null;
    const consentedAt = sig?.consented_at;
    if (!consentedAt) continue;
    const days = (new Date(consentedAt).getTime() - new Date(c.created_at).getTime()) / 86400000;
    if (Number.isFinite(days) && days >= 0) velocityDays.push(days);
  }
  const velocityCount = velocityDays.length;
  const velocityAvg = velocityCount > 0 ? velocityDays.reduce((s, d) => s + d, 0) / velocityCount : null;
  const velocityMedian = (() => {
    if (velocityCount === 0) return null;
    const sorted = [...velocityDays].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  })();

  // Rep leaderboard — weighted z-score composite (adapted from
  // src/lib/show-leaderboard/ranking.ts). Real per-deal cost data is now
  // available (contracts.cost imported from Lori XLSX) so we can compute
  // margin_per_show like the original Show Leaderboard formula intended.
  // lift_attach still dropped (line_items not reliable enough yet).
  const goalMap = new Map((goalRows ?? []).map((g) => [g.rep_id, g.target_revenue]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commissionMap = new Map((commissionRows ?? []).map((r: any) => [r.rep_id, Number(r.rate_pct)]));
  const hasCommissions = (commissionRows ?? []).length > 0;

  type RepAcc = {
    id: string;
    name: string;
    count: number;            // OK deals in period
    revenue: number;          // sum of totals
    cost: number;             // sum of contracts.cost (real per-deal COGS)
    shows: Set<string>;       // distinct shows in period
    cancelled: number;        // cancelled deals attributed to this rep
  };
  const repAccMap = new Map<string, RepAcc>();
  for (const c of okRows) {
    const repId = c.sales_rep?.id ?? "unknown";
    const repName = c.sales_rep?.full_name ?? "Unknown";
    const acc = repAccMap.get(repId) ?? { id: repId, name: repName, count: 0, revenue: 0, cost: 0, shows: new Set<string>(), cancelled: 0 };
    acc.count += 1;
    acc.revenue += c.total ?? 0;
    const cn = Number(c.cost ?? 0);
    if (Number.isFinite(cn)) acc.cost += cn;
    const showId = c.show?.id;
    if (showId) acc.shows.add(showId);
    repAccMap.set(repId, acc);
  }
  // Attribute cancellations to reps (only those active in the period).
  for (const cr of cancelled) {
    const repId = cr.sales_rep?.id;
    if (!repId) continue;
    const acc = repAccMap.get(repId);
    if (acc) acc.cancelled += 1;
  }

  // Per-show contract COGS — sum of contract.cost grouped by show. Used by
  // Top Products allocation and the Shows breakdown below.
  const contractCostByShowId = new Map<string, number>();
  for (const c of okRows) {
    const sid = c.show?.id;
    if (!sid) continue;
    const cn = Number(c.cost ?? 0);
    if (!Number.isFinite(cn)) continue;
    contractCostByShowId.set(sid, (contractCostByShowId.get(sid) ?? 0) + cn);
  }

  // Derived per-rep metrics
  type RepMetric = {
    id: string;
    name: string;
    count: number;
    revenue: number;
    avgDeal: number;
    showCount: number;
    unitsPerShow: number;
    cancelRate: number;
    netProfit: number;          // revenue minus real per-deal COGS
    marginPerShow: number;      // netProfit / showCount (rep productivity)
    allocatedCost: number;      // sum of contracts.cost across rep's deals
    score: number;
  };
  const repMetrics: RepMetric[] = Array.from(repAccMap.values()).map((r) => {
    const showCount = r.shows.size;
    const denomAll = Math.max(r.count + r.cancelled, 1);
    const netProfit = r.revenue - r.cost;
    return {
      id: r.id,
      name: r.name,
      count: r.count,
      revenue: r.revenue,
      avgDeal: r.count > 0 ? r.revenue / r.count : 0,
      showCount,
      unitsPerShow: showCount > 0 ? r.count / showCount : r.count, // store reps (no show) → fallback to raw units
      cancelRate: r.cancelled / denomAll,
      netProfit,
      marginPerShow: showCount > 0 ? netProfit / showCount : netProfit,
      allocatedCost: r.cost,
      score: 0,
    };
  });

  // Z-score the metrics across all reps in the period, then combine.
  function zscore(values: number[]): number[] {
    if (values.length === 0) return [];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    return values.map((v) => (v - mean) / std);
  }
  // Weights now mirror the original Show Leaderboard formula since we have
  // real margin data: margin_per_show 0.40 + units_per_show 0.25 + avg_sale
  // 0.20 - cancel_rate 0.05. lift_attach (0.15) still dropped — line_items
  // not reliable. The 0.15 redistributed to revenue weighting via the larger
  // margin signal it now carries.
  const REP_WEIGHTS = { marginPerShow: 0.40, unitsPerShow: 0.25, avgDeal: 0.20, cancelRate: 0.05 };
  const zMargin = zscore(repMetrics.map((m) => m.marginPerShow));
  const zUps = zscore(repMetrics.map((m) => m.unitsPerShow));
  const zAvg = zscore(repMetrics.map((m) => m.avgDeal));
  const zCx  = zscore(repMetrics.map((m) => m.cancelRate));
  repMetrics.forEach((m, i) => {
    m.score =
      REP_WEIGHTS.marginPerShow * zMargin[i] +
      REP_WEIGHTS.unitsPerShow * zUps[i] +
      REP_WEIGHTS.avgDeal * zAvg[i] -
      REP_WEIGHTS.cancelRate * zCx[i];
  });

  // Sort by composite score (desc). Tie-break by revenue so the order is stable.
  repMetrics.sort((a, b) => b.score - a.score || b.revenue - a.revenue);
  const reps = repMetrics;

  // Shows breakdown
  type ShowEntry = {
    id: string;
    name: string;
    venue_name: string | null;
    city: string | null;
    state: string | null;
    start_date?: string;
    count: number;
    revenue: number;
    deposits: number;
    cost: number | null;
    profit: number | null;
  };
  const showMap = new Map<string, ShowEntry>();
  for (const c of okRows) {
    const showRef = c.show ?? null;
    // Skip showroom / store sales (no show_id). They appear under Locations
    // — Shows Performance is only for actual show events.
    if (!showRef?.id) continue;
    const showId = showRef.id;
    const existing = showMap.get(showId) ?? {
      id: showId,
      name: showRef.name ?? "Unknown",
      venue_name: showRef.venue_name ?? null,
      city: showRef.city ?? null,
      state: showRef.state ?? null,
      start_date: showRef.start_date,
      count: 0, revenue: 0, deposits: 0, cost: null, profit: null,
    };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    existing.deposits += c.deposit_paid ?? 0;
    showMap.set(showId, existing);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (showsInPeriod ?? []) as any[]) {
    const cost = s.total_cost == null ? null : Number(s.total_cost);
    const existing = showMap.get(s.id) ?? {
      id: s.id, name: s.name, venue_name: s.venue_name ?? null, city: s.city ?? null, state: s.state ?? null,
      start_date: s.start_date, count: 0, revenue: 0, deposits: 0, cost: null, profit: null,
    };
    if (!existing.venue_name && s.venue_name) existing.venue_name = s.venue_name;
    if (!existing.city && s.city) existing.city = s.city;
    if (!existing.state && s.state) existing.state = s.state;
    existing.cost = cost != null && !Number.isNaN(cost) ? cost : null;
    showMap.set(s.id, existing);
  }
  // True per-show profit = revenue - per-deal COGS (sum of contracts.cost
  // at this show) - booth/staffing overhead (show.total_cost).
  for (const entry of showMap.values()) {
    const contractCost = contractCostByShowId.get(entry.id) ?? 0;
    if (entry.cost != null) {
      entry.profit = entry.revenue - contractCost - entry.cost;
    } else if (contractCost > 0) {
      entry.profit = entry.revenue - contractCost;
    } else {
      entry.profit = null;
    }
  }
  const shows = Array.from(showMap.values()).sort((a, b) => {
    if (a.profit != null && b.profit != null) return b.profit - a.profit;
    if (a.profit != null) return -1;
    if (b.profit != null) return 1;
    return b.revenue - a.revenue;
  });

  // Venue rollup — multiple shows at the same venue collapse to a single row.
  // Robert wants to compare venues by AVG profit per show, since visit counts
  // vary across venues and total profit favors the most-visited venues.
  type VenueEntry = {
    venue: string;
    showCount: number;
    showsWithCost: number;
    contractCount: number;
    revenue: number;
    revenueWithCost: number;
    cost: number;
    profit: number | null;
    avgProfitPerShow: number | null;
  };
  const venueMap = new Map<string, VenueEntry>();
  for (const sh of showMap.values()) {
    const key = sh.venue_name ?? sh.name;
    const existing = venueMap.get(key) ?? {
      venue: key,
      showCount: 0,
      showsWithCost: 0,
      contractCount: 0,
      revenue: 0,
      revenueWithCost: 0,
      cost: 0,
      profit: null,
      avgProfitPerShow: null,
    };
    existing.showCount += 1;
    existing.contractCount += sh.count;
    existing.revenue += sh.revenue;
    if (sh.cost != null) {
      existing.cost += sh.cost;
      existing.revenueWithCost += sh.revenue;
      existing.showsWithCost += 1;
    }
    venueMap.set(key, existing);
  }
  for (const v of venueMap.values()) {
    v.profit = v.showsWithCost > 0 ? v.revenueWithCost - v.cost : null;
    v.avgProfitPerShow = v.profit != null ? v.profit / v.showsWithCost : null;
  }
  const venues = Array.from(venueMap.values()).sort((a, b) => {
    if (a.avgProfitPerShow != null && b.avgProfitPerShow != null) {
      return b.avgProfitPerShow - a.avgProfitPerShow;
    }
    if (a.avgProfitPerShow != null) return -1;
    if (b.avgProfitPerShow != null) return 1;
    return b.revenue - a.revenue;
  });

  // Locations
  type LocEntry = {
    id: string;
    name: string;
    venueName: string | null;
    city: string | null;
    state: string | null;
    type: string;
    count: number;
    revenue: number;
  };
  const locMap = new Map<string, LocEntry>();
  for (const c of okRows) {
    const showRef = c.show;
    const locRef = c.location;
    const locId = showRef?.id ? `show-${showRef.id}` : (locRef?.id ?? "none");
    const locName = showRef?.name ?? locRef?.name ?? "Unknown";
    const venueName = showRef?.venue_name ?? null;
    const city = showRef?.city ?? null;
    const state = showRef?.state ?? null;
    const locType = showRef?.id ? "show" : (locRef?.type ?? "store");
    const existing = locMap.get(locId) ?? { id: locId, name: locName, venueName, city, state, type: locType, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    if (!existing.venueName && venueName) existing.venueName = venueName;
    if (!existing.city && city) existing.city = city;
    if (!existing.state && state) existing.state = state;
    locMap.set(locId, existing);
  }
  const locations = Array.from(locMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Top products (main products only)
  // Historical contracts backfilled from Lori's XLSX use {name, unit_price}
  // while new Salta-created contracts use {product_name, sell_price}. Accept
  // BOTH shapes so the historical $2M+ in line-items doesn't read as $0.
  type LineItem = {
    product_id?: string;
    product_name?: string;
    name?: string;
    quantity?: number;
    sell_price?: number;
    unit_price?: number;
  };
  const productIdsOnContracts = Array.from(new Set(
    okRows.flatMap((c) => (Array.isArray(c.line_items) ? c.line_items : []).map((i: LineItem) => i.product_id).filter(Boolean) as string[])
  ));
  const { data: productCategoryRows } = productIdsOnContracts.length
    ? await supabase.from("products").select("id, category").in("id", productIdsOnContracts)
    : { data: [] };
  const categoryByProductId = new Map<string, string>();
  for (const r of (productCategoryRows ?? []) as Array<{ id: string; category: string | null }>) {
    if (r.category) categoryByProductId.set(r.id, r.category);
  }

  const productMap = new Map<string, { units: number; revenue: number; allocatedCost: number }>();
  let mainUnits = 0;
  let mainRevenue = 0;
  let accessoryRevenue = 0;
  for (const c of okRows) {
    const items: LineItem[] = Array.isArray(c.line_items) ? c.line_items : [];
    // Allocate the contract's REAL per-deal COGS (contracts.cost from Lori
    // XLSX) proportionally across the main line items based on each line's
    // share of contract total.
    const contractCost = Number(c.cost ?? 0);
    const contractTotal = c.total ?? 0;
    for (const item of items) {
      const name = item.product_name ?? item.name ?? "Unknown";
      const cat = item.product_id ? categoryByProductId.get(item.product_id) : null;
      const qty = item.quantity ?? 1;
      const price = item.sell_price ?? item.unit_price ?? 0;
      const lineTotal = price * qty;
      const lineCostShare = contractTotal > 0 && Number.isFinite(contractCost)
        ? (lineTotal / contractTotal) * contractCost
        : 0;
      if (isMainProduct(cat)) {
        mainUnits += qty;
        mainRevenue += lineTotal;
        if (name && name !== "Unknown") {
          const existing = productMap.get(name) ?? { units: 0, revenue: 0, allocatedCost: 0 };
          existing.units += qty;
          existing.revenue += lineTotal;
          existing.allocatedCost += lineCostShare;
          productMap.set(name, existing);
        }
      } else if (item.product_id && cat) {
        accessoryRevenue += lineTotal;
      }
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, v]) => ({
      name,
      ...v,
      netProfit: v.revenue - v.allocatedCost,
      marginPct: v.revenue > 0 ? ((v.revenue - v.allocatedCost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  const attachPctOfMain = mainRevenue > 0 ? (accessoryRevenue / mainRevenue) * 100 : null;

  // Outstanding
  const signedNoDeposit = outstandingRows.filter(
    (c) => c.status === "signed" || c.status === "deposit_collected"
  ).filter((c) => (c.deposit_paid ?? 0) === 0);
  const pendingSig = outstandingRows.filter((c) => c.status === "pending_signature");
  const totalBalanceDue = outstandingRows.reduce((s, c) => s + (c.balance_due ?? 0), 0);

  // Goal pacing (monthly only)
  let totalGoal: number | null = null;
  let totalGoalPct: number | null = null;
  if (period === "month") {
    const sumGoals = Array.from(goalMap.values()).reduce((s, v) => s + (Number(v) || 0), 0);
    if (sumGoals > 0) {
      totalGoal = sumGoals;
      totalGoalPct = (totalRevenue / sumGoals) * 100;
    }
  }

  // Build snapshot for the insight engine
  const snapshot: AnalyticsSnapshot = {
    period,
    periodLabel: PERIOD_LABELS[period],
    totalRevenue, totalDeposits, contractCount, avgDeal, netProfit, totalShowCost,
    priorRevenue, priorCount, revDelta,
    cancelCount, cancelTotal, cancelRate,
    velocityMedian, velocityCount,
    mainUnits, mainRevenue, accessoryRevenue, attachPctOfMain,
    reps: reps.map((r) => ({ name: r.name, revenue: r.revenue, count: r.count })),
    shows: shows.map((sh) => ({
      name: sh.name, venue_name: sh.venue_name, revenue: sh.revenue, cost: sh.cost, profit: sh.profit,
    })),
    signedNoDepositCount: signedNoDeposit.length,
    pendingSigCount: pendingSig.length,
    totalBalanceDue,
    totalGoal, totalGoalPct,
  };

  const insights = generateInsights(snapshot);
  const ownerName = (profile?.full_name as string | undefined) ?? "William Downs";
  const now = new Date();

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const ctx: PDFCtx = { doc, y: MARGIN };

  // ── COVER PAGE ──────────────────────────────────────────────────────────
  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 95, "F");

  // Wordmark — corporate legal entity (parent of both divisions). The
  // customer-facing brand "Atlas Spas" appears in section headers below.
  setColor(doc, [255, 255, 255]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(CORPORATE_NAME.toUpperCase(), MARGIN, 25);
  setFill(doc, TEAL);
  doc.rect(MARGIN, 28, 22, 1.2, "F");

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("Analytics Report", MARGIN, 55);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  setColor(doc, [180, 220, 225]);
  doc.text("Owner's edition — health of the company at a glance", MARGIN, 65);

  // Prepared-for plate
  setFill(doc, TEAL);
  doc.rect(0, 110, PAGE_W, 38, "F");
  setColor(doc, [255, 255, 255]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PREPARED FOR", MARGIN, 122);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(ownerName, MARGIN, 135);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${PERIOD_LABELS[period]}`, MARGIN, 143);

  // Company-wide headline on cover — spans both divisions so the owner sees
  // the full picture before drilling in.
  const companyRevenue = totalRevenue + buildingSummary.totalRevenue;
  const spaShare = companyRevenue > 0 ? (totalRevenue / companyRevenue) * 100 : 0;
  const bldShare = companyRevenue > 0 ? (buildingSummary.totalRevenue / companyRevenue) * 100 : 0;
  setColor(doc, SLATE_DARK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("COMPANY REVENUE", MARGIN, 162);
  setColor(doc, SLATE_MED);
  doc.setLineWidth(0.3);
  setDraw(doc, TEAL);
  doc.line(MARGIN, 164, MARGIN + 22, 164);

  // Big combined number
  setColor(doc, NAVY);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(companyRevenue), MARGIN, 178);

  // Division split line
  setColor(doc, SLATE_MED);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Atlas Spas ${formatCurrency(totalRevenue)} (${spaShare.toFixed(0)}%)   ·   Atlas Buildings ${formatCurrency(buildingSummary.totalRevenue)} (${bldShare.toFixed(0)}%)`,
    MARGIN, 185,
  );

  // Headline insight below the combined number
  setColor(doc, SLATE_DARK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("HEADLINE", MARGIN, 200);
  setColor(doc, SLATE_MED);
  setDraw(doc, TEAL);
  doc.line(MARGIN, 202, MARGIN + 14, 202);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  setColor(doc, SLATE_DARK);
  const headlineLines = wrapText(doc, insights.headline, CONTENT_W);
  let hy = 210;
  for (const line of headlineLines) {
    doc.text(line, MARGIN, hy);
    hy += 6;
  }

  // Cover footer (separate from page footer — extra detail)
  setColor(doc, SLATE_MED);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${now.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`,
    MARGIN, PAGE_H - 30
  );
  doc.text(
    "This report reflects live data from Salta as of the moment it was generated.",
    MARGIN, PAGE_H - 25
  );

  // ── EXECUTIVE SUMMARY ──────────────────────────────────────────────────
  doc.addPage();
  ctx.y = MARGIN;
  drawSectionHeader(ctx, "Atlas Spas & Swim Spas", `Executive Summary · ${PERIOD_LABELS[period]}`);

  // 6 KPI cards in a 3-2 grid. Finance Deposits sits immediately left of Total
  // Deposits so the reader sees the financed slice right before its parent.
  const cardW = (CONTENT_W - 6) / 3;
  const cardH = 26;
  const row1Y = ctx.y;
  drawKpiCard(doc, MARGIN, row1Y, cardW, cardH,
    "Gross Revenue", formatCurrency(totalRevenue),
    revDelta == null ? null : { pct: revDelta, positive: revDelta >= 0 },
    revDelta == null ? undefined : "vs prior year",
    TEAL);
  drawKpiCard(doc, MARGIN + cardW + 3, row1Y, cardW, cardH,
    "Finance Deposits", formatCurrency(financeDeposits),
    null,
    financeDeposits > 0
      ? `${Math.round((financeDeposits / Math.max(totalDeposits, 1)) * 100)}% of total deposits`
      : "no financed sales",
    TEAL);
  drawKpiCard(doc, MARGIN + (cardW + 3) * 2, row1Y, cardW, cardH,
    "Total Deposits", formatCurrency(totalDeposits),
    depDelta == null ? null : { pct: depDelta, positive: depDelta >= 0 },
    financeDeposits > 0
      ? `${formatCurrency(cashDeposits)} cash + ${formatCurrency(financeDeposits)} fin`
      : depDelta == null ? undefined : "vs prior year",
    EMERALD);
  const row2Y = row1Y + cardH + 4;
  drawKpiCard(doc, MARGIN, row2Y, cardW, cardH,
    "Contracts", contractCount.toString(),
    cntDelta == null ? null : { pct: cntDelta, positive: cntDelta >= 0 },
    cntDelta == null ? undefined : "vs prior year",
    NAVY);
  drawKpiCard(doc, MARGIN + cardW + 3, row2Y, cardW, cardH,
    "Avg Deal Size", formatCurrency(avgDeal),
    null, contractCount > 0 ? `across ${contractCount} contracts` : undefined,
    AMBER);
  drawKpiCard(doc, MARGIN + (cardW + 3) * 2, row2Y, cardW, cardH,
    "Net Profit", formatCurrency(netProfit),
    null,
    (totalContractCost > 0 || totalShowCost > 0)
      ? `${formatCurrency(totalContractCost)} COGS + ${formatCurrency(totalShowCost)} booth`
      : undefined,
    netProfit >= 0 ? EMERALD : RED);
  ctx.y = row2Y + cardH + 6;

  // Methodology note — one place, applies to every Net Profit number in the
  // report. Avoids repeating the same footnote under each section. Box height
  // is computed from the actual wrapped line count so the second line never
  // spills below the border.
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  const methText = `Note: Net Profit = revenue minus per-deal COGS (spa wholesale, freight, delivery, options - imported from Lori XLSX) and per-show booth/staffing overhead. ${okContractsWithCost}/${contractCount} contracts in this period have real cost data.`;
  // 8mm right padding inside the box — italic metrics underestimate width
  // by a few pixels so the safe gutter is wider than it looks on paper.
  const methLines = wrapText(doc, methText, CONTENT_W - 12);
  const methH = methLines.length * 4 + 4;
  ensureSpace(ctx, methH + 4);
  setFill(doc, [254, 252, 232]);    // light amber
  setDraw(doc, AMBER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, ctx.y, CONTENT_W, methH, 2, 2, "FD");
  setColor(doc, SLATE_DARK);
  let methY = ctx.y + 5;
  for (const ln of methLines) {
    doc.text(ln, MARGIN + 4, methY);
    methY += 4;
  }
  ctx.y += methH + 4;

  // Revenue breakdown summary box
  drawSectionHeader(ctx, "Revenue Breakdown");
  ensureSpace(ctx, 35);
  setDraw(doc, SLATE_LIGHT);
  setFill(doc, [255, 255, 255]);
  doc.roundedRect(MARGIN, ctx.y, CONTENT_W, 30, 2, 2, "FD");
  // Confirmed
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setColor(doc, SLATE_DARK);
  doc.text(`Confirmed Contracts (${confirmedRows.length})`, MARGIN + 4, ctx.y + 9);
  doc.setFont("helvetica", "bold");
  setColor(doc, TEAL);
  doc.text(formatCurrency(confirmedRevenue), MARGIN + CONTENT_W - 4, ctx.y + 9, { align: "right" });
  // Contingent
  doc.setFont("helvetica", "normal");
  setColor(doc, AMBER);
  doc.text(`Contingent Contracts (${contingentCount})`, MARGIN + 4, ctx.y + 17);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(contingentRevenue), MARGIN + CONTENT_W - 4, ctx.y + 17, { align: "right" });
  // Divider
  setDraw(doc, SLATE_LIGHT);
  doc.line(MARGIN + 4, ctx.y + 20, MARGIN + CONTENT_W - 4, ctx.y + 20);
  // Total
  doc.setFont("helvetica", "bold");
  setColor(doc, NAVY);
  doc.text("Total Gross Revenue", MARGIN + 4, ctx.y + 26);
  doc.text(formatCurrency(grossRevenueAll), MARGIN + CONTENT_W - 4, ctx.y + 26, { align: "right" });
  ctx.y += 35;

  // ── HEALTH INDICATORS ──────────────────────────────────────────────────
  drawSectionHeader(ctx, "Health Indicators");
  ensureSpace(ctx, 32);
  const hW = (CONTENT_W - 6) / 3;
  // Cancellations
  drawKpiCard(doc, MARGIN, ctx.y, hW, 26,
    "Cancellations",
    cancelCount === 0 ? "0" : `${cancelCount}`,
    null,
    cancelCount === 0 ? "Clean period" : `${formatCurrency(cancelTotal)} lost · ${cancelRate?.toFixed(1) ?? "—"}% rate`,
    cancelCount === 0 ? EMERALD : RED);
  // Velocity
  drawKpiCard(doc, MARGIN + hW + 3, ctx.y, hW, 26,
    "Sales Velocity",
    velocityMedian != null ? `${velocityMedian.toFixed(1)}d` : "—",
    null,
    velocityCount > 0 ? `${velocityCount} signed deals (median)` : "no signed data",
    TEAL);
  // Attach rate
  drawKpiCard(doc, MARGIN + (hW + 3) * 2, ctx.y, hW, 26,
    "Attach Rate",
    attachPctOfMain != null ? `${attachPctOfMain.toFixed(1)}%` : "—",
    null,
    mainUnits > 0 ? `${formatCurrency(accessoryRevenue)} on ${mainUnits} units` : "no main units",
    AMBER);
  ctx.y += 32;

  // ── SALES REP LEADERBOARD ──────────────────────────────────────────────
  doc.addPage();
  ctx.y = MARGIN;
  drawSectionHeader(
    ctx,
    "Sales Rep Leaderboard",
    `${reps.length} rep${reps.length === 1 ? "" : "s"} · ranked by weighted composite`,
  );
  if (reps.length === 0) {
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "italic");
    setColor(doc, SLATE_MED);
    doc.text("No rep activity in this period.", MARGIN, ctx.y);
    ctx.y += 10;
  } else {
    // Net/Show = rep.netProfit / shows worked, surfaces per-opportunity value
    // (a rep with 5 deals across 1 show is more productive than one with 5
    // deals across 5 shows). Storefront-only reps with no shows render "—".
    const repCols: Column[] = hasCommissions
      ? [
          { label: "#",          x: MARGIN,        w: 6 },
          { label: "Sales Rep",  x: MARGIN + 6,    w: 38 },
          { label: "Deals",      x: MARGIN + 44,   w: 14, align: "right" },
          { label: "Revenue",    x: MARGIN + 58,   w: 26, align: "right" },
          { label: "Avg Deal",   x: MARGIN + 84,   w: 24, align: "right" },
          { label: "Net Profit", x: MARGIN + 108,  w: 26, align: "right" },
          { label: "Net/Show",   x: MARGIN + 134,  w: 18, align: "right" },
          { label: "Commission", x: MARGIN + 152,  w: CONTENT_W - 152, align: "right" },
        ]
      : [
          { label: "#",          x: MARGIN,        w: 6 },
          { label: "Sales Rep",  x: MARGIN + 6,    w: 46 },
          { label: "Deals",      x: MARGIN + 52,   w: 14, align: "right" },
          { label: "Revenue",    x: MARGIN + 66,   w: 30, align: "right" },
          { label: "Avg Deal",   x: MARGIN + 96,   w: 28, align: "right" },
          { label: "Net Profit", x: MARGIN + 124,  w: 30, align: "right" },
          { label: "Net/Show",   x: MARGIN + 154,  w: CONTENT_W - 154, align: "right" },
        ];
    drawTableHeader(ctx, repCols);
    reps.slice(0, 12).forEach((rep, i) => {
      const ratePct = commissionMap.get(rep.id) ?? 0;
      const commissionEarned = ratePct > 0 ? (ratePct / 100) * rep.revenue : null;
      const profitColor: [number, number, number] = rep.netProfit >= 0 ? EMERALD : RED;
      const netPerShow = rep.showCount > 0 ? rep.netProfit / rep.showCount : null;
      const netPerShowColor: [number, number, number] | undefined =
        netPerShow == null ? undefined : netPerShow >= 0 ? EMERALD : RED;
      const cells: { text: string; color?: [number, number, number]; bold?: boolean }[] = [
        { text: `${i + 1}`, color: i === 0 ? AMBER : SLATE_MED, bold: i === 0 },
        { text: rep.name, bold: i === 0 },
        { text: rep.count.toString() },
        { text: formatCurrency(rep.revenue), color: TEAL, bold: true },
        { text: formatCurrency(rep.count > 0 ? rep.revenue / rep.count : 0) },
        { text: formatCurrency(rep.netProfit), color: profitColor, bold: true },
        { text: netPerShow != null ? formatCurrency(netPerShow) : "—", color: netPerShowColor, bold: netPerShow != null },
      ];
      if (hasCommissions) {
        cells.push({ text: commissionEarned != null ? formatCurrency(commissionEarned) : "—", color: commissionEarned != null ? EMERALD : SLATE_MED });
      }
      drawTableRow(ctx, repCols, cells, i % 2 === 0);
    });
  }

  // ── SHOWS PERFORMANCE ──────────────────────────────────────────────────
  ctx.y += 6;
  drawSectionHeader(ctx, "Shows Performance", `${venues.length} venue${venues.length === 1 ? "" : "s"} · ranked by avg profit per show`);
  if (venues.length === 0) {
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "italic");
    setColor(doc, SLATE_MED);
    doc.text("No shows in this period.", MARGIN, ctx.y);
    ctx.y += 10;
  } else {
    const venueCols: Column[] = [
      { label: "Venue",        x: MARGIN,        w: 58 },
      { label: "Shows",        x: MARGIN + 58,   w: 14, align: "right" },
      { label: "Contracts",    x: MARGIN + 72,   w: 18, align: "right" },
      { label: "Revenue",      x: MARGIN + 90,   w: 26, align: "right" },
      { label: "Total Profit", x: MARGIN + 116,  w: 26, align: "right" },
      { label: "Avg/Show",     x: MARGIN + 142,  w: 24, align: "right" },
      { label: "ROI %",        x: MARGIN + 166,  w: CONTENT_W - 166, align: "right" },
    ];
    drawTableHeader(ctx, venueCols);
    venues.slice(0, 30).forEach((venue, i) => {
      const roiVal = venue.cost > 0 && venue.profit != null
        ? (venue.profit / venue.cost) * 100
        : null;
      const roiColor: [number, number, number] | undefined =
        roiVal == null ? undefined : roiVal > 0 ? EMERALD : RED;
      const profitColor: [number, number, number] | undefined =
        venue.profit == null ? undefined : venue.profit >= 0 ? EMERALD : RED;
      const avgColor: [number, number, number] | undefined =
        venue.avgProfitPerShow == null ? undefined : venue.avgProfitPerShow >= 0 ? EMERALD : RED;
      drawTableRow(ctx, venueCols, [
        { text: venue.venue },
        { text: venue.showCount.toString() },
        { text: venue.contractCount.toString() },
        { text: formatCurrency(venue.revenue), color: TEAL, bold: true },
        { text: venue.profit != null ? formatCurrency(venue.profit) : "—", color: profitColor, bold: venue.profit != null },
        { text: venue.avgProfitPerShow != null ? formatCurrency(venue.avgProfitPerShow) : "—", color: avgColor, bold: venue.avgProfitPerShow != null },
        { text: roiVal != null ? `${roiVal.toFixed(0)}%` : "—", color: roiColor, bold: roiVal != null },
      ], i % 2 === 0);
    });
  }

  // ── LOCATIONS ──────────────────────────────────────────────────────────
  ctx.y += 6;
  drawSectionHeader(ctx, "Locations");
  if (locations.length === 0) {
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "italic");
    setColor(doc, SLATE_MED);
    doc.text("No location data for this period.", MARGIN, ctx.y);
    ctx.y += 10;
  } else {
    const locCols: Column[] = [
      { label: "Location",   x: MARGIN,        w: 75 },
      { label: "Type",       x: MARGIN + 75,   w: 18 },
      { label: "Contracts",  x: MARGIN + 93,   w: 22, align: "right" },
      { label: "Revenue",    x: MARGIN + 115,  w: 32, align: "right" },
      { label: "Net Profit", x: MARGIN + 147,  w: CONTENT_W - 147, align: "right" },
    ];
    drawTableHeader(ctx, locCols);
    // Pre-index show cost by show.id so we can compute per-location net profit
    // for show-type rows. Store-type rows have no cost data (yet) → render "—".
    const showProfitByLocId = new Map<string, number | null>();
    for (const sh of shows) showProfitByLocId.set(`show-${sh.id}`, sh.profit);
    locations.forEach((loc, i) => {
      const cityState = loc.city && loc.state
        ? `${loc.city}, ${loc.state}`
        : (loc.city ?? loc.state ?? null);
      const displayName = loc.venueName && cityState
        ? `${loc.venueName} — ${cityState}`
        : (loc.venueName ?? cityState ?? loc.name);
      const profit = showProfitByLocId.get(loc.id) ?? null;
      const profitColor: [number, number, number] | undefined =
        profit == null ? undefined : profit >= 0 ? EMERALD : RED;
      drawTableRow(ctx, locCols, [
        { text: displayName },
        { text: loc.type },
        { text: loc.count.toString() },
        { text: formatCurrency(loc.revenue), color: TEAL, bold: true },
        {
          text: profit != null ? formatCurrency(profit) : "—",
          color: profitColor,
          bold: profit != null,
        },
      ], i % 2 === 0);
    });
  }

  // ── TOP PRODUCTS ───────────────────────────────────────────────────────
  ctx.y += 6;
  drawSectionHeader(ctx, "Top Products", "Main units only");
  if (topProducts.length === 0) {
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "italic");
    setColor(doc, SLATE_MED);
    doc.text("No product data for this period.", MARGIN, ctx.y);
    ctx.y += 10;
  } else {
    const prodCols: Column[] = [
      { label: "#",          x: MARGIN,        w: 6 },
      { label: "Product",    x: MARGIN + 6,    w: 78 },
      { label: "Units",      x: MARGIN + 84,   w: 16, align: "right" },
      { label: "Revenue",    x: MARGIN + 100,  w: 28, align: "right" },
      { label: "Net Profit", x: MARGIN + 128,  w: 28, align: "right" },
      { label: "Margin",     x: MARGIN + 156,  w: CONTENT_W - 156, align: "right" },
    ];
    drawTableHeader(ctx, prodCols);
    topProducts.forEach((p, i) => {
      const profitColor: [number, number, number] = p.netProfit >= 0 ? EMERALD : RED;
      drawTableRow(ctx, prodCols, [
        { text: `${i + 1}`, color: SLATE_MED },
        { text: p.name, bold: i === 0 },
        { text: p.units.toString() },
        { text: formatCurrency(p.revenue), color: TEAL, bold: true },
        { text: formatCurrency(p.netProfit), color: profitColor, bold: true },
        { text: `${p.marginPct.toFixed(1)}%`, color: profitColor },
      ], i % 2 === 0);
    });
    // Per-section profit footnote intentionally removed — single
    // methodology note appears once after Executive Summary.
  }

  // ── OUTSTANDING ITEMS ──────────────────────────────────────────────────
  ctx.y += 6;
  drawSectionHeader(ctx, "Outstanding Items", "Open contracts across all time - not limited to period");
  ensureSpace(ctx, 30);
  const outW = (CONTENT_W - 6) / 3;
  drawKpiCard(doc, MARGIN, ctx.y, outW, 26,
    "Signed, No Deposit", signedNoDeposit.length.toString(),
    null,
    signedNoDeposit.length > 0 ? "highest-risk state" : "all collected",
    signedNoDeposit.length > 0 ? AMBER : EMERALD);
  drawKpiCard(doc, MARGIN + outW + 3, ctx.y, outW, 26,
    "Pending Signature", pendingSig.length.toString(),
    null,
    pendingSig.length > 0 ? "awaiting customer" : "none pending",
    pendingSig.length > 0 ? RED : EMERALD);
  drawKpiCard(doc, MARGIN + (outW + 3) * 2, ctx.y, outW, 26,
    "Total Balance Due", formatCurrency(totalBalanceDue),
    null, "all open contracts", NAVY);
  ctx.y += 32;

  // ── ATLAS BUILDING SYSTEMS ────────────────────────────────────────────
  // The other division. Same period, separate data source. Always renders;
  // if no rows for the period, prints a "no activity" line so the owner sees
  // the section exists.
  doc.addPage();
  ctx.y = MARGIN;
  drawSectionHeader(ctx, "Atlas Building Systems", `${PERIOD_LABELS[period]} · ${buildingSummary.transactionCount} transaction${buildingSummary.transactionCount === 1 ? "" : "s"}`);

  if (buildingSummary.transactionCount === 0) {
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "italic");
    setColor(doc, SLATE_MED);
    doc.text("No building sales recorded in this period.", MARGIN, ctx.y);
    ctx.y += 10;
  } else {
    // Buildings KPIs
    const bW = (CONTENT_W - 6) / 3;
    drawKpiCard(doc, MARGIN, ctx.y, bW, 26,
      "Buildings Revenue", formatCurrency(buildingSummary.totalRevenue),
      null, `${buildingSummary.transactionCount} transactions`, AMBER);
    drawKpiCard(doc, MARGIN + bW + 3, ctx.y, bW, 26,
      "Avg Sale", formatCurrency(buildingSummary.avgSale),
      null, undefined, TEAL);
    drawKpiCard(doc, MARGIN + (bW + 3) * 2, ctx.y, bW, 26,
      "Retail / Wholesale",
      `${Math.round((buildingSummary.retailRevenue / Math.max(buildingSummary.totalRevenue, 1)) * 100)}% / ${Math.round((buildingSummary.wholesaleRevenue / Math.max(buildingSummary.totalRevenue, 1)) * 100)}%`,
      null, `${formatCurrency(buildingSummary.retailRevenue)} / ${formatCurrency(buildingSummary.wholesaleRevenue)}`, EMERALD);
    ctx.y += 32;

    // Top categories
    drawSectionHeader(ctx, "Top Product Categories", "Buildings · by revenue");
    if (buildingSummary.topCategories.length > 0) {
      const catCols: Column[] = [
        { label: "#",        x: MARGIN,        w: 8 },
        { label: "Category", x: MARGIN + 8,    w: 110 },
        { label: "Units",    x: MARGIN + 118,  w: 20, align: "right" },
        { label: "Revenue",  x: MARGIN + 138,  w: CONTENT_W - 138, align: "right" },
      ];
      drawTableHeader(ctx, catCols);
      buildingSummary.topCategories.forEach((c, i) => {
        drawTableRow(ctx, catCols, [
          { text: `${i + 1}`, color: SLATE_MED },
          { text: c.name, bold: i === 0 },
          { text: c.units.toString() },
          { text: formatCurrency(c.revenue), color: TEAL, bold: true },
        ], i % 2 === 0);
      });
    }

    // Top lots / locations
    ctx.y += 6;
    drawSectionHeader(ctx, "Top Lots", "Buildings · by revenue");
    if (buildingSummary.topLocations.length > 0) {
      const locCols: Column[] = [
        { label: "Location",     x: MARGIN,        w: 110 },
        { label: "Transactions", x: MARGIN + 110,  w: 40, align: "right" },
        { label: "Revenue",      x: MARGIN + 150,  w: CONTENT_W - 150, align: "right" },
      ];
      drawTableHeader(ctx, locCols);
      buildingSummary.topLocations.forEach((l, i) => {
        drawTableRow(ctx, locCols, [
          { text: l.name },
          { text: l.count.toString() },
          { text: formatCurrency(l.revenue), color: TEAL, bold: true },
        ], i % 2 === 0);
      });
    }

    // Stock status breakdown
    if (buildingSummary.byStockStatus.length > 0) {
      ctx.y += 6;
      drawSectionHeader(ctx, "Stock Status", "Inventory provenance");
      const stCols: Column[] = [
        { label: "Status",  x: MARGIN,        w: 90 },
        { label: "Count",   x: MARGIN + 90,   w: 40, align: "right" },
        { label: "Revenue", x: MARGIN + 130,  w: CONTENT_W - 130, align: "right" },
      ];
      drawTableHeader(ctx, stCols);
      buildingSummary.byStockStatus.forEach((s, i) => {
        drawTableRow(ctx, stCols, [
          { text: s.status },
          { text: s.count.toString() },
          { text: formatCurrency(s.revenue), color: TEAL, bold: true },
        ], i % 2 === 0);
      });
    }

    // Cost note
    ctx.y += 4;
    ensureSpace(ctx, 10);
    setColor(doc, SLATE_MED);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Cost / profit columns will populate once William Downs Sr. provides cost data.",
      MARGIN, ctx.y,
    );
    ctx.y += 6;
  }

  // ── AI INSIGHTS & RECOMMENDATIONS ─────────────────────────────────────
  doc.addPage();
  ctx.y = MARGIN;
  drawSectionHeader(ctx, "AI Insights & Recommendations", "Generated for William Downs");

  // Headline — box height computed from actual wrapped headline length
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const headWrap = wrapText(doc, insights.headline, CONTENT_W - 12);
  const headBoxH = 8 + headWrap.length * 5 + 3;
  ensureSpace(ctx, headBoxH + 4);
  setFill(doc, SLATE_BG);
  doc.roundedRect(MARGIN, ctx.y, CONTENT_W, headBoxH, 2, 2, "F");
  setColor(doc, NAVY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("HEADLINE", MARGIN + 4, ctx.y + 7);
  setColor(doc, SLATE_DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let hy2 = ctx.y + 13;
  for (const line of headWrap) {
    doc.text(line, MARGIN + 4, hy2);
    hy2 += 5;
  }
  ctx.y += headBoxH + 4;

  // Findings
  setColor(doc, NAVY);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  ensureSpace(ctx, 10);
  doc.text("Findings", MARGIN, ctx.y);
  ctx.y += 6;

  for (const f of insights.findings) {
    // Wrap with 7mm right padding inside the card. Text starts at MARGIN+5,
    // so available width is CONTENT_W-5; wrap to CONTENT_W-12 leaves a safe
    // 7mm gutter even for bold or wide-glyph runs.
    const titleLines = wrapText(doc, f.title, CONTENT_W - 12);
    const bodyLines = wrapText(doc, f.body, CONTENT_W - 12);
    const findingH = 6 + titleLines.length * 5 + 1 + bodyLines.length * 4.5 + 6;
    ensureSpace(ctx, findingH + 2);
    const accent = levelAccent(f.level);

    setDraw(doc, SLATE_LIGHT);
    setFill(doc, [255, 255, 255]);
    doc.roundedRect(MARGIN, ctx.y, CONTENT_W, findingH, 2, 2, "FD");
    setFill(doc, accent);
    doc.rect(MARGIN, ctx.y, 1.8, findingH, "F");

    // Level badge
    setColor(doc, accent);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(f.level.toUpperCase(), MARGIN + 5, ctx.y + 6);

    // Title
    setColor(doc, NAVY);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    let ty = ctx.y + 12;
    for (const line of titleLines) {
      doc.text(line, MARGIN + 5, ty);
      ty += 5;
    }

    // Body
    setColor(doc, SLATE_DARK);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    let by = ty + 1;
    for (const line of bodyLines) {
      doc.text(line, MARGIN + 5, by);
      by += 4.5;
    }

    ctx.y += findingH + 3;
  }

  // Recommendations
  ctx.y += 4;
  ensureSpace(ctx, 14);
  setColor(doc, NAVY);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendations", MARGIN, ctx.y);
  ctx.y += 6;

  insights.recommendations.forEach((r, i) => {
    const priorityColor: [number, number, number] = r.priority === 1 ? RED : r.priority === 2 ? AMBER : SLATE_MED;
    // Text in rec cards starts at MARGIN+17 (after badge + number). Available
    // width is CONTENT_W-17; wrap to CONTENT_W-25 leaves 8mm right gutter so
    // long money strings like "$1,019,041.89" don't blow past the card edge.
    const actionLines = wrapText(doc, r.action, CONTENT_W - 25);
    const rationaleLines = wrapText(doc, r.rationale, CONTENT_W - 25);
    const recH = 6 + actionLines.length * 5 + 1 + rationaleLines.length * 4.3 + 6;
    ensureSpace(ctx, recH + 2);

    setDraw(doc, SLATE_LIGHT);
    setFill(doc, [255, 255, 255]);
    doc.roundedRect(MARGIN, ctx.y, CONTENT_W, recH, 2, 2, "FD");

    // Priority badge
    setFill(doc, priorityColor);
    doc.roundedRect(MARGIN + 4, ctx.y + 3, 11, 6, 1.5, 1.5, "F");
    setColor(doc, [255, 255, 255]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`P${r.priority}`, MARGIN + 9.5, ctx.y + 7, { align: "center" });

    // Number
    setColor(doc, SLATE_MED);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`#${i + 1}`, MARGIN + 17, ctx.y + 7);

    // Action
    setColor(doc, NAVY);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    let ay = ctx.y + 13;
    for (const line of actionLines) {
      doc.text(line, MARGIN + 17, ay);
      ay += 5;
    }

    // Rationale
    setColor(doc, SLATE_MED);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    let ry = ay + 1;
    for (const line of rationaleLines) {
      doc.text(line, MARGIN + 17, ry);
      ry += 4.3;
    }
    ctx.y += recH + 3;
  });

  // ── HOW TO IMPROVE THIS REPORT ────────────────────────────────────────
  // Explicit data-gap roadmap so the owner knows what to gather and what
  // it would unlock. Honest about impact level — not every gap is worth
  // pursuing, but the high-impact ones genuinely change the report.
  doc.addPage();
  ctx.y = MARGIN;
  drawSectionHeader(ctx, "How to Improve This Report", "Data we could gather and what it would unlock");

  // Intro — dynamic-height callout
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const introText = "This report uses every data source currently flowing into Salta. The items below are gaps - filling them changes what the report can show.";
  const introLines = wrapText(doc, introText, CONTENT_W - 12);
  const introH = introLines.length * 4 + 5;
  ensureSpace(ctx, introH + 4);
  setFill(doc, SLATE_BG);
  doc.roundedRect(MARGIN, ctx.y, CONTENT_W, introH, 2, 2, "F");
  setColor(doc, SLATE_DARK);
  let introY = ctx.y + 5;
  for (const ln of introLines) {
    doc.text(ln, MARGIN + 4, introY);
    introY += 4;
  }
  ctx.y += introH + 4;

  type Gap = { impact: "HIGH" | "MEDIUM" | "LOW"; title: string; provide: string; unlocks: string[] };
  const gaps: Gap[] = [
    {
      impact: "HIGH",
      title: "Per-product wholesale cost (COGS)",
      provide: "Per-SKU wholesale cost from Master Spas and from Atlas Building Systems vendors. One CSV row per product model: model name, wholesale price, freight if separate.",
      unlocks: [
        "True gross margins on Top Products (today's 80-90% margins exclude COGS - reality is likely 30-50%)",
        "Per-rep TRUE profit contribution, not just show-cost-adjusted",
        "Identify which products carry the company vs which are loss-leaders",
        "Net Profit KPI becomes accurate, not a show-cost-only proxy",
      ],
    },
    {
      impact: "HIGH",
      title: "Atlas Building Systems unit costs",
      provide: "Cost paid by Atlas to build/acquire each shed/deck/granite-base/pool sold. Could be per-SKU averages or per-transaction COGS.",
      unlocks: [
        "Profit and margin columns in the Buildings section",
        "Combined company net profit across both divisions",
        "Cost-per-category breakdown - is Bargain Barn or Deluxe more profitable per unit?",
      ],
    },
    {
      impact: "HIGH",
      title: "Lead pipeline / quote conversion data",
      provide: "Every quote written - even ones that never converted. Date, customer, sales rep, product quoted, dollar value, ultimate disposition (signed / lost / no-response).",
      unlocks: [
        "Conversion funnel: leads -> quotes -> contracts -> delivered",
        "Per-rep close rate (not just deals closed, but lost too)",
        "Lost-deal analysis: which products / price points lose most",
        "Sales velocity becomes meaningful for store reps (today it's show-biased)",
      ],
    },
    {
      impact: "HIGH",
      title: "Service and chemical revenue",
      provide: "Service call invoices and chemical/parts sales as transactions in Salta - even if just a CSV import. Date, customer, product/service, amount.",
      unlocks: [
        "Recurring revenue picture - the chunk that keeps customers attached",
        "Customer lifetime value: hot tub purchase + N years of chemicals + service",
        "Attach rate becomes meaningful - today it's near-zero because service is invisible",
      ],
    },
    {
      impact: "MEDIUM",
      title: "Show operating-cost breakdown",
      provide: "Booth/space cost, freight, lodging, staffing, lead-gen marketing - per show. Today only one total_cost number per show is tracked.",
      unlocks: [
        "Identify the cost line driving Show ROI (negotiate booth fees, fly fewer staff, etc.)",
        "Compare similar-sized shows on operational efficiency",
        "Forecasting: predict next year's profit per show with better confidence",
      ],
    },
    {
      impact: "MEDIUM",
      title: "Marketing spend by channel and show",
      provide: "Monthly ad spend across Google, Facebook, radio, print, mailers, etc. Attribution to shows where possible.",
      unlocks: [
        "True ROAS per channel - which ad dollars actually drive revenue",
        "Per-show ROI that includes pre-show marketing (today only booth cost)",
        "Identify which channels deserve more budget",
      ],
    },
    {
      impact: "MEDIUM",
      title: "Stock-status completeness",
      provide: "Lori filling the STOCK / AGED STOCK / REPO / BOL column for every building transaction - especially granite bases, pools, concrete (currently blank ~30% of the time).",
      unlocks: [
        "Aged-stock revenue: how much is selling from old inventory vs fresh stock",
        "REPO recovery rate trend",
        "BOL pipeline visibility - revenue committed but not yet shipped",
      ],
    },
    {
      impact: "LOW",
      title: "Full per-rep cost (salary + draws + spiffs)",
      provide: "Each rep's base salary or draw amount + monthly spiffs paid. Today only commission rate is tracked.",
      unlocks: [
        "True contribution margin per rep (revenue - rep cost - allocated overhead)",
        "Identify under-leveraged or over-compensated reps",
      ],
    },
  ];

  for (const g of gaps) {
    const titleLines = wrapText(doc, g.title, CONTENT_W - 32);
    const provideLines = wrapText(doc, `Provide: ${g.provide}`, CONTENT_W - 12);
    // unlocks rendered as bullets - estimate height per bullet
    const bulletLineCounts = g.unlocks.map((u) => wrapText(doc, `* ${u}`, CONTENT_W - 14).length);
    const totalBulletLines = bulletLineCounts.reduce((s, n) => s + n, 0);
    const cardH =
      6                                    // top padding
      + titleLines.length * 5              // title
      + 2
      + provideLines.length * 4            // provide line
      + 3
      + 4                                  // "Unlocks:" subhead
      + totalBulletLines * 4               // bullets
      + 5;                                 // bottom padding
    ensureSpace(ctx, cardH + 3);

    const impactColor = g.impact === "HIGH" ? RED : g.impact === "MEDIUM" ? AMBER : SLATE_MED;
    setDraw(doc, SLATE_LIGHT);
    setFill(doc, [255, 255, 255]);
    doc.roundedRect(MARGIN, ctx.y, CONTENT_W, cardH, 2, 2, "FD");
    setFill(doc, impactColor);
    doc.rect(MARGIN, ctx.y, 1.8, cardH, "F");

    // Impact badge
    setFill(doc, impactColor);
    doc.roundedRect(MARGIN + 5, ctx.y + 3, 18, 6, 1.5, 1.5, "F");
    setColor(doc, [255, 255, 255]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(g.impact, MARGIN + 14, ctx.y + 7, { align: "center" });

    // Title
    setColor(doc, NAVY);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    let ty = ctx.y + 7;
    for (const ln of titleLines) {
      doc.text(ln, MARGIN + 26, ty);
      ty += 5;
    }

    // Provide
    setColor(doc, SLATE_DARK);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    let py = ty + 2;
    for (const ln of provideLines) {
      doc.text(ln, MARGIN + 5, py);
      py += 4;
    }

    // Unlocks subhead
    py += 3;
    setColor(doc, TEAL);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("UNLOCKS", MARGIN + 5, py);
    py += 4;

    // Bullets
    setColor(doc, SLATE_DARK);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const u of g.unlocks) {
      const bulletLines = wrapText(doc, `* ${u}`, CONTENT_W - 14);
      for (const bl of bulletLines) {
        doc.text(bl, MARGIN + 8, py);
        py += 4;
      }
    }

    ctx.y += cardH + 3;
  }

  // Priority hint — dynamic-height callout
  ctx.y += 2;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  const priorityText = "Priority order: COGS data for Spas + Buildings is the single highest-leverage addition - it converts every profit number from estimate to truth.";
  const priorityLines = wrapText(doc, priorityText, CONTENT_W - 12);
  const priorityH = priorityLines.length * 4 + 5;
  ensureSpace(ctx, priorityH + 4);
  setFill(doc, [254, 252, 232]);
  setDraw(doc, AMBER);
  doc.roundedRect(MARGIN, ctx.y, CONTENT_W, priorityH, 2, 2, "FD");
  setColor(doc, SLATE_DARK);
  let priorityY = ctx.y + 5;
  for (const ln of priorityLines) {
    doc.text(ln, MARGIN + 4, priorityY);
    priorityY += 4;
  }
  ctx.y += priorityH + 4;

  // Closing note — dynamic-height navy banner, centered text
  ctx.y += 4;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  const closingText = "Insights generated from live Salta data. Numbers are exact. Recommendations are data-grounded suggestions — final judgment is yours.";
  const closingLines = wrapText(doc, closingText, CONTENT_W - 12);
  const closingH = closingLines.length * 4.5 + 6;
  ensureSpace(ctx, closingH + 2);
  setFill(doc, NAVY);
  doc.roundedRect(MARGIN, ctx.y, CONTENT_W, closingH, 2, 2, "F");
  setColor(doc, [255, 255, 255]);
  let closingY = ctx.y + 5.5;
  for (const ln of closingLines) {
    doc.text(ln, PAGE_W / 2, closingY, { align: "center" });
    closingY += 4.5;
  }

  // ── FOOTER (every page) ────────────────────────────────────────────────
  // jsPDF has no per-page hook — must stamp after content is done.
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setDraw(doc, SLATE_LIGHT);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    setColor(doc, SLATE_MED);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Confidential — ${CORPORATE_NAME} Internal`, MARGIN, PAGE_H - 9);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
    doc.text(
      `${PERIOD_LABELS[period]} · Prepared for ${ownerName}`,
      PAGE_W / 2, PAGE_H - 9, { align: "center" }
    );
  }

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `analytics-report-${period}-${now.toISOString().split("T")[0]}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
