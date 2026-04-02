"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INVENTORY_STATUSES, UNIT_TYPES, SHELL_COLORS, CABINET_COLORS, WRAP_STATUSES, SUB_LOCATIONS } from "@/lib/inventory-constants";

interface Location { id: string; name: string; city: string; state: string; }
interface Show { id: string; name: string; venue_name: string; }

export function UnitDetailActions({
  unit,
  locations,
  shows,
}: {
  unit: {
    id: string; status: string; location_id?: string | null; show_id?: string | null;
    unit_type: string; shell_color?: string | null; cabinet_color?: string | null;
    wrap_status?: string | null; sub_location?: string | null;
    serial_number?: string | null; order_number?: string | null; notes?: string | null;
    delivery_team?: string | null; customer_name?: string | null; fin_balance?: string | null;
    delivery_info?: string | null; foundation_financing?: boolean; scheduled_owes?: boolean;
  };
  locations: Location[];
  shows: Show[];
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
  });

  const [transferNotes, setTransferNotes] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [toShowId, setToShowId] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
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
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");
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
