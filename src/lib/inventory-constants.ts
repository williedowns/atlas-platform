// ── Atlas Spas Inventory Constants ───────────────────────────────────────────
// Sourced from the Settings tab of the Google Sheets inventory spreadsheet.

/**
 * Maps model_code prefixes (from the spreadsheet) to the DB product category.
 * Used when an inventory unit has no product_id to still resolve its category
 * for picker filtering. Ordered longest-match-first.
 */
export const MODEL_CODE_CATEGORY_PREFIXES: { prefix: string; category: string }[] = [
  // Clarity Series
  { prefix: "C Bal",  category: "Clarity Series" },
  { prefix: "C Prec", category: "Clarity Series" },
  { prefix: "C ",     category: "Clarity Series" },
  // Twilight Series
  { prefix: "TS ",    category: "Twilight Series" },
  // LH / Healthy Living Series
  { prefix: "LH ",    category: "LH Series" },
  // Getaway Series
  { prefix: "G Bar",  category: "Getaway Series" },
  { prefix: "G Och",  category: "Getaway Series" },
  { prefix: "G ",     category: "Getaway Series" },
  // MP Legend Series (hot tub)
  { prefix: "MP L",   category: "MP Legend Series" },
  // Michael Phelps Swim Spas (LSX = Legend Swim Spa)
  { prefix: "LSX",    category: "Michael Phelps Swim Spas" },
  // H2X Swim Spas
  { prefix: "X T",    category: "H2X Trainer Swim Spas" },
  { prefix: "X Ch",   category: "H2X Challenger Swim Spas" },
  { prefix: "X Hot",  category: "H2X Therapool Swim Spas" },
  { prefix: "X ",     category: "H2X Trainer Swim Spas" },
  // Chilly Goat Cold Tubs
  { prefix: "CGA",    category: "MP Chilly Goat Cold Tubs" },
  { prefix: "CG ",    category: "MP Chilly Goat Cold Tubs" },
  // Sweaty Goat Saunas
  { prefix: "SG ",    category: "MP Sweaty Goat Saunas" },
];

/** Returns the best-match DB category for a raw spreadsheet model_code, or null. */
export function getCategoryForModelCode(modelCode?: string | null): string | null {
  if (!modelCode) return null;
  const code = modelCode.trim();
  for (const { prefix, category } of MODEL_CODE_CATEGORY_PREFIXES) {
    if (code.startsWith(prefix)) return category;
  }
  return null;
}

/**
 * Maps raw spreadsheet model_codes to clean display names consistent with
 * the product catalog (QuickBooks / product table `name` field).
 * Covers the most common models — falls back to model_code if not found.
 */
export const MODEL_CODE_DISPLAY_NAMES: Record<string, string> = {
  // Clarity Series
  "C Bal 6":    "Clarity Balance 6",
  "C Bal 6 CS": "Clarity Balance 6 CS",
  "C Bal 7":    "Clarity Balance 7",
  "C Bal 8":    "Clarity Balance 8",
  "C Bal 9":    "Clarity Balance 9",
  "C Prec 7":   "Clarity Precision 7",
  // Twilight Series
  "TS 7.2":     "Twilight Series 7.2",
  "TS 7.25":    "Twilight Series 7.25",
  "TS 8.2":     "Twilight Series 8.2",
  "TS 8.25":    "Twilight Series 8.25",
  "TS 240X":    "Twilight Series 240X",
  // LH / Healthy Living
  "LH 5":       "Healthy Living 5",
  "LH 6":       "Healthy Living 6",
  "LH 7":       "Healthy Living 7",
  "LH L5":      "Healthy Living L5",
  "LH L6":      "Healthy Living L6",
  "LH L7":      "Healthy Living L7",
  "LH S6":      "Healthy Living S6",
  "LH S7":      "Healthy Living S7",
  // Getaway Series
  "G BarH LE":  "Getaway Bar Harbor LE",
  "G BarH SE":  "Getaway Bar Harbor SE",
  "G Ocho CS":  "Getaway Ocho CS",
  "G Ocho SE":  "Getaway Ocho SE",
  // MP Legend Series
  "MP L":       "MP Legend",
  // Michael Phelps Swim Spas
  "LSX 700":    "MP Legend Swim Spa 700",
  "LSX 800":    "MP Legend Swim Spa 800",
  "LSX 850":    "MP Legend Swim Spa 850",
  "LSX 900":    "MP Legend Swim Spa 900",
  // H2X Swim Spas
  "X T15D":     "H2X Trainer 15D",
  "X T19D":     "H2X Trainer 19D",
  "X T19D MAX": "H2X Trainer 19D MAX",
  "X T21D":     "H2X Trainer 21D",
  "X Ch15D":    "H2X Challenger 15D",
  // Chilly Goat
  "CGA Terrain":         "Chilly Goat Terrain",
  "CGA Glacier":         "Chilly Goat Glacier",
  "CG Valaris Terrain":  "Chilly Goat Valaris Terrain",
  // Sweaty Goat
  "SG MP 3":    "Sweaty Goat MP 3",
};

