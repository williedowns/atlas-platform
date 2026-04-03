"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  hot: "🔥 Hot",
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
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/leads" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">
              {lead.first_name} {lead.last_name ?? ""}
            </h1>
            <p className="text-[#00929C] text-xs">
              {lead.show?.name ?? "No show"} · {formatDate(lead.created_at)}
            </p>
          </div>
          <Badge variant={STATUS_COLORS[status]} className="flex-shrink-0">
            {STATUS_LABELS[status]}
          </Badge>
        </div>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-4 pb-10">

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
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Contact Info</h2>
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
            <p className="text-sm text-slate-600">
              <span className="font-medium">Interested in:</span> {lead.interest}
            </p>
          )}
          {lead.assigned_to_profile?.full_name && (
            <p className="text-sm text-slate-500">
              <span className="font-medium">Rep:</span> {lead.assigned_to_profile.full_name}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Status</h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  status === s
                    ? s === "lost"
                      ? "bg-red-500 text-white border-red-500"
                      : s === "converted"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-[#00929C] text-white border-[#00929C]"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h2 className="font-semibold text-slate-900 text-sm">Notes</h2>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-none"
            rows={4}
            placeholder="Follow-up notes, budget, timeline, objections..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

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

        {/* Start Contract CTA */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-1">Ready to Buy?</p>
          <p className="text-xs text-slate-500 mb-3">
            Start a contract for {lead.first_name}. You&apos;ll fill in their info in the contract wizard.
          </p>
          <Link href="/contracts/new">
            <Button variant="default" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold">
              Start Contract →
            </Button>
          </Link>
        </div>

      </main>
    </div>
  );
}
