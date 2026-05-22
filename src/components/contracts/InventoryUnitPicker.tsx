"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getUnitTypeLabel, getCabinetName, getModelDisplayName, getValidShellColors, getValidCabinets } from "@/lib/inventory-constants";
import { createClient } from "@/lib/supabase/client";
import { BlemConfirmationDialog, type BlemDialogPayload } from "@/components/contracts/BlemConfirmationDialog";

interface BlemPhotoRow {
  id?: string;
  photo_url: string;
  caption?: string | null;
  sort_order?: number | null;
}

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
  blem_description?: string | null;
  blem_photos?: BlemPhotoRow[];
  blem_photo_count?: number;
  product?: { id: string; name: string; category: string; model_code?: string } | null;
  location?: { name: string; city?: string; state?: string } | null;
  show?: { name: string } | null;
}

// Extra payload passed to onSelect so the parent can call
// addLineItemWithUnit() with the blem snapshot fields already captured.
export interface PickerSelectExtras {
  blem_description?: string;
  blem_photo_urls?: string[];
  // Pre-completed Show-to-Customer gate timestamp — written into the
  // contract store under blem_photos_viewed_at[blem_line_id] after the
  // line item is added so Step7Sign knows the gate has been satisfied.
  blem_photos_viewed_at?: string;
}

// Payload for the sale-time blem path (no inventory unit selected).
export interface OffInventoryBlemPayload {
  description: string;
  photo_urls: string[];
  shell_color?: string;
  cabinet_color?: string;
  // Same purpose as PickerSelectExtras.blem_photos_viewed_at.
  blem_photos_viewed_at: string;
}

interface InventoryUnitPickerProps {
  productId: string;
  productCategory: string;
  productModelCode?: string;
  showId?: string | null;
  locationId?: string | null;
  onSelect: (unit: InventoryUnit, extras?: PickerSelectExtras) => void;
  onSkip: (shell?: string, cabinet?: string) => void;
  // Optional callback wired up only when the parent supports the sale-time
  // blem fallback. When omitted, the picker still shows the toggle but
  // disables it.
  onAddOffInventoryBlem?: (payload: OffInventoryBlemPayload) => void;
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
  productModelCode,
  showId,
  locationId,
  onSelect,
  onSkip,
  onAddOffInventoryBlem,
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
  // Sale-time blem toggle inside the color-capture sheet
  const [skipIsBlem, setSkipIsBlem] = useState(false);
  const [skipBlemDescription, setSkipBlemDescription] = useState("");
  // Photos selected for the sale-time blem path. Uploaded to the bucket
  // when the rep confirms — see handleSkipBlemConfirm().
  const [skipBlemFiles, setSkipBlemFiles] = useState<File[]>([]);
  const [skipBlemError, setSkipBlemError] = useState<string | null>(null);