/** Returns a clean display name for a model_code, falling back to the raw code. */
export function getModelDisplayName(modelCode?: string | null): string {
  if (!modelCode) return "—";
  return MODEL_CODE_DISPLAY_NAMES[modelCode.trim()] ?? modelCode;
}

export const PRODUCT_LINES = [
  "Clarity",
  "Healthy Living",
  "Twilight Series",
  "MP Legend",
  "H2X",
  "MP Swim Spa",
  "Getaway",
  "Chilly Goat",
  "Sweaty Goat",
] as const;

export type ProductLine = (typeof PRODUCT_LINES)[number];

export const SHELL_COLORS = [
  "Sterling Silver",
  "Midnight Canyon",
  "Tuscan Sun",
  "Storm",
  "Smoky",
  "Mist",
  "White",
  "Sea Salt",
  "Pebble",
  "Grey",
  "Sierra",
  "N/A",
] as const;

export const CABINET_COLORS: { code: string; name: string }[] = [
  { code: "GRAPH",  name: "Graphite Grey" },
  { code: "GRAPH2", name: "Graphite Grey 2" },
  { code: "ESP",    name: "Espresso" },
  { code: "MID",    name: "Midnight" },
  { code: "MID2",   name: "Midnight 2" },
  { code: "DWAL2",  name: "Dark Walnut 2" },
  { code: "TAN",    name: "Tan" },
  { code: "GREY",   name: "Grey" },
  { code: "CSTONE", name: "Cobblestone" },
  { code: "N/A",    name: "N/A" },
];

export const UNIT_TYPES: { value: string; label: string; description: string }[] = [
  { value: "stock",         label: "New In-Stock",       description: "New unit in warehouse" },
  { value: "factory_build", label: "New Factory Build",  description: "Ordered new from factory for this customer" },
  { value: "floor_model",   label: "Floor Model",        description: "Display unit — reduced price" },
  { value: "blem",          label: "Blem / AS IS",       description: "Blemished or AS IS unit — no warranty" },
  { value: "wet_model",     label: "Wet Model",          description: "Showroom wet demo unit" },
];

export const INVENTORY_STATUSES: { value: string; label: string; color: string }[] = [
  { value: "on_order",    label: "On Order",    color: "secondary" },
  { value: "in_factory",  label: "In Factory",  color: "warning" },
  { value: "in_transit",  label: "In Transit",  color: "warning" },
  { value: "at_location", label: "At Location", color: "success" },
  { value: "at_show",     label: "At Show",     color: "default" },
  { value: "allocated",   label: "Allocated",   color: "warning" },
  { value: "delivered",   label: "Delivered",   color: "success" },
];

