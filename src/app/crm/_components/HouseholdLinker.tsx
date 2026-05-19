"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  linkContactToHousehold,
  unlinkContactFromHousehold,
  createHouseholdFromContact,
} from "./householdActions";

interface CurrentHousehold {
  id: string;
  name: string;
  lifecycle_stage: string;
}

interface HouseholdLinkerProps {
  contactId: string;
  contactRole: string | null;
  currentHousehold: CurrentHousehold | null;
}

interface HouseholdRow {
  id: string;
  name: string;
  lifecycle_stage: string;
}

const ROLE_OPTIONS: Array<{ value: "primary" | "partner" | "child" | "other"; label: string }> = [
  { value: "primary", label: "Primary" },
  { value: "partner", label: "Partner" },
  { value: "child", label: "Child" },
  { value: "other", label: "Other" },
];

export default function HouseholdLinker({ contactId, contactRole, currentHousehold }: HouseholdLinkerProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Picker UI state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HouseholdRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"primary" | "partner" | "child" | "other">(
    (contactRole as any) ?? "primary"
  );
  const pickerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    const supabase = createClient();
    let request = supabase
      .from("households")
      .select("id, name, lifecycle_stage")
      .order("created_at", { ascending: false })
      .limit(10);
    if (q.trim()) {
      request = request.ilike("name", `%${q.trim()}%`);
    }
    const { data } = await request;
    setResults((data ?? []) as HouseholdRow[]);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, pickerOpen, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleQuickCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createHouseholdFromContact(contactId);
      if (!result.ok) {
        setError(result.error ?? "Failed to create household.");
      }
    });
  }

  function handleLink(householdId: string) {
    setError(null);
    startTransition(async () => {
      const result = await linkContactToHousehold({
        contactId,
        householdId,
        role: selectedRole,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to link.");
        return;
      }
      setPickerOpen(false);
      setQuery("");
    });
  }

  function handleUnlink() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkContactFromHousehold(contactId);
      if (!result.ok) setError(result.error ?? "Failed to unlink.");
    });
  }

  function handleChangeRole(role: typeof selectedRole) {
    if (!currentHousehold) return;
    setSelectedRole(role);
    setError(null);
    startTransition(async () => {
      const result = await linkContactToHousehold({
        contactId,
        householdId: currentHousehold.id,
        role,
      });
      if (!result.ok) setError(result.error ?? "Failed to update role.");
    });
  }

  if (currentHousehold) {
    return (
      <div className="space-y-3">
        <Link
          href={`/crm/households/${currentHousehold.id}`}
          className="block p-3 rounded-lg bg-[#00929C]/5 border border-[#00929C]/20 hover:border-[#00929C] transition-colors"
        >
          <p className="font-semibold text-slate-900 text-sm">{currentHousehold.name}</p>
          <p className="text-xs text-slate-500 mt-1 capitalize">{currentHousehold.lifecycle_stage}</p>
          <p className="text-[11px] text-[#00929C] mt-1.5 font-medium">View household →</p>
        </Link>

        {/* Role chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-500">Role:</span>
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={pending}
              onClick={() => handleChangeRole(r.value)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                (contactRole ?? "primary") === r.value
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleUnlink}
          className="text-[11px] text-slate-500 hover:text-red-600 underline disabled:opacity-50"
        >
          Unlink from household
        </button>

        {error && (
          <p className="text-[11px] text-red-600">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={pickerRef}>
      <p className="text-sm text-slate-400 italic">No household linked yet.</p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleQuickCreate}
          className="w-full text-left px-3 py-2 rounded-lg bg-[#00929C]/5 border border-[#00929C]/20 hover:border-[#00929C] hover:bg-[#00929C]/10 text-sm font-semibold text-[#00929C] transition-colors disabled:opacity-60"
        >
          {pending ? "Creating…" : "+ Create household from this contact"}
        </button>

        <div className="relative">
          <button
            type="button"
            disabled={pending}
            onClick={() => setPickerOpen((o) => !o)}
            className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-400 text-sm font-medium text-slate-700 transition-colors disabled:opacity-60"
          >
            ↳ Link to existing household…
          </button>

          {pickerOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search households…"
                autoFocus
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border-b border-slate-100 focus:outline-none"
              />
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
                  Role:
                </span>
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      selectedRole === r.value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {searching ? (
                  <div className="px-3 py-3 text-xs text-slate-400 text-center">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-400 text-center">
                    No households yet. <Link href="/crm/households/new" className="text-[#00929C] font-semibold hover:underline">Create one</Link>
                  </div>
                ) : (
                  results.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => handleLink(h.id)}
                      disabled={pending}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 disabled:opacity-50"
                    >
                      <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                      <p className="text-[11px] text-slate-500 capitalize">{h.lifecycle_stage}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}
    </div>
  );
}
