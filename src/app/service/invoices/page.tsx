"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";

const STATUS_TABS = ["all", "draft", "sent", "paid", "void"];
const STATUS_COLORS: Record<string, "default" | "warning" | "success" | "destructive" | "secondary"> = {
  draft: "secondary", sent: "default", paid: "success", void: "destructive",
};

type Invoice = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  line_items: { description: string; qty: number; unit_price: number }[];
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  customer: { first_name: string; last_name: string; email: string } | null;
  job: { title: string; scheduled_date: string | null; job_type: string } | null;
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ServiceInvoicesPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
        .then(({ data }) => { setRole(data?.role ?? null); setUserName(data?.full_name ?? null); });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const url = statusFilter === "all" ? "/api/service/invoices" : `/api/service/invoices?status=${statusFilter}`;
    const res = await fetch(url);
    const data = await res.json();
    setInvoices(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(invoiceId: string, status: string) {
    setUpdating(invoiceId);
    await fetch(`/api/service/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setUpdating(null);
  }

  async function bulkSend() {
    setBulkSending(true);
    setBulkResult(null);
    const res = await fetch("/api/service/invoices/bulk-send", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setBulkResult(`Sent ${data.sent} invoice${data.sent !== 1 ? "s" : ""}.`);
      await load();
    } else {
      setBulkResult("Error sending invoices.");
    }
    setBulkSending(false);
  }

  return (
    <AppShell role={role} userName={userName}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <h1 className="text-lg font-bold">Service Invoices</h1>
          <Button variant="outline" size="sm" disabled={bulkSending}
            className="text-white border-white/30 hover:bg-white/10"
            onClick={bulkSend}>
            {bulkSending ? "Sending…" : "Bulk Send Draft"}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 pb-24 space-y-4">
        {bulkResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-800 font-medium">
            {bulkResult}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors border ${
                statusFilter === s ? "bg-[#010F21] text-white border-[#010F21]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm text-center py-8">Loading…</p>
        ) : invoices.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-400 text-sm">No {statusFilter !== "all" ? statusFilter : ""} invoices.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => {
              const isExpanded = expandedId === inv.id;
              return (
                <Card key={inv.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-slate-900">
                            {inv.customer?.first_name} {inv.customer?.last_name}
                          </p>
                          <Badge variant={STATUS_COLORS[inv.status] ?? "secondary"}>{inv.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">{inv.job?.title ?? "Service Job"}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                          <span>{fmtCurrency(inv.total)}</span>
                          <span>·</span>
                          <span>Created {fmtDate(inv.created_at)}</span>
                          {inv.sent_at && <><span>·</span><span>Sent {fmtDate(inv.sent_at)}</span></>}
                          {inv.paid_at && <><span>·</span><span>Paid {fmtDate(inv.paid_at)}</span></>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {inv.status === "draft" && (
                          <Button variant="primary" size="sm" disabled={updating === inv.id}
                            onClick={() => updateStatus(inv.id, "sent")}>
                            {updating === inv.id ? "…" : "Send Invoice"}
                          </Button>
                        )}
                        {inv.status === "sent" && (
                          <Button variant="outline" size="sm" disabled={updating === inv.id}
                            onClick={() => updateStatus(inv.id, "paid")}>
                            {updating === inv.id ? "…" : "Mark Paid"}
                          </Button>
                        )}
                        <button onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                          className="text-xs text-[#00929C] hover:underline font-medium">
                          {isExpanded ? "Hide lines" : "View lines"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded line items */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-slate-500">
                              <th className="text-left pb-1 font-medium">Description</th>
                              <th className="text-center pb-1 font-medium w-12">Qty</th>
                              <th className="text-right pb-1 font-medium w-20">Price</th>
                              <th className="text-right pb-1 font-medium w-20">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(inv.line_items ?? []).map((line, i) => (
                              <tr key={i} className="border-t border-slate-50">
                                <td className="py-1.5 text-slate-800">{line.description}</td>
                                <td className="py-1.5 text-center text-slate-600">{line.qty}</td>
                                <td className="py-1.5 text-right text-slate-600">{fmtCurrency(line.unit_price)}</td>
                                <td className="py-1.5 text-right text-slate-800 font-medium">{fmtCurrency(line.qty * line.unit_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200">
                              <td colSpan={3} className="pt-2 text-right text-xs text-slate-500 font-medium">Subtotal</td>
                              <td className="pt-2 text-right font-medium text-slate-800">{fmtCurrency(inv.subtotal)}</td>
                            </tr>
                            {Number(inv.tax_amount) > 0 && (
                              <tr>
                                <td colSpan={3} className="text-right text-xs text-slate-500 font-medium">Tax</td>
                                <td className="text-right font-medium text-slate-800">{fmtCurrency(inv.tax_amount)}</td>
                              </tr>
                            )}
                            <tr>
                              <td colSpan={3} className="text-right text-sm font-bold text-slate-900">Total</td>
                              <td className="text-right text-sm font-bold text-[#00929C]">{fmtCurrency(inv.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {/* Link to related job */}
                        <Link href={`/service/jobs`} className="text-xs text-[#00929C] hover:underline mt-2 block">
                          View Service Job →
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
