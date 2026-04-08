"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Profile = { id: string; full_name: string };

export default function NewWorkOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractId = searchParams.get("contract_id") ?? "";
  const supabase = createClient();

  const [contract, setContract] = useState<any>(null);
  const [crew, setCrew] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contract_id: contractId,
    scheduled_date: "",
    notes: "",
    assigned_crew_ids: [] as string[],
  });

  useEffect(() => {
    if (contractId) {
      supabase
        .from("contracts")
        .select(`id, contract_number, customer:customers(first_name, last_name), location:locations(name), show:shows(name)`)
        .eq("id", contractId)
        .single()
        .then(({ data }) => setContract(data));
    }

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
    if (!form.contract_id) return;
    setSaving(true);
    const { data } = await supabase
      .from("delivery_work_orders")
      .insert({
        contract_id: form.contract_id,
        scheduled_date: form.scheduled_date || null,
        notes: form.notes || null,
        assigned_crew_ids: form.assigned_crew_ids,
        status: "scheduled",
      })
      .select()
      .single();
    setSaving(false);
    if (data) router.push(`/admin/work-orders/${data.id}`);
    else router.push("/admin/work-orders");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin/work-orders" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">New Work Order</h1>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24 space-y-4">
        {contract && (
          <Card>
            <CardContent className="p-4">
              <p className="font-semibold text-slate-900">
                {contract.customer?.first_name} {contract.customer?.last_name}
              </p>
              <p className="text-sm text-slate-500">
                {contract.contract_number} · {contract.show?.name ?? contract.location?.name ?? "—"}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-4">
            <Input
              label="Scheduled Date"
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            />
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

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Assign Crew</p>
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

        <Button size="xl" className="w-full" loading={saving} onClick={handleSave} disabled={!form.contract_id}>
          Create Work Order
        </Button>
      </main>
    </div>
  );
}
