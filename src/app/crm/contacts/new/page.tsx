"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

interface DupeMatch {
  id: string;
  first_name: string;
  last_name: string | null;
  email_primary: string | null;
  phone_primary: string | null;
  match_kind: "email" | "phone";
}

export default function NewContactPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<DupeMatch[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  // Debounced live dupe check — runs whenever email or phone changes.
  // Hits the trigram + unique-email indexes from migration 046 for sub-50ms
  // lookups even at 100k+ contacts.
  const checkForDupes = useCallback(async (emailVal: string, phoneVal: string) => {
    const cleanEmail = emailVal.trim().toLowerCase();
    const cleanPhone = phoneVal.replace(/\D/g, "");

    if (cleanEmail.length < 4 && cleanPhone.length < 7) {
      setDupes([]);
      return;
    }

    setCheckingDupes(true);
    const supabase = createClient();
    const matches: DupeMatch[] = [];

    if (cleanEmail.length >= 4 && cleanEmail.includes("@")) {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email_primary, phone_primary")
        .eq("email_primary", cleanEmail)
        .limit(3);
      for (const c of data ?? []) {
        matches.push({ ...c, match_kind: "email" });
      }
    }

    if (cleanPhone.length >= 7) {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email_primary, phone_primary")
        .ilike("phone_primary", `%${cleanPhone}%`)
        .limit(3);
      for (const c of data ?? []) {
        if (!matches.find((m) => m.id === c.id)) {
          matches.push({ ...c, match_kind: "phone" });
        }
      }
    }

    setDupes(matches);
    setCheckingDupes(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      checkForDupes(email, phone);
    }, 250);
    return () => clearTimeout(handle);
  }, [email, phone, checkForDupes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const payload: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      email_primary: email.trim().toLowerCase() || null,
      phone_primary: phone.trim() || null,
      source: source || null,
      notes: notes.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from("contacts")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setSubmitting(false);
      // Surface known constraint errors with friendly copy
      if (insertError.code === "23505") {
        setError("A contact with that email already exists in this organization.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    if (data?.id) {
      router.push(`/crm/contacts/${data.id}`);
    } else {
      router.push("/crm/contacts");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="sticky top-0 z-10 h-16 px-5 flex items-center gap-3 border-b border-white/5 text-white"
        style={{ backgroundColor: "#0B1929" }}
      >
        <Link
          href="/crm/contacts"
          aria-label="Back"
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight tracking-tight truncate">
            New Contact
          </h1>
          <div className="text-white/50 text-xs leading-tight truncate">Create a CRM person record</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
              />
            </div>

            {/* Live duplicate detection */}
            {dupes.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-900">
                      {dupes.length === 1 ? "Possible duplicate found" : `${dupes.length} possible duplicates found`}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Same {dupes[0].match_kind} already exists. Open the existing contact instead of creating a new one?
                    </p>
                    <ul className="mt-2 space-y-1">
                      {dupes.map((d) => {
                        const fullName = [d.first_name, d.last_name].filter(Boolean).join(" ") || "Unnamed";
                        return (
                          <li key={d.id}>
                            <Link
                              href={`/crm/contacts/${d.id}`}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white border border-amber-200 hover:border-amber-400 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{fullName}</p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {d.email_primary ?? "—"}
                                  {d.phone_primary && ` · ${d.phone_primary}`}
                                </p>
                              </div>
                              <span className="text-[10px] font-medium text-[#00929C]">Open →</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
              >
                <option value="">— Select a source —</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything important about this contact…"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C] resize-y"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50">
            <Link
              href="/crm/contacts"
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !firstName.trim()}
              className="px-4 py-2 rounded-lg bg-[#00929C] hover:bg-[#007a82] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {submitting ? "Creating…" : "Create contact"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
