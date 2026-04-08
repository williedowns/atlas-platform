"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Customer = { id: string; first_name: string; last_name: string; email: string };
type Tech = { id: string; full_name: string; role: string };
type Equipment = { id: string; product_name: string; serial_number: string | null };

const JOB_TYPES = ["maintenance", "repair", "warranty", "install", "follow_up", "other"];

export default function NewServiceJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [techs, setTechs] = useState<Tech[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [form, setForm] = useState({
    customer_id: "",
    equipment_id: "",
    job_type: "maintenance",
    title: "",
    description: "",
    assigned_tech_id: "",
    scheduled_date: searchParams.get("date") ?? "",
    scheduled_time_start: "",
    scheduled_time_end: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, role").in("role", ["field_crew", "admin", "manager"]).order("full_name")
      .then(({ data }) => setTechs(data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return; }
    const q = customerSearch.trim();
    supabase.from("customers").select("id, first_name, last_name, email")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
      .then(({ data }) => setCustomers(data ?? []));
  }, [customerSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.customer_id) { setEquipment([]); return; }
    supabase.from("equipment").select("id, product_name, serial_number").eq("customer_id", form.customer_id).order("product_name")
      .then(({ data }) => setEquipment(data ?? []));
  }, [form.customer_id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError("Select a customer."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/service-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, equipment_id: form.equipment_id || undefined, assigned_tech_id: form.assigned_tech_id || undefined, scheduled_date: form.scheduled_date || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/service/jobs/${data.id}`);
    } else {
      const d = await res.json();
      setError(d.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  const selectedCustomer = customers.find(c => c.id === form.customer_id);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/service/jobs" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">New Service Job</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="font-semibold text-slate-900 text-sm">Customer</p>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-[#00929C]/5 border border-[#00929C]/30 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                    <p className="text-xs text-slate-500">{selectedCustomer.email}</p>
                  </div>
                  <button type="button" onClick={() => { setField("customer_id", ""); setField("equipment_id", ""); setCustomerSearch(""); }} className="text-xs text-slate-400 hover:text-red-500">Change</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search by name or email…" />
                  {customers.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {customers.map(c => (
                        <button key={c.id} type="button" onClick={() => { setField("customer_id", c.id); setCustomerSearch(""); setCustomers([]); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors text-sm">
                          <p className="font-medium text-slate-900">{c.first_name} {c.last_name}</p>
                          <p className="text-xs text-slate-400">{c.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job details */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="font-semibold text-slate-900 text-sm">Job Details</p>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Title <span className="text-red-500">*</span></label>
                <Input value={form.title} onChange={e => setField("title", e.target.value)} placeholder="e.g. Annual water maintenance" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Job Type</label>
                  <select value={form.job_type} onChange={e => setField("job_type", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]">
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Equipment</label>
                  <select value={form.equipment_id} onChange={e => setField("equipment_id", e.target.value)} disabled={!form.customer_id} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] disabled:opacity-50">
                    <option value="">None</option>
                    {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.product_name}{eq.serial_number ? ` (${eq.serial_number})` : ""}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={3} placeholder="What needs to be done…" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="font-semibold text-slate-900 text-sm">Scheduling</p>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Assigned Technician</label>
                <select value={form.assigned_tech_id} onChange={e => setField("assigned_tech_id", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]">
                  <option value="">Unassigned</option>
                  {techs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-xs font-medium text-slate-500 block mb-1">Date</label>
                  <input type="date" value={form.scheduled_date} onChange={e => setField("scheduled_date", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Start</label>
                  <input type="time" value={form.scheduled_time_start} onChange={e => setField("scheduled_time_start", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">End</label>
                  <input type="time" value={form.scheduled_time_end} onChange={e => setField("scheduled_time_end", e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} placeholder="Internal notes…" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none" />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="primary" size="xl" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Create Service Job"}
          </Button>
        </form>
      </main>
    </div>
  );
}
