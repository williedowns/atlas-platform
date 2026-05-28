"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { Product, DiscountType, ContractDiscount } from "@/types";
import { isSpaProduct, isOptionAvailableForModel } from "@/lib/inventory-constants";
import { InventoryUnitPicker } from "@/components/contracts/InventoryUnitPicker";
import { GRANITE_PRICE_TIERS, GRANITE_PRODUCT_ID, isSpaWithDimensions } from "@/lib/granite";
import { isOutTheDoorDiscount } from "@/lib/discounts";
import { decideShipToAddress } from "@/lib/tax/sourcingDecision";

interface Step3ProductsProps {
  onNext: () => void;
}

const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: "factory_rebate", label: "Factory Rebate" },
  { value: "floor_model", label: "Floor Model" },
  { value: "military", label: "Military" },
  { value: "show_special", label: "Show Special" },
  { value: "manager_override", label: "Manager Override" },
  { value: "other", label: "Other" },
];

// Map DB categories → top-level product lines for the picker
// Organized to match masterspas.com navigation: Hot Tubs → Swim Spas → Cold Tubs → Saunas
const PRODUCT_LINES: { label: string; section: string; logoUrl: string; categories: string[] }[] = [
  // ── HOT TUBS ────────────────────────────────────────────────────────────
  {
    label: "MP Legend Series",
    section: "Hot Tubs",
    logoUrl: "/logos/ms/mpl.svg",
    categories: ["MP Legend Series"],
  },
  {
    label: "Twilight Series",
    section: "Hot Tubs",
    logoUrl: "/logos/ms/twilight.svg",
    categories: ["Twilight Series"],
  },
  {
    label: "Clarity Series",
    section: "Hot Tubs",
    logoUrl: "/logos/ms/clarity.svg",
    categories: ["Clarity Series"],
  },
  {
    label: "Getaway Series",
    section: "Hot Tubs",
    logoUrl: "/logos/ms/getaway.svg",
    categories: ["Getaway Series"],
  },
  {
    label: "LH Series",
    section: "Hot Tubs",
    logoUrl: "/logos/ms/lh.svg",
    categories: ["LH Series"],
  },
  // ── SWIM SPAS ────────────────────────────────────────────────────────────
  {
    label: "Michael Phelps Swim Spas",
    section: "Swim Spas",
    logoUrl: "/logos/ms/mpss.svg",
    categories: ["Michael Phelps Swim Spas"],
  },
  {
    label: "H2X Swim Spas",
    section: "Swim Spas",
    logoUrl: "/logos/ms/h2x.svg",
    categories: ["H2X Trainer Swim Spas", "H2X Therapool Swim Spas", "H2X Challenger Swim Spas"],
  },
  // ── COLD TUBS ────────────────────────────────────────────────────────────
  {
    label: "Chilly Goat Cold Tubs",
    section: "Cold Tubs",
    logoUrl: "/logos/chilly-goat.png",
    categories: ["MP Chilly Goat Cold Tubs", "H2X Cold Tub"],
  },
  // ── SAUNAS ────────────────────────────────────────────────────────────────
  {
    label: "Sweaty Goat Saunas",
    section: "Saunas",
    logoUrl: "/logos/sweaty-goat.webp",
    categories: ["MP Sweaty Goat Saunas"],
  },
  // ── POOLS (added 2026-04-28) ──────────────────────────────────────────────
  {
    label: "Latham Fiberglass",
    section: "Pools",
    logoUrl: "/logos/latham.svg",
    categories: ["Latham Fiberglass Pools"],
  },
  {
    label: "Barrier Reef Fiberglass",
    section: "Pools",
    logoUrl: "/logos/barrier-reef.svg",
    categories: ["Barrier Reef Fiberglass Pools"],
  },
  {
    label: "Above-Ground Pools",
    section: "Pools",
    logoUrl: "/logos/above-ground.svg",
    categories: ["Above-Ground Pools"],
  },
];

const OPTIONS_CATEGORIES = [
  "Other Options",
  "MP/H2X Options",
  "Clarity Series Options",
  "Twilight Options",
  "MP Legend Options",
];

// Which option categories are relevant for each product line
const LINE_OPTION_CATEGORIES: Record<string, string[]> = {
  "MP Legend Series":          ["MP Legend Options", "Other Options"],
  "Twilight Series":           ["Twilight Options", "Other Options"],
  "Clarity Series":            ["Clarity Series Options", "Other Options"],
  "Getaway Series":            ["Other Options"],
  "LH Series":                 ["Other Options"],
  "Michael Phelps Swim Spas":  ["MP/H2X Options", "Other Options"],
  "H2X Swim Spas":             ["MP/H2X Options", "Other Options"],
  "Chilly Goat Cold Tubs":     ["Other Options"],
  "Sweaty Goat Saunas":        ["Other Options"],
};

// Within "Other Options", items starting with HT_ are hot-tub-only,
// items starting with SS_ are swim-spa-only, others are universal.
const HOT_TUB_LINES = new Set([
  "MP Legend Series", "Twilight Series", "Clarity Series", "Getaway Series", "LH Series",
]);
const SWIM_SPA_LINES = new Set([
  "Michael Phelps Swim Spas", "H2X Swim Spas",
]);

