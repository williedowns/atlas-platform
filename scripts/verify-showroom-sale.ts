// One-shot diagnostic: list today's signed contracts and show where each lands
// in the analytics aggregation (shows breakdown / locations breakdown / KPIs).
// Run: bun scripts/verify-showroom-sale.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env from .env.local
const envText = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

console.log(`\nQuerying contracts created ${todayStart} → ${tomorrowStart}\n`);

const { data: contracts, error } = await supabase
  .from("contracts")
  .select(`
    id, contract_number, total, deposit_paid, status, is_contingent, created_at,
    show:shows(id, name, venue_name, city, state),
    location:locations(id, name, type),
    sales_rep:profiles!contracts_sales_rep_id_fkey(id, full_name)
  `)
  .gte("created_at", todayStart)
  .lt("created_at", tomorrowStart)
  .not("status", "in", '("cancelled","quote","draft")')
  .order("created_at", { ascending: false });

if (error) {
  console.error("Query failed:", error);
  process.exit(1);
}

if (!contracts || contracts.length === 0) {
  console.log("No signed contracts created today.");
  process.exit(0);
}

console.log(`Found ${contracts.length} contract(s) today:\n`);

for (const c of contracts) {
  const show = (c.show as any);
  const loc = (c.location as any);
  const rep = (c.sales_rep as any);
  const showLink = show?.id ? `${show.venue_name ?? show.name} (id=${show.id.slice(0, 8)}...)` : "(no show)";
  const locLink = loc?.id ? `${loc.name} [${loc.type}] (id=${loc.id.slice(0, 8)}...)` : "(no location)";

  console.log(`#${c.contract_number}`);
  console.log(`  status=${c.status}  contingent=${c.is_contingent}  total=$${c.total}  deposit=$${c.deposit_paid}`);
  console.log(`  rep:      ${rep?.full_name ?? "(unassigned)"}`);
  console.log(`  show:     ${showLink}`);
  console.log(`  location: ${locLink}`);

  // Where this contract lands in my analytics aggregations:
  console.log(`  → KPIs (gross revenue, deposits, contracts): YES, +$${c.total} +$${c.deposit_paid} +1`);
  console.log(`  → Rep leaderboard for ${rep?.full_name ?? "Unknown"}: +1 deal, +$${c.total}`);
  if (show?.id) {
    console.log(`  → Shows Performance: appears under "${show.venue_name ?? show.name}"`);
    console.log(`  → Locations: appears under "${show.venue_name ?? show.name}" (type=show)`);
  } else if (loc?.id) {
    console.log(`  → Shows Performance: appears under "Unknown" (no show_id) ⚠️`);
    console.log(`  → Locations: appears under "${loc.name}" (type=${loc.type})`);
  } else {
    console.log(`  → Shows Performance: appears under "Unknown" ⚠️`);
    console.log(`  → Locations: appears under "none" ⚠️`);
  }
  console.log();
}
