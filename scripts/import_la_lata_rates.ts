/**
 * Phase LA.4 — Import LATA jurisdiction rates.
 *
 * Source data: scripts/la_lata_data.json — pre-extracted from
 *   /Users/williedowns/Documents/Sales_Tax_Compliance_TX_OK_LA_KS_AR.xlsx
 *   sheet "LA Parish Rates (Detailed)"
 *   (LATA-authoritative, 444 rows, 62 of 64 parishes; last verified 2026-05-28)
 *
 * The JSON is committed so this script needs no Excel parser dep.
 * To refresh: re-run the openpyxl extraction (see scripts/extract_la_lata.py
 * pattern or paste the inline Python from the LA build plan).
 *
 * Maps each row to public.la_lata_jurisdictions via the upsert RPC.
 *
 * Run:
 *   cd ~/Documents/Salta/atlas-platform
 *   bun scripts/import_la_lata_rates.ts
 *
 * Idempotent: ON CONFLICT (parish, jurisdiction_name) DO UPDATE.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Load pre-extracted JSON ──────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(here, "la_lata_data.json");
if (!existsSync(JSON_PATH)) {
  console.error(`Missing ${JSON_PATH}. Re-run the openpyxl extraction first.`);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(JSON_PATH, "utf-8")) as Array<Record<string, unknown>>;
console.log(`── Loaded ${rows.length} rows from ${JSON_PATH} ──`);

// ─── Row classification ──────────────────────────────────────────────────
function classifyKind(juris: string): string {
  const j = juris.toLowerCase();
  if (j.includes("balance of parish")) return "balance";
  if (j.includes("city limits in")) return "cross_parish";
  if (j.includes("within") || j.includes("outside")) return "within_outside";
  if (
    j.includes("edd") ||
    j.includes("tif") ||
    j.includes("annexation") ||
    j.includes(" district") ||
    j.includes(" mall ") ||
    j.includes("hospital") ||
    j.includes("development district") ||
    j.includes("megapark")
  ) {
    return "special";
  }
  return "city";
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    // Already ISO-ish (YYYY-MM-DD) or convertible
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return v;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[%,\s]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

// ─── Import ───────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  let inserted = 0;
  let failed = 0;
  const kindCounts: Record<string, number> = {};

  for (const r of rows) {
    const parish = (r["Parish"] as string | null)?.trim();
    const juris = (r["Jurisdiction Name"] as string | null)?.trim();
    if (!parish || !juris) {
      failed++;
      continue;
    }
    const kind = classifyKind(juris);
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;

    const combinedLocal = toNumber(r["Combined Local Rate"]);
    const stateRate = toNumber(r["State Rate"]) ?? 0.05;
    const totalRate = toNumber(r["Total Rate"]);

    if (combinedLocal === null || totalRate === null) {
      console.warn(`  ✗ ${parish} / ${juris}: missing rates`);
      failed++;
      continue;
    }
    // Math sanity check
    if (Math.abs(combinedLocal + stateRate - totalRate) > 0.0005) {
      console.warn(
        `  ⚠ ${parish} / ${juris}: combined+state (${combinedLocal + stateRate}) != total (${totalRate}) — using as-is`,
      );
    }

    const { error } = await supabase.rpc("upsert_la_lata_jurisdiction", {
      in_parish: parish,
      in_jurisdiction: juris,
      in_lata_column: (r["Column"] as string | null) ?? null,
      in_components: (r["Components Breakdown"] as string | null) ?? null,
      in_combined_local: combinedLocal,
      in_state: stateRate,
      in_total: totalRate,
      in_kind: kind,
      in_effective_date: toIsoDate(r["Effective Date"]),
      in_source_url: (r["Source URL"] as string | null) ?? null,
      in_verified_at: toIsoDate(r["Last Verified"]),
      in_notes: (r["Notes"] as string | null) ?? null,
    });
    if (error) {
      console.warn(`  ✗ ${parish} / ${juris}: ${error.message}`);
      failed++;
    } else {
      inserted++;
    }
  }

  console.log(`\n── Results ──`);
  console.log(`  inserted: ${inserted}`);
  console.log(`  failed: ${failed}`);
  console.log(`  by kind:`);
  for (const [k, n] of Object.entries(kindCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${n}`);
  }

  // ── Coverage check ────────────────────────────────────────────────────
  const { data: covered } = await supabase
    .from("la_lata_jurisdictions")
    .select("parish_name");
  const uniqueParishes = new Set((covered ?? []).map((r) => r.parish_name));
  console.log(`\n  Parishes covered: ${uniqueParishes.size} of 64`);
  const expected64 = new Set<string>();
  // Just emit which ones are missing if count != 64
  const { data: allParishes } = await supabase
    .from("la_parishes")
    .select("name");
  for (const p of allParishes ?? []) {
    const stripped = (p.name as string).replace(/\s+Parish$/i, "");
    expected64.add(stripped);
  }
  const missing = [...expected64].filter((p) => !uniqueParishes.has(p));
  if (missing.length > 0) {
    console.log(`  Missing parishes (need manual entry):`);
    for (const p of missing) console.log(`    - ${p}`);
  }

  // ── Spot-check: a few known address resolutions via la_lookup_by_latlng ──
  console.log(`\n── Spot-check the lookup function (lat/lng → rate) ──`);
  const spots = [
    { name: "New Orleans (Jackson Square)", lat: 29.958, lng: -90.064, expectMin: 0.09, expectMax: 0.12 },
    { name: "Baton Rouge (Capitol)",        lat: 30.457, lng: -91.187, expectMin: 0.09, expectMax: 0.12 },
    { name: "Shreveport (downtown)",        lat: 32.513, lng: -93.751, expectMin: 0.09, expectMax: 0.11 },
    { name: "Lafayette (downtown)",         lat: 30.221, lng: -92.025, expectMin: 0.085,expectMax: 0.105 },
    { name: "Lake Charles (downtown)",      lat: 30.228, lng: -93.221, expectMin: 0.085,expectMax: 0.115 },
    { name: "Crowley (Acadia)",             lat: 30.214, lng: -92.375, expectMin: 0.10, expectMax: 0.11 },
  ];
  for (const s of spots) {
    const { data, error } = await supabase.rpc("la_lookup_by_latlng", {
      in_lat: s.lat,
      in_lng: s.lng,
    });
    if (error) {
      console.log(`  ✗ ${s.name}: error ${error.message}`);
      continue;
    }
    const rows = (data ?? []) as Array<{
      jurisdiction_name: string;
      jurisdiction_type: string;
      jurisdiction_rate: number;
    }>;
    const total = rows.reduce((sum, r) => sum + Number(r.jurisdiction_rate), 0);
    const breakdown = rows
      .map((r) => `${r.jurisdiction_name}=${(Number(r.jurisdiction_rate) * 100).toFixed(3)}%`)
      .join(" + ");
    const ok = total >= s.expectMin && total <= s.expectMax;
    console.log(
      `  ${ok ? "✓" : "✗"} ${s.name}: total=${(total * 100).toFixed(3)}% | ${breakdown}`,
    );
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${elapsed}s`);
  if (failed > 0) process.exit(1);
}

await main();
