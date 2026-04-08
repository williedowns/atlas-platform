"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Profile = { id: string; full_name: string };

const STATUS_OPTIONS = [
  { value: "scheduled",   label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "cancelled",   label: "Cancelled" },
];

const STATUS_BADGE: Record<string, "default" | "warning" | "success" | "destructive"> = {
  scheduled:   "default",
  in_progress: "warning",
  completed:   "success",
  cancelled:   "destructive",
};

export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();

  const [order, setOrder] = useState<any>(null);
  const [crew, setCrew] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    scheduled_date: "",
    status: "scheduled",
    notes: "",
    assigned_crew_ids: [] as string[],
  });

  useEffect(() => {
    supabase
      .from("delivery_work_orders")
      .select(`
        id, scheduled_date, status, notes, assigned_crew_ids,
        contract:contracts(
          id, contract_number, balance_due,
          customer:customers(first_name, last_name, phone, address, city, state, zip),
          location:locations(name),
          show:shows(name),
          line_items
        )
      `)
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setOrder(data);
          setForm({
            scheduled_date: data.scheduled_date ?? "",
            status: data.status ?? "scheduled",
            notes: data.notes ?? "",
            assigned_crew_ids: data.assigned_crew_ids ?? [],
          });
        }
      });

    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["field_crew", "admin", "manager"])
      .order("full_name")
      .then(({ data }) => setCrew(data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCrew(id: string) {
    setForm((f) => ({
      ...f,
      assigned_crew_ids: f.assigned_crew_ids.includes(id)
        ? f.assigned_crew_ids.filter((x) => x !== id)
        : [...f.assigned_crew_ids, id],
    }));
  }

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("delivery_work_orders")
      .update({
        scheduled_date: form.scheduled_date || null,
        status: form.status,
        notes: form.notes || null,
        assigned_crew_ids: form.assigned_crew_ids,
        ...(form.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", params.id);
    setSaving(false);
    router.push("/admin/work-orders");
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  const c = order.contract;
  const lineItems = Array.isArray(c?.line_items) ? c.line_items : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/work-orders" className="p-2 rounded-lg hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Work Order</h1>
              <p className="text-white/60 text-xs">{c?.contract_number}</p>
            </div>
          </div>
          <Badge variant={STATUS_BADGE[form.status] ?? "default"}>
            {STATUS_OPTIONS.find((s) => s.value === form.status)?.label ?? form.status}
          </Badge>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24 space-y-4">
        {/* Customer & delivery info */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="font-semibold text-lg text-slate-900">
              {c?.customer?.first_name} {c?.customer?.last_name}
            </p>
            <p className="text-slate-600 text-sm">{c?.customer?.phone}</p>
            {c?.customer?.address && (
              <p className="text-slate-500 text-sm">
                {c.customer.address}, {c.customer.city}, {c.customer.state} {c.customer.zip}
              </p>
            )}
            <p className="text-xs text-slate-400 pt-1">
              {c?.show?.name ?? c?.location?.name ?? "—"} · {c?.contract_number}
            </p>
            {c?.balance_due > 0 && (
              <p className="text-sm font-semibold text-amber-700 pt-1">
                Balance due at delivery: ${c.balance_due?.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Products */}
        {lineItems.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Products to Deliver</p>
              <div className="space-y-1">
                {lineItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-700">{item.product_name}</span>
                    {item.serial_number && (
                      <span className="text-slate-400 text-xs">SN: {item.serial_number}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule + status */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Schedule</p>

            <Input
              label="Scheduled Date"
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Access code, gate instructions, customer notes…"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Crew assignment */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Assigned Crew</p>
            <div className="space-y-2">
              {crew.map((p) => {
                const assigned = form.assigned_crew_ids.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleCrew(p.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                      assigned
                        ? "bg-[#010F21] border-[#010F21] text-white"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <span className="font-medium text-sm">{p.full_name}</span>
                    {assigned && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button size="xl" className="w-full" loading={saving} onClick={handleSave}>
          Save Work Order
        </Button>

        <Link href={`/contracts/${c?.id}`} className="block text-center text-sm text-[#00929C] underline">
          View Contract →
        </Link>
      </main>
    </div>
  );
}