export const WRAP_STATUSES = [
  { value: "WR", label: "Wrapped" },
  { value: "UN", label: "Unwrapped" },
] as const;

export const SUB_LOCATIONS = [
  "Floor",
  "Backroom",
  "Warehouse",
  "Home Office",
  "Canton",
  "Storage",
] as const;

// Which product line categories in the DB are "spa" products (have serial numbers)
export const SPA_CATEGORIES = new Set([
  "MP Legend Series",
  "Twilight Series",
  "Clarity Series",
  "Getaway Series",
  "LH Series",
  "Michael Phelps Swim Spas",
  "H2X Trainer Swim Spas",
  "H2X Therapool Swim Spas",
  "H2X Challenger Swim Spas",
  "MP Chilly Goat Cold Tubs",
  "H2X Cold Tub",
  "MP Sweaty Goat Saunas",
]);

export function isSpaProduct(category: string): boolean {
  return SPA_CATEGORIES.has(category);
}

// Main product categories — used for revenue leaderboards (Top Products) so
// add-ons / accessories / fees / options don't pollute the ranking. Includes
// the specific Master Spas series + pool families plus generic top-level types
// (Willie 04-29) so non-Master-Spas / custom / future line items still rank.
export const MAIN_PRODUCT_CATEGORIES = new Set<string>([
  ...SPA_CATEGORIES,
  // Pool families
  "Latham Fiberglass Pools",
  "Barrier Reef Fiberglass Pools",
  "Above-Ground Pools",
  // Generic top-level product types — used for ad-hoc / non-Master-Spas line items
  "Hot Tub",
  "Swim Spa",
  "BBQ Island",
  "Sauna",
  "Cold Tub",
  "Above Ground Pool",
]);

/** Returns true if a product category is a "main" product (hot tub, swim spa,
 *  cold tub, sauna, or pool) — i.e. a unit-of-sale, not an accessory/option/fee. */
export function isMainProduct(category?: string | null): boolean {
  if (!category) return false;
  return MAIN_PRODUCT_CATEGORIES.has(category);
}

export function getStatusColor(status: string): "default" | "success" | "warning" | "destructive" | "secondary" {
  const found = INVENTORY_STATUSES.find((s) => s.value === status);
  return (found?.color as any) ?? "secondary";
}

export function getUnitTypeLabel(unitType: string): string {
  return UNIT_TYPES.find((t) => t.value === unitType)?.label ?? unitType;
}

export function getCabinetName(code: string): string {
  return CABINET_COLORS.find((c) => c.code === code)?.name ?? code;
}

// ── Per-model availability ──────────────────────────────────────────────────
// Only show shell/cabinet/option choices that Master Spas actually offers for
// the selected model. Source: masterspas.com (researched 2026-05-01).
//
// Naming aliases (Master Spas marketing → existing app constants):
//   "Sterling Silver Marble" → "Sterling Silver"
//   "Storm Cloud"            → "Storm"
//   "Smoky Mountain"         → "Smoky"
//   "Pebble Beach"           → "Pebble"
//   "Dark Walnut"            → cabinet code DWAL2
//   "Graphite" / "Graphite Grey" → cabinet codes GRAPH and GRAPH2 (both kept
//      because Master Spas labels vary across pages and our seed data uses both)
//   "Midnight"               → cabinet codes MID and MID2 (same reason)
//
// Models not in these maps fall back to ALL colors / ALL options (current
// behavior) — incremental rollout, won't block sales of unmapped SKUs.

const TWILIGHT_AND_LSX_LARGE_SHELLS = [
  "Sterling Silver", "White", "Tuscan Sun", "Midnight Canyon", "Storm", "Smoky",
] as const;

const STANDARD_PREMIUM_CABINETS = ["DWAL2", "GRAPH", "GRAPH2", "MID", "MID2"] as const;

