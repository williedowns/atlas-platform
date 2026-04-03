"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INTEREST_OPTIONS = [
  "Swim Spa",
  "Hot Tub / Spa",
  "Sauna",
  "Accessories",
  "Just Browsing",
  "Other",
];

interface Show {
  id: string;
  name: string;
  venue_name: string;
  city: string;
  state: string;
}

interface CapturedLead {
  id: string;
  name: string;
  phone?: string;
  interest?: string;
}

export default function CheckInForm({ show }: { show: Show }) {
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionLeads, setSessionLeads] = useState<CapturedLead[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setInterest("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) { setErrorMsg("First name is required."); return; }
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show_id: show.id,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          interest: interest || null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg((body as { error?: string }).error ?? "Failed to save. Try again.");
        return;
      }

      const { id } = await res.json() as { id: string };
      const displayName = [firstName, lastName].filter(Boolean).join(" ");
      setSessionLeads((prev) => [
        { id, name: displayName, phone: phone || undefined, interest: interest || undefined },
        ...prev,
      ]);
      setSuccessMsg(`✓ ${displayName} checked in!`);
      resetForm();
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href={`/shows/${show.id}`} className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Lead Check-In</h1>
            <p className="text-[#00929C] text-xs truncate">{show.name} · {show.venue_name}</p>
          </div>
          {sessionLeads.length > 0 && (
            <div className="bg-[#00929C] text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
              {sessionLeads.length} captured
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-4 pb-10">

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800 font-medium text-sm">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">New Lead</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">First Name *</label>
              <Input
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Last Name</label>
              <Input
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
            <Input
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
            <Input
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">Interested In</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInterest(interest === opt ? "" : opt)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    interest === opt
                      ? "bg-[#00929C] text-white border-[#00929C]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#00929C]/50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-none"
              rows={2}
              placeholder="Budget, timeline, hot buttons..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !firstName.trim()}
            className="w-full bg-[#00929C] hover:bg-[#007a82] text-white font-semibold py-3 text-base"
          >
            {submitting ? "Saving…" : "Check In Lead →"}
          </Button>
        </form>

        {/* Leads captured this session */}
        {sessionLeads.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Captured This Session ({sessionLeads.length})
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {sessionLeads.map((lead) => (
                <li key={lead.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{lead.name}</p>
                    <p className="text-xs text-slate-400">
                      {lead.phone ?? "No phone"} · {lead.interest ?? "–"}
                    </p>
                  </div>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-xs text-[#00929C] font-medium hover:underline"
                  >
                    View →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-center">
          <Link href="/leads" className="text-sm text-[#00929C] hover:underline font-medium">
            View all leads →
          </Link>
        </div>

      </main>
    </div>
  );
}
