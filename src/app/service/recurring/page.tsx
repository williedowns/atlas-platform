"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/layout/AppShell";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly", seasonal: "Seasonal",
};

const JOB_TYPES = ["maintenance", "repair", "warranty", "install", "follow_up", "other"];
const FREQUENCIES = ["weekly", "biweekly", "monthly", "seasonal"];

type Template = {
  id: string;
  title: string;
  job_type: string;
  frequency: string;
  next_generate_date: string | null;
  active: boolean;
  customer: { first_name: string; last_name: string } | null;
  assigned_tech: { full_name: string } | null;
  equipment: { product_name: string } | null;
};

function fmtDate(d: string | null) {
  if (!d) return "Not set";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function RecurringPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  // New template form state
  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string; email: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [techs, setTechs] = useState<{ id: string; full_name: string }[]>([]);
  const [equipment, setEquipment] = useState<{ id: string; product_name: string }[]>([]);
  const [form, setForm] = useState({
    customer_id: "", equipment_id: "", job_type: "maintenance", title: "",
    frequency: "monthly", assigned_tech_id: "", start_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
        .then(({ data }) => { setRole(data?.role ?? null); setUserName(data?.full_name ?? null); });
    });
    supabase.from("profiles").select("id, full_name").in("role", ["field_crew", "admin", "manager"]).order("full_name")
      .then(({ data }) => setTechs(data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const res = await fetch("/api/service/recurring");
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return; }
    const q = customerSearch.trim();
    supabase.from("customers").select("id, first_name, last_name, email")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8).then(({ data }) => setCustomers(data ?? []));
  }, [customerSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.customer_id) { setEquipment([]); return; }
    supabase.from("equipment").select("id, product_name").eq("customer_id", form.customer_id)
      .then(({ data }) => setEquipment(data ?? []));
  }, [form.customer_id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
    ?? (form.customer_id ? templates.find(t => t.customer?.first_name)?.customer ?? null : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || !form.title.trim()) return;
    setSubmitting(true);
    await fetch("/api/service/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, equipment_id: form.equipment_id || undefined, assigned_tech_id: form.assigned_tech_id || undefined, next_generate_date: form.start_date || undefined }),
    });
    await load();
    setShowForm(false);
    setForm({ customer_id: "", equipment_id: "", job_type: "maintenance", title: "", frequency: "monthly", assigned_tech_id: "", start_date: "" });
    setSubmitting(false);
  }

  async function generateJob(templateId: string) {
    setGeneratingId(templateId);
    setGeneratedJobId(null);
    const res = await fetch(`/api/service/recurring/${templateId}/generate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setGeneratedJobId(data.id);
      await load();
    }
    setGeneratingId(null);
  }

  async function deactivate(templateId: string) {
    setDeactivatingId(templateId);
    await fetch(`/api/service/recurring/${templateId}`, { method: "DELETE" });
    await load();
    setDeactivatingId(null);
  }

  return (
    <AppShell role={role} userName={userName}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <h1 className="text-lg font-bold">Recurring Service</h1>
          <Button variant="primary" size="sm" onClick={() => setShowForm(v => !v)}>+ New Template</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 pb-24 space-y-4">
        {generatedJobId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-emerald-800 font-medium">Job created successfully!</p>
            <Link href={`/service/jobs/${generatedJobId}`} className="text-sm font-semibold text-emerald-700 hover:underline">View Job →</Link>
          </div>
        )}

        {/* New template form */}
        {showForm && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">New Recurring Template</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Customer search */}
                {form.customer_id ? (
                  <div className="flex items-center justify-between bg-[#00929C]/5 border border-[#00929C]/30 rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {customers.find(c => c.id === form.customer_id)?.first_name ?? "Selected"} {customers.find(c => c.id === form.customer_id)?.last_name ?? ""}
                    </p>
                    <button type="button" onClick={() => { setField("customer_id", ""); setField("equipment_id", ""); setCustomerSearch(""); }} className="text-xs text-slate-400 hover:text-red-500">Change</button>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Customer *</label>
                    <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customer…" />
                    {customers.length > 0 && (
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mt-1">
                        {customers.map(c => (
                          <button key={c.id} type="button" onClick={() => { setField("customer_id", c.id); setCustomerSearch(""); setCustomers([]); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                            <p className="font-medium text-slate-900">{c.first_name} {c.last_name}</p>
                            <p className="text-xs text-slate-400">{c.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Title *</label>
                  <Input value={form.title} onChange={e => setField("title", e.target.value)} placeholder="e.g. Monthly Water Maintenance" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Job Type</label>
                    <select value={form.job_type} onChange={e => setField("job_type", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]">
                      {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Frequency</label>
                    <select value={form.frequency} onChange={e => setField("frequency", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]">
                      {FREQUENCIES.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Assigned Tech</label>
                    <select value={form.assigned_tech_id} onChange={e => setField("assigned_tech_id", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]">
                      <option value="">Unassigned</option>
                      {techs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Equipment</label>
                    <select value={form.equipment_id} onChange={e => setField("equipment_id", e.target.value)} disabled={!form.customer_id} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] disabled:opacity-50">
                      <option value="">None</option>
                      {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.product_name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">First Generate Date</label>
                  <input type="date" value={form.start_date} onChange={e => setField("start_date", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" size="sm" disabled={submitting || !form.customer_id || !form.title.trim()}>
                    {submitting ? "Creating…" : "Create Template"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Templates list */}
        {loading ? (
          <p className="text-slate-400 text-sm text-center py-8">Loading…</p>
        ) : templates.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-400 text-sm">No recurring templates yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{t.title}</p>
                      <p className="text-sm text-slate-600">
                        {t.customer?.first_name} {t.customer?.last_name}
                        {t.equipment && <span className="text-slate-400"> · {t.equipment.product_name}</span>}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                        <Badge variant="secondary">{FREQ_LABELS[t.frequency] ?? t.frequency}</Badge>
                        <span>Next: {fmtDate(t.next_generate_date)}</span>
                        {t.assigned_tech && <span>Tech: {t.assigned_tech.full_name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      <Button variant="primary" size="sm" disabled={generatingId === t.id}
                        onClick={() => generateJob(t.id)}>
                        {generatingId === t.id ? "Generating…" : "Generate Job"}
                      </Button>
                      <button onClick={() => deactivate(t.id)} disabled={deactivatingId === t.id}
                        className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-50">
                        {deactivatingId === t.id ? "Deactivating…" : "Deactivate"}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