  // Blem confirmation dialog state — fired when the rep selects a blem
  // unit (the inventory-marked path). The customer must tap through every
  // photo before "I have reviewed all photos" enables.
  const [pendingBlem, setPendingBlem] = useState<{ unit: InventoryUnit; payload: BlemDialogPayload } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "at_location,at_show",
          product_id: productId,
          category: productCategory,
        });
        if (productModelCode) params.set("model_code", productModelCode);
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
  }, [productId, productCategory, productModelCode, showId, locationId, allLocations]);

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
      u.location?.name?.toLowerCase().includes(q) ||
      u.blem_description?.toLowerCase().includes(q)
    );
  });

  function resolveModelName(unit: InventoryUnit): string {
    if (unit.product?.name) return unit.product.name;
    return getModelDisplayName(unit.model_code ?? unit.product?.model_code);
  }

  function handleUnitTap(unit: InventoryUnit) {
    if (unit.unit_type === "blem") {
      // Open the dialog gate; onConfirm finalizes the selection.
      const photos = (unit.blem_photos ?? [])
        .filter((p) => !!p?.photo_url)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setPendingBlem({
        unit,
        payload: {
          unitLabel: `${resolveModelName(unit)} · ${unit.serial_number ?? unit.order_number ?? "No ID"}`,
          blem_description: unit.blem_description ?? "",
          blem_photo_urls: photos.map((p) => p.photo_url),
          captions: photos.map((p) => p.caption ?? null),
        },
      });
    } else {
      onSelect(unit);
    }
  }

  function handleBlemConfirm(viewedAt: string) {
    if (!pendingBlem) return;
    onSelect(pendingBlem.unit, {
      blem_description: pendingBlem.payload.blem_description,
      blem_photo_urls: pendingBlem.payload.blem_photo_urls,
      blem_photos_viewed_at: viewedAt,
    });
    setPendingBlem(null);
  }

  async function uploadSaleTimeBlemFiles(): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];
    for (const f of skipBlemFiles) {
      const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
      const key = `sale-time/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("blem-photos")
        .upload(key, f, { upsert: false, contentType: f.type });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("blem-photos").getPublicUrl(key);
      urls.push(pub.publicUrl);
    }
    return urls;
  }

  async function handleSkipBlemConfirm() {
    if (!skipBlemDescription.trim()) {
      setSkipBlemError("Please describe the damage before continuing.");
      return;
    }
    if (skipBlemFiles.length === 0) {
      setSkipBlemError("Please attach at least one photo of the damage.");
      return;
    }
    if (!onAddOffInventoryBlem) {
      setSkipBlemError("Sale-time blem path is not configured.");
      return;
    }
    setSkipBlemError(null);
    try {
      const urls = await uploadSaleTimeBlemFiles();
      // Show the customer the photos before locking them onto the contract.
      const captions = skipBlemFiles.map((f) => f.name);
      setPendingSaleTimeBlem({
        urls,
        captions,
        shell: skipShell || undefined,
        cabinet: skipCabinet || undefined,
      });
    } catch (err) {
      setSkipBlemError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  // After upload, we hand the iPad to the customer with the same dialog
  // used for inventory-marked blem selections.
  const [pendingSaleTimeBlem, setPendingSaleTimeBlem] = useState<{
    urls: string[];
    captions: string[];
    shell?: string;
    cabinet?: string;
  } | null>(null);

  function finalizeSaleTimeBlem(viewedAt: string) {
    if (!pendingSaleTimeBlem || !onAddOffInventoryBlem) return;
    onAddOffInventoryBlem({
      description: skipBlemDescription.trim(),
      photo_urls: pendingSaleTimeBlem.urls,
      shell_color: pendingSaleTimeBlem.shell,
      cabinet_color: pendingSaleTimeBlem.cabinet,
      blem_photos_viewed_at: viewedAt,
    });
    setPendingSaleTimeBlem(null);
  }

  if (showColorCapture) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={onClose}>
        <div
          className="mt-auto bg-white rounded-t-2xl max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add Without Selecting a Unit</h2>
              <p className="text-xs text-slate-500 mt-0.5">Specify colors and (if applicable) blem details</p>
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
                {getValidShellColors(productModelCode).filter((c) => c !== "N/A").map((c) => (
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
                {getValidCabinets(productModelCode).filter((c) => c.code !== "N/A").map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sale-time blem toggle */}
            <label className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50/40 cursor-pointer">
              <input
                type="checkbox"
                checked={skipIsBlem}
                onChange={(e) => setSkipIsBlem(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <div className="text-sm text-red-900">
                <p className="font-semibold">This unit has blemishes / damage</p>
                <p className="text-xs text-red-700/80">
                  Toggle on if you're selling a unit not in inventory that has visible damage (e.g. floor model, off-spec unit). You'll need to add a description and photos.
                </p>
              </div>
            </label>

            {skipIsBlem && (
              <div className="rounded-xl border border-red-200 bg-white p-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Damage Description *</label>
                  <textarea
                    value={skipBlemDescription}
                    onChange={(e) => setSkipBlemDescription(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Describe where the damage is and what it looks like."
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-red-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Photos *</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setSkipBlemFiles(Array.from(e.target.files ?? []))}
                    className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-red-100 file:text-red-700 file:font-semibold"
                  />
                  {skipBlemFiles.length > 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">{skipBlemFiles.length} photo(s) selected</p>
                  )}
                </div>
                {skipBlemError && (
                  <p className="text-xs text-red-600">{skipBlemError}</p>
                )}
              </div>
            )}
          </div>
          <div className="px-5 pb-6 space-y-2">
            {skipIsBlem ? (
              <Button
                onClick={handleSkipBlemConfirm}
                variant="accent"
                size="lg"
                className="w-full"
              >
                Upload Photos & Show to Customer
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Sale-time blem Show-to-Customer gate */}
        <BlemConfirmationDialog
          open={!!pendingSaleTimeBlem}
          payload={pendingSaleTimeBlem ? {
            unitLabel: "New blem unit (added at sale)",
            blem_description: skipBlemDescription,
            blem_photo_urls: pendingSaleTimeBlem.urls,
            captions: pendingSaleTimeBlem.captions,
          } : null}
          onConfirm={finalizeSaleTimeBlem}
          onCancel={() => setPendingSaleTimeBlem(null)}
          kioskMode
        />
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
                const isBlem = unit.unit_type === "blem";
                const blemPhotoCount = unit.blem_photo_count ?? unit.blem_photos?.length ?? 0;
                const blemPreview = (unit.blem_description ?? "").slice(0, 80);
                return (
                  <li key={unit.id}>
                    <button
                      onClick={() => handleUnitTap(unit)}
                      className={`w-full flex items-center justify-between px-5 py-4 active:bg-slate-100 text-left transition-colors ${
                        isBlem ? "hover:bg-red-50 border-l-4 border-red-400" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">
                            {unit.serial_number ?? unit.order_number ?? "No ID"}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge?.color ?? "bg-slate-100 text-slate-600"}`}>
                            {badge?.label ?? getUnitTypeLabel(unit.unit_type)}
                          </span>
                          {isBlem && blemPhotoCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-600 text-white">
                              {blemPhotoCount} photo{blemPhotoCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 font-medium mt-0.5">{modelName}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {unit.shell_color ?? "—"}
                          {cabinetLabel ? ` · ${cabinetLabel} cabinet` : ""}
                        </p>
                        {isBlem && blemPreview && (
                          <p className="text-xs text-red-700 mt-1 italic">
                            “{blemPreview}{(unit.blem_description?.length ?? 0) > 80 ? "…" : ""}”
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">
                          📍 {where}{unit.sub_location ? ` · ${unit.sub_location}` : ""}
                          {allLocations && unit.location?.city ? ` · ${unit.location.city}, ${unit.location.state ?? ""}` : ""}
                        </p>
                      </div>
                      <svg className={`w-5 h-5 ml-3 flex-shrink-0 ${isBlem ? "text-red-600" : "text-[#00929C]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Blem confirmation gate — fired for inventory-marked blem selections */}
      <BlemConfirmationDialog
        open={!!pendingBlem}
        payload={pendingBlem?.payload ?? null}
        onConfirm={handleBlemConfirm}
        onCancel={() => setPendingBlem(null)}
        kioskMode
      />
    </div>
  );
}