const CLARITY_BALANCE_SMALL_SHELLS = [
  "Sterling Silver", "White", "Tuscan Sun", "Midnight Canyon", "Storm",
] as const;

const CLARITY_BALANCE_9_SHELLS = ["Sterling Silver", "Tuscan Sun", "Midnight Canyon"] as const;

const LSX_900_SHELLS = ["Sterling Silver", "Tuscan Sun", "Midnight Canyon"] as const;

const LH_SHELLS = ["White", "Sterling Silver"] as const;

const GETAWAY_SHELLS = ["Sea Salt", "Pebble"] as const;
const GETAWAY_CABINETS = ["DWAL2", "GRAPH", "GRAPH2"] as const;

const H2X_SHELLS = ["Sterling Silver", "White"] as const;
const H2X_CABINETS = ["DWAL2", "GRAPH", "GRAPH2"] as const;

/** model_code → list of valid shell color names (subset of SHELL_COLORS). */
export const MODEL_VALID_SHELL_COLORS: Record<string, readonly string[]> = {
  // Twilight Series — all 5 models share the same 6-color set
  "TS 7.2":     TWILIGHT_AND_LSX_LARGE_SHELLS,
  "TS 7.25":    TWILIGHT_AND_LSX_LARGE_SHELLS,
  "TS 8.2":     TWILIGHT_AND_LSX_LARGE_SHELLS,
  "TS 8.25":    TWILIGHT_AND_LSX_LARGE_SHELLS,
  "TS 240X":    TWILIGHT_AND_LSX_LARGE_SHELLS,
  // Clarity — Balance 6/6CS/7/8 share 5 shells (no Smoky)
  "C Bal 6":    CLARITY_BALANCE_SMALL_SHELLS,
  "C Bal 6 CS": CLARITY_BALANCE_SMALL_SHELLS,
  "C Bal 7":    CLARITY_BALANCE_SMALL_SHELLS,
  "C Bal 8":    CLARITY_BALANCE_SMALL_SHELLS,
  // Clarity Balance 9 — only 3 shells published
  "C Bal 9":    CLARITY_BALANCE_9_SHELLS,
  // Clarity Precision 7 — full 6-shell set
  "C Prec 7":   TWILIGHT_AND_LSX_LARGE_SHELLS,
  // Healthy Living — 2 shells across the line
  "LH L5":      LH_SHELLS,
  "LH L6":      LH_SHELLS,
  "LH L7":      LH_SHELLS,
  "LH S6":      LH_SHELLS,
  "LH S7":      LH_SHELLS,
  // Getaway — Bar Harbor + Ocho Rios LE/SE/CS share 2 shells
  "G BarH LE":  GETAWAY_SHELLS,
  "G BarH SE":  GETAWAY_SHELLS,
  "G Ocho CS":  GETAWAY_SHELLS,
  "G Ocho SE":  GETAWAY_SHELLS,
  // MP Legend Series (Master Spas LSX 700/800/850 — same 6 shells as Twilight)
  "LSX 700":    TWILIGHT_AND_LSX_LARGE_SHELLS,
  "LSX 800":    TWILIGHT_AND_LSX_LARGE_SHELLS,
  "LSX 850":    TWILIGHT_AND_LSX_LARGE_SHELLS,
  // LSX 900 — only 3 shells
  "LSX 900":    LSX_900_SHELLS,
  // H2X Swim Spas
  "X T15D":     H2X_SHELLS,
  "X T19D":     H2X_SHELLS,
  "X T19D MAX": H2X_SHELLS,
  "X T21D":     H2X_SHELLS,
  "X Ch15D":    H2X_SHELLS,
};

