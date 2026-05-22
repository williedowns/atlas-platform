// Helpers for the Atlas Building Systems division (separate from spa contracts).
// Sales come from the building_sales table (point-of-sale transactions, no
// deposits/signatures/line_items). Schema fields: sold_at, location_name,
// product_category, product_size, amount, cost, stock_status, channel,
// salesman_name.

import type { SupabaseClient } from "@supabase/supabase-js";

export type BuildingSale = {
  id: string;
  sold_at: string;
  location_name: string;
  product_category: string;
  product_size: string | null;
  amount: number;
  cost: number | null;
  stock_status: string | null;
  channel: "retail" | "wholesale";
  salesman_name: string | null;
};

export type BuildingSummary = {
  rows: BuildingSale[];
  totalRevenue: number;
  transactionCount: number;
  retailRevenue: number;
  wholesaleRevenue: number;
  retailCount: number;
  wholesaleCount: number;
  avgSale: number;
  topCategories: Array<{ name: string; units: number; revenue: number }>;
  topLocations: Array<{ name: string; count: number; revenue: number }>;
  byStockStatus: Array<{ status: string; count: number; revenue: number }>;
};

// Fetch building_sales for the given period. The dates are inclusive of gte,
// exclusive of lt — mirrors the analytics page convention.
export async function fetchBuildingSalesForPeriod(
  supabase: SupabaseClient,
  range: { gte?: string; lte?: string },
): Promise<BuildingSale[]> {
  let query = supabase
    .from("building_sales")
    .select("id, sold_at, location_name, product_category, product_size, amount, cost, stock_status, channel, salesman_name");

  // sold_at is DATE, so range bounds use date strings (YYYY-MM-DD)
  if (range.gte) query = query.gte("sold_at", range.gte.split("T")[0]);
  if (range.lte) query = query.lt("sold_at", range.lte.split("T")[0]);

  // Supabase REST caps at 1000 rows; paginate to be safe.
  const PAGE = 1000;
  const out: BuildingSale[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await query.range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) {
      console.error("[building-sales] fetch error", error);
      break;
    }
    const chunk = (data ?? []) as BuildingSale[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    page += 1;
  }
  return out;
}

// Roll-up summary used by analytics page and PDF.
export function summarizeBuildingSales(rows: BuildingSale[]): BuildingSummary {
  let totalRevenue = 0;
  let retailRevenue = 0;
  let wholesaleRevenue = 0;
  let retailCount = 0;
  let wholesaleCount = 0;

  const catMap = new Map<string, { name: string; units: number; revenue: number }>();
  const locMap = new Map<string, { name: string; count: number; revenue: number }>();
  const stockMap = new Map<string, { status: string; count: number; revenue: number }>();

  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    totalRevenue += amt;
    if (r.channel === "wholesale") {
      wholesaleRevenue += amt;
      wholesaleCount += 1;
    } else {
      retailRevenue += amt;
      retailCount += 1;
    }

    const cat = r.product_category || "Unknown";
    const c = catMap.get(cat) ?? { name: cat, units: 0, revenue: 0 };
    c.units += 1;
    c.revenue += amt;
    catMap.set(cat, c);

    const loc = r.location_name || "Unknown";
    const l = locMap.get(loc) ?? { name: loc, count: 0, revenue: 0 };
    l.count += 1;
    l.revenue += amt;
    locMap.set(loc, l);

    // Lori's XLSX leaves stock_status blank for ~30% of transactions
    // (granite bases, pools, concrete pads typically aren't tagged). Surface
    // that explicitly instead of a bare em-dash so the owner knows the gap
    // is in source-data entry, not the parser.
    const status = (r.stock_status || "").trim() || "Not specified";
    const s = stockMap.get(status) ?? { status, count: 0, revenue: 0 };
    s.count += 1;
    s.revenue += amt;
    stockMap.set(status, s);
  }

  const transactionCount = rows.length;
  const avgSale = transactionCount > 0 ? totalRevenue / transactionCount : 0;

  return {
    rows,
    totalRevenue,
    transactionCount,
    retailRevenue,
    wholesaleRevenue,
    retailCount,
    wholesaleCount,
    avgSale,
    topCategories: Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    topLocations: Array.from(locMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    byStockStatus: Array.from(stockMap.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

export const EMPTY_BUILDING_SUMMARY: BuildingSummary = {
  rows: [],
  totalRevenue: 0,
  transactionCount: 0,
  retailRevenue: 0,
  wholesaleRevenue: 0,
  retailCount: 0,
  wholesaleCount: 0,
  avgSale: 0,
  topCategories: [],
  topLocations: [],
  byStockStatus: [],
};
