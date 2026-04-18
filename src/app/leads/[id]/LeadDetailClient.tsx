"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate } from "@/lib/utils";

type LeadStatus = "new" | "contacted" | "hot" | "converted" | "lost";

interface Lead {
  id: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  interest?: string | null;
  status: LeadStatus;
  notes?: string | null;
  created_at: string;
  show?: { id: string; name: string } | null;
  assigned_to_profile?: { full_name: string } | null;
}

const STATUS_COLORS: Record<LeadStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  new: "default",
  contacted: "warning",
  hot: "warning",
  converted: "success",
  lost: "destructive",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  hot: "Hot",
  converted: "Converted",
  lost: "Lost",
};

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "hot", "converted", "lost"];

export default function LeadDetailClient({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, phone, email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); router.refresh(); }, 1500);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const isDirty = status !== lead.status || notes !== (lead.notes ?? "") ||
    phone !== (lead.phone ?? "") || email !== (lead.email ?? "");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title={`${lead.first_name} ${lead.last_name ?? ""}`.trim()}
        subtitle={`${lead.show?.name ?? "No show"} · ${formatDate(lead.created_at)}`}
        backHref="/leads"
        status={{
          label: STATUS_LABELS[status],
          color:
            status === "converted" ? "#10b981" :
            status === "lost" ? "#ef4444" :
            status === "hot" ? "#f59e0b" :
            status === "contacted" ? "#3b82f6" :
            "#64748b",
          pulsing: status === "hot",
        }}
      />

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4 pb-10">

        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800 font-medium text-sm">
            ✓ Saved
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Contact info */}
        <SectionCard title="Contact Info">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            {lead.interest && (
              <div className="flex items-start gap-2 pt-1 text-sm text-slate-600">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-0.5">Interest</span>
                <span>{lead.interest}</span>
              </div>
            )}
            {lead.assigned_to_profile?.full_name && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-0.5">Rep</span>
                <span>{lead.assigned_to_profile.full_name}</span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Status */}
        <SectionCard title="Status">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const active = status === s;
              const baseClass = "px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border";
              const activeClass =
                s === "lost"
                  ? "bg-red-500 text-white border-red-500 shadow-sm"
                  : s === "converted"
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : s === "hot"
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-[#00929C] text-white border-[#00929C] shadow-sm";
              const inactiveClass = "bg-white text-slate-600 border-slate-200 hover:border-slate-300";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`${baseClass} ${active ? activeClass : inactiveClass}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Notes">
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-none"
            rows={4}
            placeholder="Follow-up notes, budget, timeline, objections..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </SectionCard>

        {/* Save */}
        {isDirty && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00929C] hover:bg-[#007a82] text-white font-semibold"
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        )}

        {/* Convert CTA — prominent gradient */}
        <Link
          href="/contracts/new"
          className="block rounded-xl p-5 text-white relative overflow-hidden group transition-transform hover:scale-[1.005] shadow-md"
          style={{ background: "linear-gradient(135deg, #010F21 0%, #00929C 140%)" }}
        >
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">
                Ready to buy?
              </div>
              <div className="text-lg md:text-xl font-black leading-tight">
                Start Contract for {lead.first_name} →
              </div>
              <div className="text-xs text-white/70 mt-1">
                Pre-fills name, phone, and email in the contract wizard.
              </div>
            </div>
            <div className="text-4xl md:text-5xl font-black text-white/10 select-none">GO</div>
          </div>
        </Link>

      </main>
    </div>
  );
}
