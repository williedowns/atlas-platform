"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, "default" | "warning" | "success" | "destructive" | "secondary"> = {
  draft: "secondary", scheduled: "default", in_progress: "warning", completed: "success", cancelled: "destructive",
};
const NEXT_STATUS: Record<string, string> = {
  draft: "scheduled", scheduled: "in_progress", in_progress: "completed",
};

function fmt(d: string | null) {
  if (!d) return "TBD";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type Job = any;

export default function ServiceJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [job, setJob] = useState<Job | null>(null);
  const [techs, setTechs] = useState<{ id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [showNotifyForm, setShowNotifyForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState([{ description: "", qty: 1, unit_price: 0 }]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("service_jobs")
      .select("*, customer:customers(first_name,last_name,email,phone), equipment:equipment(product_name,serial_number), assigned_tech:profiles(full_name), water_tests:service_job_water_tests(*), photos:service_job_photos(*), invoice:service_invoices(id,status,total)")
      .eq("id", id).single();
    setJob(data);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from("profiles").select("id, full_name").in("role", ["field_crew", "admin", "manager"]).order("full_name")
      .then(({ data }) => setTechs(data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateStatus(status: string) {
    setSaving(true);
    await fetch(`/api/service-jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await load(); setSaving(false);
  }

  async function reassign(tech_id: string) {
    setSaving(true);
    await fetch(`/api/service-jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigned_tech_id: tech_id || null }) });
    await load(); setSaving(false);
  }

  async function sendNotification() {
    setNotifying(true);
    await fetch(`/api/service-jobs/${id}/notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: notifyMsg }) });
    setNotifying(false); setShowNotifyForm(false); setNotifyMsg("");
    alert("Notification sent to customer.");
  }

  async function createInvoice() {
    const valid = invoiceLines.filter(l => l.description.trim() && l.qty > 0 && l.unit_price > 0);
    if (valid.length === 0) return;
    setSaving(true);
    const res = await fetch(`/api/service-jobs/${id}/invoice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line_items: valid }) });
    if (res.ok) { await load(); setShowInvoiceForm(false); }
    setSaving(false);
  }

  if (!job) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">Loading…</p></div>;

  const customer = job.customer;
  const equipment = job.equipment;
  const tech = job.assigned_tech;
  const waterTests: any[] = job.water_tests ?? [];
  const photos: any[] = job.photos ?? [];
  const invoice = job.invoice;
  const nextStatus = NEXT_STATUS[job.status];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/service/jobs" className="p-2 rounded-lg hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <h1 className="text-base font-bold truncate max-w-[180px]">{job.title}</h1>
              <p className="text-white/60 text-xs">{job.job_type.replace("_", " ")}</p>
            </div>
          </div>
          <Badge variant={STATUS_COLORS[job.status] ?? "secondary"}>{job.status.replace("_", " ")}</Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24 space-y-4">
        {/* Customer & Schedule */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{customer?.first_name} {customer?.last_name}</p>
                <p className="text-sm text-slate-500">{customer?.email}</p>
                {customer?.phone && <p className="text-sm text-slate-500">{customer.phone}</p>}
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-slate-900">{fmt(job.scheduled_date)}</p>
                {job.scheduled_time_start && <p className="text-slate-500">{job.scheduled_time_start.slice(0,5)}{job.scheduled_time_end ? ` – ${job.scheduled_time_end.slice(0,5)}` : ""}</p>}
              </div>
            </div>
            {equipment && (
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium">Equipment:</span> {equipment.product_name}
                {equipment.serial_number && <span className="text-slate-400"> · S/N: {equipment.serial_number}</span>}
              </div>
            )}
            {job.description && <p className="text-sm text-slate-600">{job.description}</p>}
          </CardContent>
        </Card>

        {/* Assign tech */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Assigned Technician</p>
            <select value={job.assigned_tech_id ?? ""} onChange={e => reassign(e.target.value)} disabled={saving}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]">
              <option value="">Unassigned</option>
              {techs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </CardContent>
        </Card>

        {/* Status actions */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <div className="flex gap-2">
            {nextStatus && (
              <Button variant="primary" size="lg" className="flex-1" disabled={saving} onClick={() => updateStatus(nextStatus)}>
                Mark {nextStatus.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
              </Button>
            )}
            <Button variant="outline" size="lg" disabled={saving} onClick={() => updateStatus("cancelled")}
              className="text-red-600 border-red-200 hover:bg-red-50">
              Cancel
            </Button>
          </div>
        )}

        {/* Notify & Invoice */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowNotifyForm(v => !v)}>
            Send Notification
          </Button>
          {!invoice && job.status === "completed" && (
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowInvoiceForm(v => !v)}>
              Generate Invoice
            </Button>
          )}
        </div>

        {showNotifyForm && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Dispatch Notification</p>
              <textarea value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} rows={3} placeholder="Optional custom message for customer…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none" />
              <Button variant="primary" size="sm" disabled={notifying} onClick={sendNotification}>
                {notifying ? "Sending…" : "Send to " + (customer?.first_name ?? "Customer")}
              </Button>
            </CardContent>
          </Card>
        )}

        {showInvoiceForm && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">New Invoice</p>
              {invoiceLines.map((line, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <input value={line.description} onChange={e => { const l = [...invoiceLines]; l[i].description = e.target.value; setInvoiceLines(l); }}
                    placeholder="Description" className="col-span-3 h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                  <input type="number" value={line.qty} onChange={e => { const l = [...invoiceLines]; l[i].qty = Number(e.target.value); setInvoiceLines(l); }}
                    placeholder="Qty" min="1" className="h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                  <input type="number" value={line.unit_price} onChange={e => { const l = [...invoiceLines]; l[i].unit_price = Number(e.target.value); setInvoiceLines(l); }}
                    placeholder="Price" min="0" step="0.01" className="h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                </div>
              ))}
              <button type="button" onClick={() => setInvoiceLines(l => [...l, { description: "", qty: 1, unit_price: 0 }])}
                className="text-sm text-[#00929C] hover:text-[#007a82] font-medium">+ Add Line</button>
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-slate-900">
                  Total: {fmtCurrency(invoiceLines.reduce((s, l) => s + l.qty * l.unit_price, 0))}
                </p>
                <Button variant="primary" size="sm" disabled={saving} onClick={createInvoice}>Create Invoice</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice status */}
        {invoice && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900 text-sm">Invoice</p>
                <p className="text-xs text-slate-500">{fmtCurrency(invoice.total)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "sent" ? "default" : "secondary"}>
                  {invoice.status}
                </Badge>
                <Link href="/service/invoices" className="text-xs text-[#00929C] font-medium hover:underline">View</Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Water Tests */}
        {waterTests.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Water Tests ({waterTests.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {waterTests.map((t: any, i: number) => (
                <div key={t.id} className={`px-4 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                  <p className="text-xs text-slate-400 mb-1.5">{new Date(t.tested_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {t.ph != null && <div><span className="text-slate-500 text-xs">pH</span><p className="font-semibold text-slate-900">{t.ph}</p></div>}
                    {t.sanitizer_ppm != null && <div><span className="text-slate-500 text-xs">Sanitizer</span><p className="font-semibold text-slate-900">{t.sanitizer_ppm} ppm</p></div>}
                    {t.temp_f != null && <div><span className="text-slate-500 text-xs">Temp</span><p className="font-semibold text-slate-900">{t.temp_f}°F</p></div>}
                    {t.alkalinity != null && <div><span className="text-slate-500 text-xs">Alkalinity</span><p className="font-semibold text-slate-900">{t.alkalinity} ppm</p></div>}
                    {t.hardness != null && <div><span className="text-slate-500 text-xs">Hardness</span><p className="font-semibold text-slate-900">{t.hardness} ppm</p></div>}
                  </div>
                  {t.notes && <p className="text-xs text-slate-500 mt-1 italic">{t.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Photos ({photos.length})</CardTitle></CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p: any) => (
                  <a key={p.id} href={p.storage_url} target="_blank" rel="noopener noreferrer">
                    <img src={p.storage_url} alt={p.caption ?? "Photo"} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin notes */}
        <AdminNotes jobId={id} initialNotes={job.admin_notes ?? ""} onSave={load} />
      </main>
    </div>
  );
}

function AdminNotes({ jobId, initialNotes, onSave }: { jobId: string; initialNotes: string; onSave: () => void }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/service-jobs/${jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin_notes: notes }) });
    setSaving(false); onSave();
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <p className="text-xs font-medium text-slate-500">Admin Notes</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Internal notes…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none" />
        <button onClick={save} disabled={saving} className="text-sm font-medium text-[#00929C] hover:text-[#007a82] disabled:opacity-50">
          {saving ? "Saving…" : "Save Notes"}
        </button>
      </CardContent>
    </Card>
  );
}
