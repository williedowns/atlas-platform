"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createHousehold } from "../../_components/householdActions";

const TYPE_OPTIONS: Array<{ value: "residential" | "commercial" | "hoa" | "referral"; label: string; description: string }> = [
  { value: "residential", label: "Residential", description: "Couple, family, or single owner" },
  { value: "commercial", label: "Commercial", description: "Business buying for an office/property" },
  { value: "hoa", label: "HOA", description: "Homeowners association bulk deal" },
  { value: "referral", label: "Referral partner", description: "Builder, agent, or referral source" },
];

const SOURCE_OPTIONS = [
  "showroom",
  "show",
  "referral",
  "website",
  "facebook",
  "instagram",
  "google",
  "yelp",
  "phone",
  "walk_in",
  "other",
];

export default function NewHouseholdPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<"residential" | "commercial" | "hoa" | "referral">("residential");
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Household name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createHousehold({
        name,
        household_type: type,
        primary_address: primaryAddress,
        city,
        state,
        zip,
        source: source || null,
        notes,
      });

      if (!result.ok) {
        setError(result.error ?? "Failed to create household.");
        return;
      }
      if (result.id) {
        router.push(`/crm/households/${result.id}`);
      } else {
        router.push("/crm/households");
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="sticky top-0 z-10 h-16 px-5 flex items-center gap-3 border-b border-white/5 text-white"
        style={{ backgroundColor: "#0B1929" }}
      >
        <Link
          href="/crm/households"
          aria-label="Back"
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight tracking-tight truncate">New Household</h1>
          <div className="text-white/50 text-xs leading-tight truncate">Group multiple contacts into one decision unit</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Household name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder={'e.g. "Smith household" or "Reneau family"'}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                      type === t.value
                        ? "border-[#00929C] bg-[#00929C]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${type === t.value ? "text-[#00929C]" : "text-slate-900"}`}>
                      {t.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary address</label>
              <input
                type="text"
                value={primaryAddress}
                onChange={(e) => setPrimaryAddress(e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C] uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ZIP</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C] tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
              >
                <option value="">— Select —</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything important about this household…"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C] resize-y"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50">
            <Link
              href="/crm/households"
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="px-4 py-2 rounded-lg bg-[#00929C] hover:bg-[#007a82] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {pending ? "Creating…" : "Create household"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
