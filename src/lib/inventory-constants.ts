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
  "LH 6":       "Healthy Living 6",
  "LH 7":       "Healthy Living 7",
  "LH L6":      "Healthy Living L6",
  "LH L7":      "Healthy Living L7",
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