/** model_code → list of valid cabinet codes (subset of CABINET_COLORS codes). */
export const MODEL_VALID_CABINET_CODES: Record<string, readonly string[]> = {
  // Twilight + Clarity + LH + Legend share the same standard premium cabinet set
  "TS 7.2":     STANDARD_PREMIUM_CABINETS,
  "TS 7.25":    STANDARD_PREMIUM_CABINETS,
  "TS 8.2":     STANDARD_PREMIUM_CABINETS,
  "TS 8.25":    STANDARD_PREMIUM_CABINETS,
  "TS 240X":    STANDARD_PREMIUM_CABINETS,
  "C Bal 6":    STANDARD_PREMIUM_CABINETS,
  "C Bal 6 CS": STANDARD_PREMIUM_CABINETS,
  "C Bal 7":    STANDARD_PREMIUM_CABINETS,
  "C Bal 8":    STANDARD_PREMIUM_CABINETS,
  "C Bal 9":    STANDARD_PREMIUM_CABINETS,
  "C Prec 7":   STANDARD_PREMIUM_CABINETS,
  "LH L5":      STANDARD_PREMIUM_CABINETS,
  "LH L6":      STANDARD_PREMIUM_CABINETS,
  "LH L7":      STANDARD_PREMIUM_CABINETS,
  "LH S6":      STANDARD_PREMIUM_CABINETS,
  "LH S7":      STANDARD_PREMIUM_CABINETS,
  "LSX 700":    STANDARD_PREMIUM_CABINETS,
  "LSX 800":    STANDARD_PREMIUM_CABINETS,
  "LSX 850":    STANDARD_PREMIUM_CABINETS,
  "LSX 900":    STANDARD_PREMIUM_CABINETS,
  // Getaway — no Midnight cabinets
  "G BarH LE":  GETAWAY_CABINETS,
  "G BarH SE":  GETAWAY_CABINETS,
  "G Ocho CS":  GETAWAY_CABINETS,
  "G Ocho SE":  GETAWAY_CABINETS,
  // H2X — Dark Walnut + Graphite Grey only
  "X T15D":     H2X_CABINETS,
  "X T19D":     H2X_CABINETS,
  "X T19D MAX": H2X_CABINETS,
  "X T21D":     H2X_CABINETS,
  "X Ch15D":    H2X_CABINETS,
};

/**
 * model_code → list of case-insensitive substring patterns matched against
 * option product `name`. An option product is shown only if at least one
 * pattern matches — UNLESS the model has no entry here, in which case the
 * existing line-level filter is used (show-all fallback).
 *
 * Starts empty: option product names live in the live DB (imported from a
 * Google Sheet), not in code. Populate per model as the catalog stabilizes.
 */
export const MODEL_VALID_OPTION_PATTERNS: Record<string, readonly string[]> = {
  // Example shape (kept commented until DB option names are confirmed):
  // "TS 240X": ["Cover Lift", "Spa Step", "Salt System", "Audio", "Ozonator"],
};

/** Returns valid shell color names for a model — falls back to all if unmapped. */
export function getValidShellColors(modelCode?: string | null): readonly string[] {
  if (!modelCode) return SHELL_COLORS;
  return MODEL_VALID_SHELL_COLORS[modelCode.trim()] ?? SHELL_COLORS;
}

/** Returns valid cabinet entries for a model — falls back to all if unmapped. */
export function getValidCabinets(modelCode?: string | null): { code: string; name: string }[] {
  if (!modelCode) return CABINET_COLORS;
  const codes = MODEL_VALID_CABINET_CODES[modelCode.trim()];
  if (!codes) return CABINET_COLORS;
  return CABINET_COLORS.filter((c) => codes.includes(c.code));
}

/** Returns true if an add-on option product is available for a model.
 *  - No model selected → true (show all)
 *  - Model has no entry in the option map → true (show all, line-level filter still applies upstream) */
export function isOptionAvailableForModel(productName: string, modelCode?: string | null): boolean {
  if (!modelCode) return true;
  const patterns = MODEL_VALID_OPTION_PATTERNS[modelCode.trim()];
  if (!patterns || patterns.length === 0) return true;
  const lower = productName.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}
