"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { Product, DiscountType, ContractDiscount } from "@/types";
import { isSpaProduct } from "@/lib/inventory-constants";
import { InventoryUnitPicker } from "@/components/contracts/InventoryUnitPicker";

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
    logoUrl: "https://www.masterspas.com/img/logos/legend/MPL_Color_R.svg",
    categories: ["MP Legend Series"],
  },
  {
    label: "Twilight Series",
    section: "Hot Tubs",
    logoUrl: "https://www.masterspas.com/img/logos/twilight/Twilight_Color_TM.svg",
    categories: ["Twilight Series"],
  },
  {
    label: "Clarity Series",
    section: "Hot Tubs",
    logoUrl: "https://www.masterspas.com/img/logos/clarity/Clarity_Color_R.svg",
    categories: ["Clarity Series"],
  },
  {
    label: "Getaway Series",
    section: "Hot Tubs",
    logoUrl: "https://www.masterspas.com/img/logos/getaway/Getaway_Color_TM.svg",
    categories: ["Getaway Series"],
  },
  {
    label: "LH Series",
    section: "Hot Tubs",
    logoUrl: "https://www.masterspas.com/img/logos/lh/LH_Color_TM.svg",
    categories: ["LH Series"],
  },
  // ── SWIM SPAS ────────────────────────────────────────────────────────────
  {
    label: "Michael Phelps Swim Spas",
    section: "Swim Spas",
    logoUrl: "https://www.masterspas.com/img/logos/michaelphelpsswimspas/MPSS_Color_TM.svg",
    categories: ["Michael Phelps Swim Spas"],
  },
  {
    label: "H2X Swim Spas",
    section: "Swim Spas",
    logoUrl: "https://www.masterspas.com/img/logos/h2x/H2X_Color_R.svg",
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
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("show_special");
  const [discountAmount, setDiscountAmount] = useState("");
  const [taxCalculating, setTaxCalculating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState("");

  const { addLineItem, addLineItemWithUnit, removeLineItem, addDiscount, removeDiscount, setTax, updateLineItemPrice, updateLineItemColors } = useContractStore();
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
      const response = await fetch("/api/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_items: draft.line_items,
          discounts: draft.discounts,
          shipping_address: draft.location
            ? { address: draft.location.address, city: draft.location.city, state: draft.location.state, zip: draft.location.zip }
            : undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTax(data.total_tax ?? 0, data.tax_rate ?? 0);
      }
    } catch { /* Tax service unavailable */ } finally {
      setTaxCalculating(false);
    }
  }, [draft.line_items, draft.discounts, draft.location, setTax]);

  useEffect(() => {
    if (taxTimeoutRef.current) clearTimeout(taxTimeoutRef.current);
    taxTimeoutRef.current = setTimeout(calculateTax, 500);
    return () => { if (taxTimeoutRef.current) clearTimeout(taxTimeoutRef.current); };
  }, [calculateTax]);

  function handleAddProduct(product: Product, price: number, waived = false) {
    addLineItem(product, price, waived);
    const flashKey = product.id + "-" + (waived ? "waived" : price);
    setAddedFlash(flashKey);
    setTimeout(() => setAddedFlash(null), 800);
  }

  function handleSpaAdd(product: Product, price: number) {
    if (isSpaProduct(product.category ?? "")) {
      setPickerProduct({ product, price });
    } else {
      handleAddProduct(product, price);
    }
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

  const optionProducts = products.filter((p) => {
    if (!relevantOptionCategories.includes(p.category ?? "")) return false;
    if (p.category === "Other Options") return filterOtherOption(p.name, selectedLine);
    return true;
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
        <h2 className="text-2xl font-bold text-[#00929C]">Products</h2>
        <p className="text-base text-slate-500 mt-1">Select a product line to get started.</p>
      </div>

      {/* Cart summary */}
      {draft.line_items.length > 0 && (
        <Card className="border-[#00929C]/20 bg-[#00929C]/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#00929C] uppercase tracking-wide mb-3">
              Selected ({draft.line_items.length})
            </h3>
            <div className="space-y-2">
              {draft.line_items.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-medium text-slate-900 block truncate">{item.product_name}</span>
                    {(item.inventory_unit_id || item.shell_color || item.cabinet_color) && (
                      <span className="text-xs text-slate-500">
                        {item.serial_number ? `S/N: ${item.serial_number}` : item.inventory_unit_id ? "Unit selected" : ""}
                        {item.shell_color ? `${item.serial_number || item.inventory_unit_id ? " · " : ""}${item.shell_color}` : ""}
                        {item.cabinet_color ? ` · ${item.cabinet_color} cabinet` : ""}
                        {item.unit_type ? ` · ${item.unit_type.replace(/_/g, " ")}` : ""}
                      </span>
                    )}
                  </div>

                  {/* Price — tap to edit */}
                  {item.waived ? (
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

                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 touch-manipulation"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product line picker — grouped by section */}
      {(["Hot Tubs", "Swim Spas", "Cold Tubs", "Saunas"] as const).map((section) => {
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
                    onClick={() => setSelectedLine(isSelected ? null : line.label)}
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
      })}

      {/* Models for selected line */}
      {selectedLine && lineProducts.length > 0 && (
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
            ) : optionProducts.length === 0 ? (
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
          </div>
        )}
      </div>

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
                <button
                  type="button"
                  onClick={() => removeDiscount(index)}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <Card className="border-[#00929C]/30">
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-base text-slate-600">Subtotal</span>
            <span className="text-base font-semibold text-slate-900">{formatCurrency(draft.subtotal)}</span>
          </div>
          {draft.discount_total > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-base text-slate-600">Discounts</span>
              <span className="text-base font-semibold text-red-600">-{formatCurrency(draft.discount_total)}</span>
            </div>
          )}
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
          <div className="flex justify-between items-center">
            <span className="text-base text-slate-600">Tax</span>
            <span className="text-base font-semibold text-slate-900">
              {taxCalculating ? (
                <span className="flex items-center gap-2 text-slate-400">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Calculating...
                </span>
              ) : formatCurrency(draft.tax_amount)}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
            <span className="text-xl font-bold text-[#00929C]">Total</span>
            <span className="text-xl font-bold text-[#00929C]">{formatCurrency(draft.total)}</span>
          </div>
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
          productCategory={pickerProduct.product.category ?? ""}
          showId={draft.show_id ?? null}
          locationId={draft.location_id ?? null}
          onSelect={(unit) => {
            const { product, price } = pickerProduct;
            addLineItemWithUnit(product, price, unit);
            const flashKey = product.id + "-" + price;
            setAddedFlash(flashKey);
            setTimeout(() => setAddedFlash(null), 800);
            setPickerProduct(null);
          }}
          onSkip={(shell, cabinet) => {
            const { product, price } = pickerProduct;
            addLineItem(product, price, false, shell, cabinet);
            const flashKey = product.id + "-" + price;
            setAddedFlash(flashKey);
            setTimeout(() => setAddedFlash(null), 800);
            setPickerProduct(null);
          }}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </div>
  );
}