// White Glove Packages — one tap adds the standard items every order
// includes (delivery, steps, chemical kit, locking cover, free LED package,
// and free WiFi when eligible). UI convenience only; the bundle fans out to
// existing product rows so QBO still bills them individually. Product UUIDs
// verified against products table 2026-05-26 (LED + WiFi added 2026-05-28).
// Items added carry from_package so the contract.created audit log notes which
// package the rep applied (extracted in /api/contracts/route.ts at submission).
//
// LED Lighting Package — included free on every spa White Glove Package.
// WiFi Module — included free on Twilight Series hot tubs AND every swim
// spa White Glove Package. Twilight detection happens at click time by
// inspecting the current cart for a Twilight Series line item.
const LED_PRODUCT_ID = "a4f1c2d8-3e7b-4f5a-9c2e-1d8a7b3f0e91";
const WIFI_PRODUCT_ID = "b5e2d3a9-4f8c-4a6b-0d3f-2e9b8c4a1f02";

type WhiteGloveKey = "hot_tub" | "swim_spa";
const WHITE_GLOVE_PACKAGES: Record<WhiteGloveKey, {
  label: string;
  sublabel: string;
  product_ids: string[];
  total: number;
}> = {
  hot_tub: {
    label: "Hot Tub White Glove Package",
    sublabel: "Delivery · Steps · Chemical Kit · Locking Cover · Free LED · Free WiFi on Twilights & LSX",
    product_ids: [
      "e65e5127-1609-4468-a537-a5863f5fc22f", // HT Delivery — $600
      "f5c56f80-077c-40b5-9db5-b0cb80ef1e1a", // HT Steps — $149
      "6258ae1e-930d-409c-8319-bdd1895673d2", // Start Up Chemical Kit — $149
      "641557eb-94f1-4c28-abee-b302ffd513ba", // HT Deluxe Taper Locking Cover — $599
      LED_PRODUCT_ID,                          // LED Lighting Package — $650 (free)
      // WiFi appended conditionally in handleAddPackage when a Twilight is in cart.
    ],
    total: 2147,
  },
  swim_spa: {
    label: "Swim Spa White Glove Package",
    sublabel: "Delivery · Steps · Chemical Kit · Locking Cover · Free LED · Free WiFi",
    product_ids: [
      "e8fb26d2-a7a1-40e5-9abd-0445d62867ad", // Swim Spa Delivery — $1,500
      "b658294a-699d-40b7-9dc4-fbedd819f3ef", // SS Steps — $599
      "6258ae1e-930d-409c-8319-bdd1895673d2", // Start Up Chemical Kit — $149
      "ebf0ab0d-cbdc-4509-9e7f-9459e39a227c", // SS Deluxe Taper Locking Cover — $1,499
      LED_PRODUCT_ID,                          // LED Lighting Package — $650 (free)
      WIFI_PRODUCT_ID,                         // WiFi Module — $500 (free)
    ],
    total: 4897,
  },
};

function filterOtherOption(productName: string, selectedLine: string | null): boolean {
  const name = productName.toUpperCase();
  const isHtItem = name.startsWith("HT ");
  const isSsItem = name.startsWith("SS ");
  if (!isHtItem && !isSsItem) return true; // universal — always show
  if (!selectedLine) return true;
  if (isHtItem) return HOT_TUB_LINES.has(selectedLine);
  if (isSsItem) return SWIM_SPA_LINES.has(selectedLine);
  return true;
}

