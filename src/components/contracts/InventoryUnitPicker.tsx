"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusColor, getUnitTypeLabel, getCabinetName, getModelDisplayName, SHELL_COLORS, CABINET_COLORS } from "@/lib/inventory-constants";

interface InventoryUnit {
  id: string;
  serial_number?: string | null;
  order_number?: string | null;
  status: string;
  unit_type: string;
  shell_color?: string | null;
  cabinet_color?: string | null;
  sub_location?: string | null;
  model_code?: string | null;
  product?: { id: string; name: string; category: string; model_code?: string } | null;
  location?: { name: string; city?: string; state?: string } | null;
  show?: { name: string } | null;
}

interface InventoryUnitPickerProps {
  productId: string;         // exact product UUID — filters to this model only
  productCategory: string;   // fallback category filter for units without product_id
  showId?: string | null;
  locationId?: string | null;
  onSelect: (unit: InventoryUnit) => void;
  onSkip: (shell?: string, cabinet?: string) => void;
  onClose: () => void;
}

const UNIT_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  stock:         { label: "New In-Stock",     color: "bg-emerald-100 text-emerald-700" },
  factory_build: { label: "Factory Build",    color: "bg-blue-100 text-blue-700" },
  floor_model:   { label: "Floor Model",      color: "bg-amber-100 text-amber-700" },
  blem:          { label: "Blem / AS IS",     color: "bg-red-100 text-red-700" },
  wet_model:     { label: "Wet Model",        color: "bg-purple-100 text-purple-700" },
};

export function InventoryUnitPicker({
  productId,
  productCategory,
  showId,
  locationId,
  onSelect,
  onSkip,
  onClose,
}: InventoryUnitPickerProps) {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [allLocations, setAllLocations] = useState(false);

  // Color-capture state (shown when rep taps "Add without unit")
  const [showColorCapture, setShowColorCapture] = useState(false);
  const [skipShell, setSkipShell] = useState("");
  const [skipCabinet, setSkipCabinet] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "at_location,at_show",
          product_id: productId,
          // Also pass category so the API's post-fetch filter catches any units
          // that were entered without a product_id link (legacy records)
          category: productCategory,
        });
        if (allLocations) {
          params.set("all_locations", "true");
        } else if (showId) {
          params.set("show_id", showId);
        } else if (locationId) {
          params.set("location_id", locationId);
        }

        const res = await fetch(`/api/inventory?${params}`);
        if (res.ok) setUnits(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId, productCategory, showId, locationId, allLocations]);

  const filtered = units.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.serial_number?.toLowerCase().includes(q) ||
      u.order_number?.toLowerCase().includes(q) ||
      u.shell_color?.toLowerCase().includes(q) ||
      u.cabinet_color?.toLowerCase().includes(q) ||
      u.model_code?.toLowerCase().includes(q) ||
      u.product?.model_code?.toLowerCase().includes(q) ||
      u.product?.name?.toLowerCase().includes(q) ||
      u.location?.name?.toLowerCase().includes(q)
    );
  });

  // Resolve a clean model name for display
  function resolveModelName(unit: InventoryUnit): string {
    if (unit.product?.name) return unit.product.name;
    return getModelDisplayName(unit.model_code ?? unit.product?.model_code);
  }

  if (showColorCapture) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={onClose}>
        <div
          className="mt-auto bg-white rounded-t-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Colors (Optional)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Specify shell and cabinet colors for the contract</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Shell Color</label>
              <select
                value={skipShell}
                onChange={(e) => setSkipShell(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              >
                <option value="">— Select shell color —</option>
                {SHELL_COLORS.filter((c) => c !== "N/A").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cabinet Color</label>
              <select
                value={skipCabinet}
                onChange={(e) => setSkipCabinet(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              >
                <option value="">— Select cabinet color —</option>
                {CABINET_COLORS.filter((c) => c.code !== "N/A").map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="px-5 pb-6 space-y-2">
            <Button
              onClick={() => onSkip(skipShell || undefined, skipCabinet || undefined)}
              variant="default"
              size="lg"
              className="w-full"
            >
              Add to Contract
            </Button>
            <Button
              onClick={() => onSkip()}
              variant="ghost"
              size="lg"
              className="w-full text-slate-500"
            >
              Skip — Add Without Colors
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="mt-auto bg-white rounded-t-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Select from Inventory</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? "Loading…" : `${filtered.length} unit${filtered.length !== 1 ? "s" : ""} available`}
              {allLocations ? " · All locations" : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + location toggle */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial, model, color, location…"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setAllLocations((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              allLocations
                ? "bg-[#00929C] text-white border-[#00929C]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#00929C]/40"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {allLocations ? "All Locations (showing all)" : "Show All Locations"}
          </button>
        </div>

        {/* Unit list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <p>Loading inventory…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400 px-6">
              <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="font-medium">No units available{allLocations ? "" : " at this location"}</p>
              {!allLocations && (
                <button
                  onClick={() => setAllLocations(true)}
                  className="mt-2 text-sm text-[#00929C] font-semibold underline"
                >
                  Search all locations →
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((unit) => {
                const badge = UNIT_TYPE_BADGES[unit.unit_type];
                const modelName = resolveModelName(unit);
                const where = unit.show?.name ?? (unit.location?.name ?? "—");
                const cabinetLabel = unit.cabinet_color ? getCabinetName(unit.cabinet_color) : null;
                return (
                  <li key={unit.id}>
                    <button
                      onClick={() => onSelect(unit)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">
                            {unit.serial_number ?? unit.order_number ?? "No ID"}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge?.color ?? "bg-slate-100 text-slate-600"}`}>
                            {badge?.label ?? getUnitTypeLabel(unit.unit_type)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mt-0.5">{modelName}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {unit.shell_color ?? "—"}
                          {cabinetLabel ? ` · ${cabinetLabel} cabinet` : ""}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          📍 {where}{unit.sub_location ? ` · ${unit.sub_location}` : ""}
                          {allLocations && unit.location?.city ? ` · ${unit.location.city}, ${unit.location.state ?? ""}` : ""}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-[#00929C] ml-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          <Button onClick={() => setShowColorCapture(true)} variant="outline" size="lg" className="w-full">
            Add Without Selecting a Unit
          </Button>
          <p className="text-xs text-center text-slate-400">
            You can assign a serial number manually in the review step
          </p>
        </div>
      </div>
    </div>
  );
}
