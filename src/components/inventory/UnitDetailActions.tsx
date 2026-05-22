"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INVENTORY_STATUSES, UNIT_TYPES, SHELL_COLORS, CABINET_COLORS, WRAP_STATUSES, SUB_LOCATIONS } from "@/lib/inventory-constants";
import { BlemPhotoUploader, type BlemPhoto } from "@/components/inventory/BlemPhotoUploader";

interface Location { id: string; name: string; city: string; state: string; }
interface Show { id: string; name: string; venue_name: string; }

export interface ExistingBlemPhoto {
  id: string;
  photo_url: string;
  caption?: string | null;
  sort_order?: number | null;
}

export function UnitDetailActions({
  unit,
  locations,
  shows,
  initialBlemPhotos = [],
}: {
  unit: {
    id: string; status: string; location_id?: string | null; show_id?: string | null;
    unit_type: string; shell_color?: string | null; cabinet_color?: string | null;
    wrap_status?: string | null; sub_location?: string | null;
    serial_number?: string | null; order_number?: string | null; notes?: string | null;
    delivery_team?: string | null; customer_name?: string | null; fin_balance?: string | null;
    delivery_info?: string | null; foundation_financing?: boolean; scheduled_owes?: boolean;
    blem_description?: string | null;
  };
  locations: Location[];
  shows: Show[];
  initialBlemPhotos?: ExistingBlemPhoto[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "transfer">("edit");

  const [form, setForm] = useState({
    status: unit.status,
    unit_type: unit.unit_type,
    location_id: unit.location_id ?? "",
    show_id: unit.show_id ?? "",
    shell_color: unit.shell_color ?? "",
    cabinet_color: unit.cabinet_color ?? "",
    wrap_status: unit.wrap_status ?? "WR",
    sub_location: unit.sub_location ?? "",
    serial_number: unit.serial_number ?? "",
    order_number: unit.order_number ?? "",
    notes: unit.notes ?? "",
    delivery_team: unit.delivery_team ?? "",
    customer_name: unit.customer_name ?? "",
    fin_balance: unit.fin_balance ?? "",
    delivery_info: unit.delivery_info ?? "",
    foundation_financing: unit.foundation_financing ?? false,
    scheduled_owes: unit.scheduled_owes ?? false,
    blem_description: unit.blem_description ?? "",
  });

  // Existing persisted photos render as a parallel list with delete buttons.
  // New photos added through the uploader are kept in newBlemPhotos (data
  // URLs) and uploaded on Save Changes via the /blem-photos endpoint.
  const [existingPhotos, setExistingPhotos] = useState<ExistingBlemPhoto[]>(initialBlemPhotos);
  const [newBlemPhotos, setNewBlemPhotos] = useState<BlemPhoto[]>([]);

  const isBlem = form.unit_type === "blem";

  const [transferNotes, setTransferNotes] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [toShowId, setToShowId] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Remove this photo? The image stays archived so contracts that already reference it remain valid.")) return;
    try {
      const res = await fetch(`/api/inventory/blem-photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to remove photo");
      setExistingPhotos((arr) => arr.filter((p) => p.id !== photoId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSave() {
    if (isBlem && !form.blem_description.trim()) {
      setError("Blem units require a damage description so the customer knows what they're buying.");
      return;
    }
    if (isBlem && existingPhotos.length === 0 && newBlemPhotos.length === 0) {
      setError("Blem units require at least one photo of the damage.");
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/inventory/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          location_id: form.location_id || null,
          show_id: form.show_id || null,
          shell_color: form.shell_color || null,
          cabinet_color: form.cabinet_color || null,
          sub_location: form.sub_location || null,
          serial_number: form.serial_number || null,
          order_number: form.order_number || null,
          notes: form.notes || null,
          delivery_team: form.delivery_team || null,
          customer_name: form.customer_name || null,
          fin_balance: form.fin_balance || null,
          delivery_info: form.delivery_info || null,
          foundation_financing: form.foundation_financing,
          scheduled_owes: form.scheduled_owes,
          blem_description: isBlem ? form.blem_description : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");

      // Persist any newly-added photos.
      if (isBlem && newBlemPhotos.length > 0) {
        const startIndex = existingPhotos.length;
        const photoRes = await fetch(`/api/inventory/${unit.id}/blem-photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photos: newBlemPhotos.map((p, i) => ({
              photo_url: p.photo_url,
              caption: p.caption ?? null,
              sort_order: startIndex + i,
            })),
          }),
        });
        if (!photoRes.ok) {
          // Soft fail — the unit edits succeeded; surface the photo error
          // so the rep knows to retry the upload from this page.
          const body = await photoRes.json().catch(() => null);
          throw new Error(body?.error ?? "Photos failed to upload");
        }
        setNewBlemPhotos([]);
      }
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleTransfer() {
    if (!toLocationId && !toShowId) { setError("Select a destination."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/inventory/${unit.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_location_id: toLocationId || null,
          to_show_id: toShowId || null,
          notes: transferNotes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const S = ({ value, onChange, children, placeholder }: {
    value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string;
  }) => (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Admin Actions</CardTitle>
        <div className="flex gap-2 mt-2">
          {(["edit", "transfer"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize ${tab === t ? "bg-[#00929C] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {t === "transfer" ? "Transfer / Assign Show" : "Edit Details"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {tab === "edit" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Status</label>
                <S value={form.status} onChange={(v) => set("status", v)}>
                  {INVENTORY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </S>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Unit Type</label>
                <S value={form.unit_type} onChange={(v) => set("unit_type", v)}>
                  {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </S>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Shell Color</label>
                <S value={form.shell_color} onChange={(v) => set("shell_color", v)} placeholder="—">
                  {SHELL_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </S>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Cabinet</label>
                <S value={form.cabinet_color} onChange={(v) => set("cabinet_color", v)} placeholder="—">
                  {CABINET_COLORS.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </S>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Wrap</label>
                <S value={form.wrap_status} onChange={(v) => set("wrap_status", v)}>
                  {WRAP_STATUSES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </S>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Sub-Location</label>
                <S value={form.sub_location} onChange={(v) => set("sub_location", v)} placeholder="—">
                  {SUB_LOCATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </S>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Serial #</label>
              <input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Delivery Team</label>
              <S value={form.delivery_team} onChange={(v) => set("delivery_team", v)} placeholder="Not assigned">
                <option value="atlas">Atlas Delivery</option>
                <option value="fierce">Fierce Delivery</option>
                <option value="houston_aaron">Houston / Aaron</option>
              </S>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Customer (legacy)</label>
              <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)}
                placeholder="Name from spreadsheet"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Finance Balance</label>
              <input value={form.fin_balance} onChange={(e) => set("fin_balance", e.target.value)}
                placeholder="e.g. PIF, $5,400, Need to Print"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Delivery / Completion Info</label>
              <input value={form.delivery_info} onChange={(e) => set("delivery_info", e.target.value)}
                placeholder="e.g. Trk 3-26-26, STORAGE, WiFi w/ Lgt"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.foundation_financing}
                  onChange={(e) => setForm((f) => ({ ...f, foundation_financing: e.target.checked }))}
                  className="rounded"
                />
                Foundation Financing
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.scheduled_owes}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_owes: e.target.checked }))}
                  className="rounded"
                />
                Scheduled — Owes Balance
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
                rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none" />
            </div>

            {isBlem && (
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex-shrink-0">!</span>
                  <div>
                    <p className="text-sm font-semibold text-red-900">Blem Details</p>
                    <p className="text-xs text-red-700/80">Customer-visible at sale and on the printed contract.</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Damage Description</label>
                  <textarea
                    value={form.blem_description}
                    onChange={(e) => set("blem_description", e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Describe the location and nature of the damage in plain language."
                    className="w-full px-3 py-2 rounded-xl border border-red-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                  <p className="text-[11px] text-slate-400 text-right">
                    {form.blem_description.length} / 1000
                  </p>
                </div>

                {existingPhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-700">Existing Photos</p>
                    <ul className="grid grid-cols-3 gap-2">
                      {existingPhotos.map((p) => (
                        <li key={p.id} className="relative rounded-lg overflow-hidden border border-slate-200 bg-white">
                          <div className="aspect-square bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.photo_url} alt={p.caption ?? ""} className="w-full h-full object-cover" />
                          </div>
                          {p.caption && (
                            <p className="text-[10px] text-slate-600 px-1.5 py-1 truncate" title={p.caption}>{p.caption}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(p.id)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/95 text-red-600 hover:bg-red-50 shadow flex items-center justify-center"
                            aria-label="Remove photo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-700">Add Photos</p>
                  <BlemPhotoUploader
                    photos={newBlemPhotos}
                    onChange={setNewBlemPhotos}
                    stageOnly
                  />
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} variant="accent" size="lg" className="w-full">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">Move this unit to a different location or assign it to a show. A transfer record will be created automatically.</p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Transfer to Store Location</label>
              <S value={toLocationId} onChange={setToLocationId} placeholder="Select location…">
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city}, {l.state}</option>)}
              </S>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Or Assign to Show</label>
              <S value={toShowId} onChange={setToShowId} placeholder="Select show…">
                {shows.map((s) => <option key={s.id} value={s.id}>{s.name} @ {s.venue_name}</option>)}
              </S>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Transfer Notes</label>
              <textarea value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)}
                rows={2} placeholder="Reason for transfer, truck date, etc."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none" />
            </div>
            <Button onClick={handleTransfer} disabled={saving} variant="accent" size="lg" className="w-full">
              {saving ? "Processing…" : "Transfer Unit"}
            </Button>
          </>
        )}
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </CardContent>
    </Card>
  );
}