export default function Step3Products({ onNext }: Step3ProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [lineCollapsed, setLineCollapsed] = useState(false);
  const [modelCollapsed, setModelCollapsed] = useState(false);
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("show_special");
  const [discountAmount, setDiscountAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState(""); // final price customer was promised — computes discount
  const [calcConfirmation, setCalcConfirmation] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [taxCalculating, setTaxCalculating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState("");
  const [pendingRemoveItemIdx, setPendingRemoveItemIdx] = useState<number | null>(null);
  const [pendingRemoveDiscountIdx, setPendingRemoveDiscountIdx] = useState<number | null>(null);

  const { addLineItem, addLineItemWithUnit, addBlemLineWithoutUnit, markBlemPhotosViewed, removeLineItem, addDiscount, removeDiscount, setTax, updateLineItemPrice, updateLineItemColors, setDocFeeWaived, addGraniteForSpas } = useContractStore();
  const draft = useContractStore((s) => s.draft);

  // Inventory unit picker state
  const [pickerProduct, setPickerProduct] = useState<{ product: Product; price: number } | null>(null);
  const taxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name");
      if (data) setProducts(data as Product[]);
      setLoading(false);
    }
    fetchProducts();
  }, []);

  const calculateTax = useCallback(async () => {
    if (draft.line_items.length === 0) { setTax(0, 0); return; }
    setTaxCalculating(true);
    try {
      // Cross-state sourcing: if the customer is in a covered state different
      // from the show/location state, use the customer's address for tax —
      // destination wins over origin per Avalara consultation 2026-05-28.
      const shipTo = decideShipToAddress({
        customer: draft.customer ?? null,
        show: draft.show ?? null,
        location: draft.location ?? null,
      });
      const response = await fetch("/api/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_items: draft.line_items,
          discounts: draft.discounts,
          show_id: draft.show_id,
          location_id: draft.location_id,
          // Optional explicit override (built by decideShipToAddress when the
          // customer differs from the venue). Falls back server-side to the
          // raw customer_* fields, then to the venue address.
          ship_to_address: shipTo,
          customer_state: draft.customer?.state ?? null,
          customer_address: draft.customer?.address ?? null,
          customer_city: draft.customer?.city ?? null,
          customer_zip: draft.customer?.zip ?? null,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.flat_rate) {
          console.info(`[tax] Using flat-rate fallback (${(data.tax_rate * 100).toFixed(2)}%) until Avalara is connected`);
        }
        // When /api/tax returns a high-confidence lookup result, it includes
        // audit fields (tax_rate_source / _effective_date / _jurisdictions).
        // Capture them in the draft so they flow through to /api/contracts
        // and /api/quotes per migration 098.
        const hasAudit =
          typeof data.tax_rate_source === "string" ||
          Array.isArray(data.tax_rate_jurisdictions);
        if (hasAudit) {
          setTax(data.total_tax ?? 0, data.tax_rate ?? 0, {
            source: typeof data.tax_rate_source === "string" ? data.tax_rate_source : null,
            effective_date:
              typeof data.tax_rate_effective_date === "string"
                ? data.tax_rate_effective_date
                : null,
            jurisdictions: Array.isArray(data.tax_rate_jurisdictions)
              ? data.tax_rate_jurisdictions
              : null,
          });
        } else {
          setTax(data.total_tax ?? 0, data.tax_rate ?? 0);
        }
      } else {
        const errBody = await response.json().catch(() => ({}));
        console.error("[tax] API error", response.status, errBody);
      }
    } catch (err) {
      console.error("[tax] Network/unexpected error:", err);
    } finally {
      setTaxCalculating(false);
    }
  }, [
    draft.line_items,
    draft.discounts,
    draft.location,
    draft.show,
    // Customer address fields drive the cross-state sourcing decision. When
    // the customer's state/address changes, re-run the calc so ship_to_address
    // gets re-evaluated and the tax updates.
    draft.customer?.state,
    draft.customer?.address,
    draft.customer?.city,
    draft.customer?.zip,
    draft.show_id,
    draft.location_id,
    setTax,
  ]);

  useEffect(() => {
    if (taxTimeoutRef.current) clearTimeout(taxTimeoutRef.current);
    taxTimeoutRef.current = setTimeout(calculateTax, 500);
    return () => { if (taxTimeoutRef.current) clearTimeout(taxTimeoutRef.current); };
  }, [calculateTax]);

  function collapseAfterModelAdd() {
    setModelCollapsed(true);
    setShowOptions(true);
  }

  function handleAddProduct(product: Product, price: number, waived = false) {
    if (product.id === GRANITE_PRODUCT_ID) {
      // Granite is opt-in but still locked per spa: build one line per spa
      // currently in the cart, with quantity = each spa's longest side.
      const spasInCart = draft.line_items
        .map((li) => products.find((p) => p.id === li.product_id))
        .filter((p): p is Product => !!p && isSpaWithDimensions(p));
      addGraniteForSpas(spasInCart, waived ? 0 : price);
      const flashKey = product.id + "-" + (waived ? "waived" : price);
      setAddedFlash(flashKey);
      setTimeout(() => setAddedFlash(null), 800);
      return;
    }
    addLineItem(product, price, waived);
    const flashKey = product.id + "-" + (waived ? "waived" : price);
    setAddedFlash(flashKey);
    setTimeout(() => setAddedFlash(null), 800);
    // Collapse model list and open add-ons only for main spa products (not add-ons)
    if (isSpaProduct(product.category ?? "")) collapseAfterModelAdd();
  }

  function handleSpaAdd(product: Product, price: number) {
    if (isSpaProduct(product.category ?? "")) {
      setPickerProduct({ product, price });
    } else {
      handleAddProduct(product, price);
    }
  }

  function handleAddPackage(key: WhiteGloveKey) {
    const pkg = WHITE_GLOVE_PACKAGES[key];
    const existingIds = new Set(draft.line_items.map((li) => li.product_id));
    // Tag each item with from_package so the contract.created audit log can
    // report which White Glove Packages the rep applied at submission time.
    const packageTag = key === "hot_tub" ? "hot_tub_white_glove" : "swim_spa_white_glove";

    // Build the effective product_ids list. Hot Tub White Glove conditionally
    // appends WiFi when an eligible model is already in the cart. WiFi is
    // free on all Twilight Series and all LSX (Michael Phelps Legend Series)
    // hot tubs per Willie 2026-05-28. The codebase currently maps the LSX
    // prefix to category "Michael Phelps Swim Spas" while masterspas.com
    // lists those same SKUs as Legend Series HOT TUBS — so the conditional
    // accepts BOTH `MP Legend Series` and `Michael Phelps Swim Spas` as
    // qualifying hot tub categories to stay correct regardless of which
    // bucket the SKU lands in. Swim Spa White Glove already includes WiFi
    // unconditionally for every swim spa category.
    const WIFI_ELIGIBLE_HOT_TUB_CATEGORIES = new Set([
      "Twilight Series",
      "MP Legend Series",
      "Michael Phelps Swim Spas",
    ]);
    const effectiveIds = [...pkg.product_ids];
    if (key === "hot_tub") {
      const cartProducts = draft.line_items.map((li) =>
        products.find((p) => p.id === li.product_id)
      );
      const hasWifiEligibleSpa = cartProducts.some(
        (p) => !!p?.category && WIFI_ELIGIBLE_HOT_TUB_CATEGORIES.has(p.category)
      );
      if (hasWifiEligibleSpa) effectiveIds.push(WIFI_PRODUCT_ID);
    }

    for (const pid of effectiveIds) {
      if (existingIds.has(pid)) continue;
      const product = products.find((p) => p.id === pid);
      if (!product) continue;
      // White Glove items default to waived (FREE) — they're a sales gesture
      // showing the customer the value they're getting at no cost. Rep can
      // edit any individual item's price afterward if needed.
      addLineItem(product, product.msrp, true, undefined, undefined, packageTag);
    }
    setAddedFlash(`package-${key}`);
    setTimeout(() => setAddedFlash(null), 800);
  }

  function handleAddDiscount() {
    const amount = parseFloat(discountAmount);
    if (isNaN(amount) || amount <= 0) return;
    const selectedType = DISCOUNT_TYPES.find((d) => d.value === discountType);
    const discount: ContractDiscount = {
      type: discountType,
      label: selectedType?.label ?? "Discount",
      amount,
      requires_approval: discountType === "manager_override",
    };
    addDiscount(discount);
    setDiscountAmount("");
    setShowDiscountForm(false);
  }

  // Discount Calculator: rep enters the items subtotal target — the price
  // before doc fees and before tax (matches the "Subtotal after discount"
  // row in the cart). We solve for the discount that lands there.
  // Per Alex 2026-05-24: reps think in pre-tax subtotal, not all-in OTD.
  //
  //   I = items subtotal, F = doc fee (0 if waived), S = I + F = draft.subtotal
  //   D = discount, target = desired items subtotal after discount
  //
  //   D = I − target = (S − F) − target
  //
  // Same formula for taxable and tax-exempt — target is pre-tax pre-fee.
  function computeCalculatedDiscount(target: number): number | null {
    if (isNaN(target) || target <= 0) return null;
    const F = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
    const itemsSubtotal = draft.subtotal - F;
    const discountAmt = Math.round((itemsSubtotal - target) * 100) / 100;
    if (discountAmt <= 0 || discountAmt >= itemsSubtotal) return null;
    return discountAmt;
  }

  function handleApplyCalculatedDiscount() {
    const target = parseFloat(targetPrice);
    const discountAmt = computeCalculatedDiscount(target);
    if (discountAmt === null) return;
    if (draft.discounts.some((d) => isOutTheDoorDiscount(d.label))) {
      setCalcError(
        "An out-the-door discount is already applied. Remove the existing one before adding another.",
      );
      setTimeout(() => setCalcError(null), 4000);
      return;
    }
    const discount: ContractDiscount = {
      type: "show_special",
      label: `Calculated to $${target.toFixed(2)} out-the-door`,
      amount: discountAmt,
      requires_approval: false,
    };
    addDiscount(discount);
    setCalcConfirmation(`Applied $${discountAmt.toFixed(2)} discount → subtotal after discount $${target.toFixed(2)}`);
    setTargetPrice("");
    setCalcError(null);
    setTimeout(() => setCalcConfirmation(null), 2500);
  }

  // Products for selected line
  const lineCategories = selectedLine
    ? PRODUCT_LINES.find((l) => l.label === selectedLine)?.categories ?? []
    : [];

  const lineProducts = products.filter((p) =>
    lineCategories.includes(p.category ?? "")
  );

  // Group line products by sub-category
  const groupedLine = lineProducts.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // Add-on options — filtered to only categories relevant to the selected product line
  const relevantOptionCategories = selectedLine
    ? (LINE_OPTION_CATEGORIES[selectedLine] ?? OPTIONS_CATEGORIES)
    : OPTIONS_CATEGORIES;

  // Most-recently-added spa drives per-model option filtering — sales rep picks
  // the tub first, then add-ons; if nothing is in cart yet, fall back to all.
  const lastSpaModelCode: string | null = (() => {
    for (let i = draft.line_items.length - 1; i >= 0; i--) {
      const li = draft.line_items[i];
      const prod = products.find((p) => p.id === li.product_id);
      if (prod && isSpaProduct(prod.category ?? "") && prod.model_code) return prod.model_code;
    }
    return null;
  })();

  const hasSpaInCart = draft.line_items.some((li) => {
    const prod = products.find((p) => p.id === li.product_id);
    return prod ? isSpaWithDimensions(prod) : false;
  });

  const optionProducts = products.filter((p) => {
    if (!relevantOptionCategories.includes(p.category ?? "")) return false;
    if (p.category === "Other Options" && !filterOtherOption(p.name, selectedLine)) return false;
    // Granite is locked per spa — hide from the picker until at least one spa is in cart.
    if (p.id === GRANITE_PRODUCT_ID && !hasSpaInCart) return false;
    return isOptionAvailableForModel(p.name, lastSpaModelCode);
  });
  const groupedOptions = optionProducts.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-[#00929C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-lg text-slate-500">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 3 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">What are they buying?</h2>
        <p className="text-sm text-slate-500 mt-1">Pick a product line, choose a model, add options.</p>
      </div>

      {/* Cart summary */}
      {draft.line_items.length > 0 && (
        <Card className="border-[#00929C]/20 bg-[#00929C]/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#00929C] uppercase tracking-wide mb-3">
              Selected ({draft.line_items.length})
            </h3>
            <div className="space-y-2">
              {draft.line_items.map((item, index) => {
                const isGranite = item.linked_spa_product_id !== undefined;
                return (
                <div key={`${item.product_id}-${index}`} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-medium text-slate-900 block truncate">{item.product_name}</span>
                    {isGranite ? (
                      <span className="text-xs text-slate-500">{item.quantity} ft (locked to spa size)</span>
                    ) : (item.inventory_unit_id || item.shell_color || item.cabinet_color) && (
                      <span className="text-xs text-slate-500">
                        {item.serial_number ? `S/N: ${item.serial_number}` : item.inventory_unit_id ? "Unit selected" : ""}
                        {item.shell_color ? `${item.serial_number || item.inventory_unit_id ? " · " : ""}${item.shell_color}` : ""}
                        {item.cabinet_color ? ` · ${item.cabinet_color} cabinet` : ""}
                        {item.unit_type ? ` · ${item.unit_type.replace(/_/g, " ")}` : ""}
                      </span>
                    )}
                  </div>

                  {/* Price — granite uses a $135/$140/$145 dropdown; everything else taps to edit */}
                  {isGranite ? (
                    <select
                      value={item.sell_price}
                      onChange={(e) => updateLineItemPrice(index, parseFloat(e.target.value))}
                      className="h-9 px-2 rounded-lg border-2 border-[#00929C] bg-white text-sm font-semibold focus:outline-none touch-manipulation"
                    >
                      {GRANITE_PRICE_TIERS.map((p) => (
                        <option key={p} value={p}>${p}/ft</option>
                      ))}
                    </select>
                  ) : item.waived ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-400 line-through">{formatCurrency(item.msrp)}</span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">FREE</span>
                    </div>
                  ) : editingPriceIdx === index ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      autoFocus
                      value={editingPriceVal}
                      onChange={(e) => setEditingPriceVal(e.target.value)}
                      onBlur={() => {
                        const parsed = parseFloat(editingPriceVal);
                        if (!isNaN(parsed) && parsed >= 0) updateLineItemPrice(index, parsed);
                        setEditingPriceIdx(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingPriceIdx(null);
                      }}
                      className="w-24 h-9 px-2 rounded-lg border-2 border-[#00929C] bg-white text-sm font-semibold text-right focus:outline-none touch-manipulation"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPriceIdx(index);
                        setEditingPriceVal(item.sell_price.toFixed(2));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation group"
                    >
                      <span className="text-base font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(item.sell_price)}</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00929C] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}

                  {pendingRemoveItemIdx === index ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => { removeLineItem(index); setPendingRemoveItemIdx(null); }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 touch-manipulation"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRemoveItemIdx(null)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 touch-manipulation"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingRemoveItemIdx(index)}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 touch-manipulation"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product line picker — collapsed chip or full grid */}
      {lineCollapsed && selectedLine ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-[#00929C] bg-[#00929C]/5">
          {(() => {
            const activeLine = PRODUCT_LINES.find((l) => l.label === selectedLine);
            return activeLine ? (
              <img
                src={activeLine.logoUrl}
                alt={activeLine.label}
                className="h-7 w-auto object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : null;
          })()}
          <span className="flex-1 text-sm font-semibold text-[#00929C] truncate">{selectedLine}</span>
          <svg className="w-4 h-4 text-[#00929C] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <button
            type="button"
            onClick={() => { setLineCollapsed(false); setModelCollapsed(false); }}
            className="flex-shrink-0 text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 touch-manipulation"
          >
            Change
          </button>
        </div>
      ) : (
        (["Hot Tubs", "Swim Spas", "Cold Tubs", "Saunas", "Pools"] as const).map((section) => {
          const sectionLines = PRODUCT_LINES.filter((l) => l.section === section);
          const visibleLines = sectionLines.filter((l) =>
            products.some((p) => l.categories.includes(p.category ?? ""))
          );
          if (visibleLines.length === 0) return null;
          return (
            <div key={section}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{section}</h3>
              <div className="grid grid-cols-2 gap-3">
                {visibleLines.map((line) => {
                  const isSelected = selectedLine === line.label;
                  return (
                    <button
                      key={line.label}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedLine(null);
                          setLineCollapsed(false);
                          setModelCollapsed(false);
                        } else {
                          setSelectedLine(line.label);
                          setLineCollapsed(true);
                          setModelCollapsed(false);
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 text-left touch-manipulation transition-all active:scale-[0.98] min-h-[90px] ${
                        isSelected
                          ? "border-[#00929C] bg-[#00929C]/8 shadow-sm"
                          : "border-slate-200 bg-white hover:border-[#00929C]/40"
                      }`}
                    >
                      <img
                        src={line.logoUrl}
                        alt={line.label}
                        className="h-8 w-auto object-contain mb-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className={`text-xs font-semibold text-center leading-tight ${isSelected ? "text-[#00929C]" : "text-slate-600"}`}>
                        {line.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Models for selected line — collapsed chip or full list */}
      {selectedLine && lineProducts.length > 0 && (
        modelCollapsed ? (
          <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50">
            <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="flex-1 text-sm font-semibold text-emerald-700">Model added to cart</span>
            <button
              type="button"
              onClick={() => setModelCollapsed(false)}
              className="flex-shrink-0 text-xs font-semibold text-emerald-700 border border-emerald-400 rounded-lg px-3 py-1.5 hover:bg-emerald-100 touch-manipulation"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {selectedLine} — Select Model
            </h3>
            <div className="space-y-4">
              {Object.entries(groupedLine).map(([cat, catProducts]) => (
                <div key={cat}>
                  {Object.keys(groupedLine).length > 1 && (
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{cat}</p>
                  )}
                  <div className="space-y-2">
                    {catProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          {product.sku && <p className="text-xs text-slate-400 mt-0.5">{product.sku}</p>}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSpaAdd(product, product.msrp)}
                            className={`h-11 px-4 rounded-lg text-sm font-bold transition-all touch-manipulation active:scale-[0.97] ${
                              addedFlash === product.id + "-" + product.msrp
                                ? "bg-emerald-500 text-white"
                                : "bg-[#00929C] text-white hover:bg-[#007279]"
                            }`}
                          >
                            {addedFlash === product.id + "-" + product.msrp ? "✓" : formatCurrency(product.msrp)}
                          </button>
                          {product.floor_price != null && product.floor_price > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSpaAdd(product, product.floor_price!)}
                              className={`h-11 px-4 rounded-lg text-sm font-bold transition-all touch-manipulation active:scale-[0.97] ${
                                addedFlash === product.id + "-" + product.floor_price
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-700 text-white hover:bg-slate-800"
                              }`}
                            >
                              {addedFlash === product.id + "-" + product.floor_price ? "✓" : `Floor ${formatCurrency(product.floor_price)}`}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Add-ons toggle */}
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-[#00929C] hover:text-[#00929C] transition-colors touch-manipulation"
        >
          <span className="font-semibold">+ Add-Ons & Options</span>
          <svg className={`w-5 h-5 transition-transform ${showOptions ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showOptions && (
          <div className="mt-4 space-y-4">
            {!selectedLine ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Select a product line above to see available add-ons and options.
              </p>
            ) : (
              <>
                {(HOT_TUB_LINES.has(selectedLine) || SWIM_SPA_LINES.has(selectedLine)) && (() => {
                  const key: WhiteGloveKey = HOT_TUB_LINES.has(selectedLine) ? "hot_tub" : "swim_spa";
                  const pkg = WHITE_GLOVE_PACKAGES[key];
                  // Compute the items the package would actually add and price the
                  // CTA at the cost of only those — avoids "Add Package — $1,497"
                  // when 3 of 4 are already in the cart.
                  const missingIds = pkg.product_ids.filter(
                    (pid) => !draft.line_items.some((li) => li.product_id === pid),
                  );
                  const missingTotal = missingIds.reduce((sum, pid) => {
                    const p = products.find((x) => x.id === pid);
                    return sum + (p?.msrp ?? 0);
                  }, 0);
                  const allInCart = missingIds.length === 0;
                  const partial = !allInCart && missingIds.length < pkg.product_ids.length;
                  const flashed = addedFlash === `package-${key}`;
                  return (
                    <div>
                      <p className="text-xs font-semibold text-[#00929C] uppercase tracking-wide mb-2">
                        White Glove Package
                      </p>
                      <div className="rounded-xl border-2 border-[#00929C] bg-[#00929C]/5 p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-slate-900">{pkg.label}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{pkg.sublabel}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-xs font-semibold text-slate-400 line-through">
                              {formatCurrency(pkg.total)}
                            </p>
                            <p className="text-lg font-black text-emerald-600">FREE</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddPackage(key)}
                          disabled={allInCart}
                          className={`w-full h-11 rounded-lg text-sm font-bold transition-all touch-manipulation active:scale-[0.97] ${
                            allInCart
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                              : flashed
                                ? "bg-emerald-500 text-white"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {allInCart
                            ? "✓ Package Added"
                            : flashed
                              ? "✓ Added!"
                              : partial
                                ? `+ Add ${missingIds.length} Missing ${missingIds.length === 1 ? "Item" : "Items"} (Free)`
                                : `+ Add Free Package — ${formatCurrency(pkg.total)} Value`}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {optionProducts.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No add-ons available for this product line.
                  </p>
                ) : (
                  Object.entries(groupedOptions).map(([cat, catProducts]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{cat}</p>
                  <div className="space-y-2">
                    {catProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{product.name}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAddProduct(product, product.msrp)}
                            className={`h-10 px-3 rounded-lg text-sm font-bold transition-all touch-manipulation active:scale-[0.97] ${
                              addedFlash === product.id + "-" + product.msrp
                                ? "bg-emerald-500 text-white"
                                : "bg-[#00929C] text-white hover:bg-[#007279]"
                            }`}
                          >
                            {addedFlash === product.id + "-" + product.msrp ? "✓" : `+ ${formatCurrency(product.msrp)}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddProduct(product, product.msrp, true)}
                            className={`h-10 px-3 rounded-lg text-sm font-bold transition-all touch-manipulation active:scale-[0.97] ${
                              addedFlash === product.id + "-waived"
                                ? "bg-emerald-500 text-white"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {addedFlash === product.id + "-waived" ? "✓" : "Free"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Discount Calculator — enter the pre-tax subtotal target; auto-compute the discount */}
      {draft.line_items.length > 0 && (() => {
        const targetNum = parseFloat(targetPrice);
        const previewDiscount = computeCalculatedDiscount(targetNum);
        const hasInvalidTarget = targetPrice !== "" && !isNaN(targetNum) && targetNum > 0 && previewDiscount === null;
        const docFeeForPreview = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
        const currentItemsAfterDiscount = Math.max(0, draft.subtotal - docFeeForPreview - draft.discount_total);
        const surchargeNote = draft.surcharge_enabled
          ? ` CC surcharge (${(draft.surcharge_rate * 100).toFixed(1)}%) is charged separately at swipe.`
          : "";
        return (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Discount Calculator</h3>
            <p className="text-sm text-slate-500 mb-3">
              Enter the subtotal you want after the discount — before doc fees and tax. We'll work out the discount so "Subtotal after discount" lands exactly there. Doc fee and tax add on top.{surchargeNote}
            </p>
            <Card className="mb-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Current subtotal after discount</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(currentItemsAfterDiscount)}</span>
                </div>
                <Input
                  label="Subtotal target ($, before tax & doc fees)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                />
                {previewDiscount !== null && (
                  <div className="p-3 rounded-lg bg-[#00929C]/10 border border-[#00929C]/30 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Required discount:</span>
                    <span className="text-base font-bold text-[#00929C]">
                      {formatCurrency(previewDiscount)}
                      <span className="text-xs text-slate-500 ml-2 font-normal">
                        ({((previewDiscount / draft.subtotal) * 100).toFixed(1)}% off subtotal)
                      </span>
                    </span>
                  </div>
                )}
                {hasInvalidTarget && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    That subtotal target doesn't produce a valid discount on this cart.
                  </p>
                )}
                {calcConfirmation && (
                  <p className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
                    ✓ {calcConfirmation}
                  </p>
                )}
                {calcError && (
                  <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                    {calcError}
                  </p>
                )}
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  disabled={previewDiscount === null}
                  onClick={handleApplyCalculatedDiscount}
                >
                  Apply as Discount
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Discounts */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">Discounts</h3>
          {!showDiscountForm && (
            <Button variant="outline" size="lg" onClick={() => setShowDiscountForm(true)}>
              Add Discount
            </Button>
          )}
        </div>

        {showDiscountForm && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                >
                  {DISCOUNT_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Amount ($)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="default" size="lg" className="flex-1" onClick={handleAddDiscount} disabled={!discountAmount || parseFloat(discountAmount) <= 0}>
                  Add
                </Button>
                <Button variant="ghost" size="lg" onClick={() => { setShowDiscountForm(false); setDiscountAmount(""); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {draft.discounts.length > 0 && (
          <div className="space-y-2">
            {draft.discounts.map((discount, index) => (
              <div key={`${discount.type}-${index}`} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50">
                <span className="text-base font-medium text-slate-900 flex-1">{discount.label}</span>
                <span className="text-base font-semibold text-red-600 whitespace-nowrap">-{formatCurrency(discount.amount)}</span>
                {pendingRemoveDiscountIdx === index ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { removeDiscount(index); setPendingRemoveDiscountIdx(null); }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 touch-manipulation"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemoveDiscountIdx(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 touch-manipulation"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingRemoveDiscountIdx(index)}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 touch-manipulation"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals — order/format mirrors Step5Review so the rep sees the same breakdown */}
      <Card className="border-[#00929C]/30">
        <CardContent className="p-5 space-y-3">
          {(() => {
            const docFee = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
            const itemsSubtotal = Math.max(0, draft.subtotal - docFee);
            return (
              <div className="flex justify-between items-center">
                <span className="text-base text-slate-600">Subtotal</span>
                <span className="text-base font-semibold text-slate-900">{formatCurrency(itemsSubtotal)}</span>
              </div>
            );
          })()}
          {draft.discount_total > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-base text-slate-600">Discounts</span>
              <span className="text-base font-semibold text-red-600">-{formatCurrency(draft.discount_total)}</span>
            </div>
          )}
          {draft.discount_total > 0 && (() => {
            const docFee = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
            const itemsSubtotal = Math.max(0, draft.subtotal - docFee);
            const afterDiscount = Math.max(0, itemsSubtotal - draft.discount_total);
            return (
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <span className="text-base font-semibold text-slate-700">Subtotal after discount</span>
                <span className="text-base font-bold text-slate-900">{formatCurrency(afterDiscount)}</span>
              </div>
            );
          })()}
          {(() => {
            const waivedValue = draft.line_items
              .filter((i) => i.waived)
              .reduce((sum, i) => sum + i.msrp * i.quantity, 0);
            return waivedValue > 0 ? (
              <div className="flex justify-between items-center">
                <span className="text-base text-emerald-700 font-medium">Included Free</span>
                <span className="text-base font-semibold text-emerald-700">{formatCurrency(waivedValue)} value</span>
              </div>
            ) : null;
          })()}
          {(draft.doc_fee_amount ?? 0) > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-base text-slate-600">Document Fee</span>
                <button
                  type="button"
                  onClick={() => setDocFeeWaived(!draft.doc_fee_waived)}
                  className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border transition-colors ${
                    draft.doc_fee_waived
                      ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {draft.doc_fee_waived ? "Waived · Restore" : "Waive"}
                </button>
              </div>
              {/* Fee + tax combined into a single Document Fee line per
                  Willie's call — matches Step 5 Review, the contract
                  detail page, and the printed PDF. Bookkeeper tax-report
                  keeps the raw split. */}
              <span className={`text-base font-semibold ${draft.doc_fee_waived ? "line-through text-slate-400" : "text-slate-900"}`}>
                {formatCurrency((draft.doc_fee_amount ?? 0) + (draft.doc_fee_tax_amount ?? 0))}
              </span>
            </div>
          )}
          {/* Exempt label only shows when the customer is ACTUALLY exempt
              (cert intent + Rx on file). tax_exempt alone is just intent —
              without an Rx, the tax is still charged (contractStore.ts
              effectiveItemsTax). Showing "Exempt (Rx on file)" with no Rx
              misleads the rep about what the customer is paying. */}
          {(() => {
            const rxOnFile = !!draft.customer?.has_prescription || !!draft.rx_data_url;
            const effectivelyExempt = draft.tax_exempt && rxOnFile;
            return ((draft.tax_amount ?? 0) > 0 || effectivelyExempt) && (
              <div className="flex justify-between items-center">
                <span className={`text-base ${effectivelyExempt ? "text-emerald-700 font-medium" : "text-slate-600"}`}>
                  {effectivelyExempt
                    ? `Tax (${(draft.tax_rate * 100).toFixed(2)}%) — Exempt (Rx on file)`
                    : `Tax (${(draft.tax_rate * 100).toFixed(2)}%)`}
                </span>
                <span className={`text-base font-semibold ${effectivelyExempt ? "text-emerald-700" : "text-slate-900"}`}>
                  {taxCalculating ? (
                    <span className="flex items-center gap-2 text-slate-400">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Calculating...
                    </span>
                  ) : formatCurrency(effectivelyExempt ? 0 : (draft.tax_amount ?? 0))}
                </span>
              </div>
            );
          })()}
          <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
            <span className="text-xl font-bold text-[#00929C]">Total</span>
            <span className="text-xl font-bold text-[#00929C]">{formatCurrency(draft.total)}</span>
          </div>
          {draft.surcharge_enabled && draft.surcharge_amount > 0 && (
            <p className="text-xs text-slate-500 pt-1 leading-relaxed">
              A {(draft.surcharge_rate * 100).toFixed(1)}% surcharge applies to any portion paid by credit card and is added at the time of payment.
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        variant="accent"
        size="xl"
        className="w-full text-lg"
        disabled={draft.line_items.length === 0}
        onClick={onNext}
      >
        Continue to Review
        <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Button>

      {/* Inventory unit picker overlay */}
      {pickerProduct && (
        <InventoryUnitPicker
          productId={pickerProduct.product.id}
          productCategory={pickerProduct.product.category ?? ""}
          productModelCode={pickerProduct.product.model_code ?? undefined}
          showId={draft.show_id ?? null}
          locationId={draft.location_id ?? null}
          onSelect={(unit, extras) => {
            const { product, price } = pickerProduct;
            // Blem path: thread the snapshot fields onto the unit before
            // adding the line, then mark the photo-viewed gate complete
            // so Step7Sign enables the acknowledgment pad.
            if (extras?.blem_description !== undefined || extras?.blem_photo_urls) {
              addLineItemWithUnit(product, price, {
                ...unit,
                blem_description: extras.blem_description,
                blem_photo_urls: extras.blem_photo_urls,
              });
              // The blem_line_id was just assigned inside the store; we
              // can't read it back synchronously, so the store action
              // returns the id via a side-channel. Instead, after-the-fact
              // lookup: the line we just appended is the LAST blem line
              // in line_items. The store reads its own state on the next
              // tick to find the blem_line_id and record the timestamp.
              if (extras.blem_photos_viewed_at) {
                // Run on microtask so the line item is in the store.
                Promise.resolve().then(() => {
                  const draftLines = useContractStore.getState().draft.line_items;
                  const last = [...draftLines].reverse().find((li) => li.unit_type === "blem" && li.blem_line_id);
                  if (last?.blem_line_id) {
                    markBlemPhotosViewed(last.blem_line_id, extras.blem_photos_viewed_at!);
                  }
                });
              }
            } else {
              addLineItemWithUnit(product, price, unit);
            }
            const flashKey = product.id + "-" + price;
            setAddedFlash(flashKey);
            setTimeout(() => setAddedFlash(null), 800);
            setPickerProduct(null);
            collapseAfterModelAdd();
          }}
          onManualEntry={(payload) => {
            const { product, price } = pickerProduct;
            // Manual entry carries unit_type (required) and serial (required
            // except factory_build). The sale location is already captured
            // at the contract level (show / showroom) so the picker doesn't
            // ask for it again.
            addLineItem(
              product,
              price,
              false,
              payload.shell_color,
              payload.cabinet_color,
              undefined,
              {
                unit_type: payload.unit_type,
                serial_number: payload.serial_number,
              },
            );
            const flashKey = product.id + "-" + price;
            setAddedFlash(flashKey);
            setTimeout(() => setAddedFlash(null), 800);
            setPickerProduct(null);
            collapseAfterModelAdd();
          }}
          onAddOffInventoryBlem={(payload) => {
            const { product, price } = pickerProduct;
            addBlemLineWithoutUnit(product, price, {
              description: payload.description,
              photo_urls: payload.photo_urls,
              shell_color: payload.shell_color,
              cabinet_color: payload.cabinet_color,
            });
            Promise.resolve().then(() => {
              const draftLines = useContractStore.getState().draft.line_items;
              const last = [...draftLines].reverse().find((li) => li.unit_type === "blem" && li.blem_line_id);
              if (last?.blem_line_id) {
                markBlemPhotosViewed(last.blem_line_id, payload.blem_photos_viewed_at);
              }
            });
            const flashKey = product.id + "-" + price;
            setAddedFlash(flashKey);
            setTimeout(() => setAddedFlash(null), 800);
            setPickerProduct(null);
            collapseAfterModelAdd();
          }}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </div>
  );
}
