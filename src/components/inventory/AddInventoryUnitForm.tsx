"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  SHELL_COLORS,
  CABINET_COLORS,
  UNIT_TYPES,
  INVENTORY_STATUSES,
  WRAP_STATUSES,
  SUB_LOCATIONS,
} from "@/lib/inventory-constants";

interface Product { id: string; name: string; category: string; line?: string; model_code?: string; }
interface Location { id: string; name: string; city: string; state: string; }
interface Show { id: string; name: string; venue_name: string; start_date: string; end_date: string; }

export function AddInventoryUnitForm({
  products,
  locations,
  shows,
}: {
  products: Product[];
  locations: Location[];
  shows: Show[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    product_id: "",
    serial_number: "",
    order_number: "",
    status: "at_location",
    unit_type: "stock",
    shell_color: "",
    cabinet_color: "",
    wrap_status: "WR",
    sub_location: "",
    location_id: "",
    show_id: "",
    received_date: "",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id) { setError("Please select a product."); return; }
    if (!form.serial_number && !form.order_number) {
      setError("Enter a serial number or order number."); return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          location_id: form.location_id || null,
          show_id: form.show_id || null,
          serial_number: form.serial_number || null,
          order_number: form.order_number || null,
          shell_color: form.shell_color || null,
          cabinet_color: form.cabinet_color || null,
          sub_location: form.sub_location || null,
          received_date: form.received_date || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save");
      }
      router.push("/admin/inventory");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );

  const Select = ({ value, onChange, children, placeholder }: {
    value: string; onChange: (v: string) => void;
    children: React.ReactNode; placeholder?: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Product */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">Product</h2>
          <F label="Product *">
            <Select value={form.product_id} onChange={(v) => set("product_id", v)} placeholder="Select a product…">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.category ? `[${p.category}] ` : ""}{p.name}
                  {p.model_code ? ` — ${p.model_code}` : ""}
                </option>
              ))}
            </Select>
          </F>
          <F label="Unit Type *">
            <Select value={form.unit_type} onChange={(v) => set("unit_type", v)}>
              {UNIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label} — {t.description}</option>
              ))}
            </Select>
          </F>
        </CardContent>
      </Card>

      {/* Identification */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">Identification</h2>
          <F label="Serial Number">
            <Input
              value={form.serial_number}
              onChange={(e) => set("serial_number", e.target.value)}
              placeholder="e.g. 2603888 or H260042"
            />
          </F>
          <F label="Order Number (factory builds)">
            <Input
              value={form.order_number}
              onChange={(e) => set("order_number", e.target.value)}
              placeholder="e.g. W341534"
            />
          </F>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">Configuration</h2>
          <div className="grid grid-cols-2 gap-3">
            <F label="Shell Color">
              <Select value={form.shell_color} onChange={(v) => set("shell_color", v)} placeholder="Select…">
                {SHELL_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </F>
            <F label="Cabinet Color">
              <Select value={form.cabinet_color} onChange={(v) => set("cabinet_color", v)} placeholder="Select…">
                {CABINET_COLORS.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </Select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Wrap Status">
              <Select value={form.wrap_status} onChange={(v) => set("wrap_status", v)}>
                {WRAP_STATUSES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </Select>
            </F>
            <F label="Received Date">
              <Input
                type="date"
                value={form.received_date}
                onChange={(e) => set("received_date", e.target.value)}
              />
            </F>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">Location</h2>
          <F label="Status *">
            <Select value={form.status} onChange={(v) => set("status", v)}>
              {INVENTORY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </F>
          <F label="Store Location">
            <Select value={form.location_id} onChange={(v) => set("location_id", v)} placeholder="None / TBD">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} — {l.city}, {l.state}</option>
              ))}
            </Select>
          </F>
          <F label="Assigned Show">
            <Select value={form.show_id} onChange={(v) => set("show_id", v)} placeholder="Not at a show">
              {shows.map((s) => (
                <option key={s.id} value={s.id}>{s.name} @ {s.venue_name}</option>
              ))}
            </Select>
          </F>
          <F label="Sub-Location">
            <Select value={form.sub_location} onChange={(v) => set("sub_location", v)} placeholder="Not specified">
              {SUB_LOCATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </F>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">Notes</h2>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Damage notes, delivery instructions, special conditions…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40 resize-none"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="accent"
        size="xl"
        className="w-full"
        disabled={saving}
      >
        {saving ? "Saving…" : "Add Inventory Unit"}
      </Button>
    </form>
  );
}
