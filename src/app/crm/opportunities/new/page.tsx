"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Pipeline {
  id: string;
  name: string;
  type: string;
}

interface Stage {
  id: string;
  name: string;
  display_order: number;
  pipeline_id: string;
}

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email_primary: string | null;
  phone_primary: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
}

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

const INTEREST_OPTIONS = [
  { value: "hot_tub", label: "Hot tub" },
  { value: "swim_spa", label: "Swim spa" },
  { value: "cold_tub", label: "Cold tub" },
  { value: "above_ground_pool", label: "Above-ground pool" },
  { value: "accessory", label: "Accessory" },
  { value: "service", label: "Service" },
];

export default function NewOpportunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStageId = searchParams.get("stage_id");
  const initialContactId = searchParams.get("contact_id");
  const initialPipelineId = searchParams.get("pipeline_id");

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [reps, setReps] = useState<Profile[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [name, setName] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState(initialStageId ?? "");
  const [contactId, setContactId] = useState<string | null>(initialContactId);
  const [contactDisplay, setContactDisplay] = useState("");
  const [valueEstimate, setValueEstimate] = useState("");
  const [source, setSource] = useState("");
  const [interestCategory, setInterestCategory] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactRow[]>([]);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const contactBoxRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load pipelines + stages + reps + (optional) preselected contact
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const [pipesRes, stagesRes, repsRes] = await Promise.all([
        supabase.from("pipelines").select("id, name, type").order("name"),
        supabase.from("pipeline_stages").select("id, name, display_order, pipeline_id").order("display_order"),
        supabase.from("profiles").select("id, full_name, role").in("role", ["admin", "manager", "sales_rep"]).order("full_name"),
      ]);

      const pipelinesData = (pipesRes.data ?? []) as Pipeline[];
      const stagesData = (stagesRes.data ?? []) as Stage[];
      const repsData = (repsRes.data ?? []) as Profile[];

      setPipelines(pipelinesData);
      setStages(stagesData);
      setReps(repsData);

      // Pick the initial pipeline:
      //   1) ?stage_id=X — pipeline is derived from the stage (most specific)
      //   2) ?pipeline_id=X — explicit override
      //   3) Retail Sales (default)
      //   4) First pipeline (fallback)
      let resolvedPipeline: Pipeline | undefined;
      if (initialStageId) {
        const stageMatch = stagesData.find((s) => s.id === initialStageId);
        if (stageMatch) {
          resolvedPipeline = pipelinesData.find((p) => p.id === stageMatch.pipeline_id);
        }
      }
      if (!resolvedPipeline && initialPipelineId) {
        resolvedPipeline = pipelinesData.find((p) => p.id === initialPipelineId);
      }
      if (!resolvedPipeline) {
        resolvedPipeline =
          pipelinesData.find((p) => p.name === "Retail Sales") ?? pipelinesData[0];
      }

      if (resolvedPipeline) {
        setPipelineId(resolvedPipeline.id);
        if (!initialStageId) {
          const firstStage = stagesData
            .filter((s) => s.pipeline_id === resolvedPipeline!.id)
            .sort((a, b) => a.display_order - b.display_order)[0];
          if (firstStage) setStageId(firstStage.id);
        }
      }

      // Default owner = current user if they're a sales role
      setOwnerId(user.id);

      // If a contact was preselected, fetch it
      if (initialContactId) {
        const { data: c } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email_primary")
          .eq("id", initialContactId)
          .single();
        if (c) {
          setContactDisplay([c.first_name, c.last_name].filter(Boolean).join(" "));
        }
      }

      setLoadingMeta(false);
    }
    load();
  }, [initialStageId, initialContactId, initialPipelineId]);

  // When pipeline changes, reset stage to that pipeline's first stage
  useEffect(() => {
    if (!pipelineId) return;
    const stageBelongsToPipeline = stages.find((s) => s.id === stageId)?.pipeline_id === pipelineId;
    if (!stageBelongsToPipeline) {
      const firstStage = stages
        .filter((s) => s.pipeline_id === pipelineId)
        .sort((a, b) => a.display_order - b.display_order)[0];
      if (firstStage) setStageId(firstStage.id);
    }
  }, [pipelineId, stages, stageId]);

  // Debounced contact search
  const searchContacts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setContactResults([]);
      return;
    }
    setSearchingContacts(true);
    const supabase = createClient();
    const term = `%${q.trim()}%`;
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email_primary, phone_primary")
      .or(`first_name.ilike.${term},last_name.ilike.${term},email_primary.ilike.${term},phone_primary.ilike.${term}`)
      .limit(10);
    setContactResults((data ?? []) as ContactRow[]);
    setSearchingContacts(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (contactDropdownOpen) searchContacts(contactQuery);
    }, 200);
    return () => clearTimeout(handle);
  }, [contactQuery, contactDropdownOpen, searchContacts]);

  // Close contact dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (contactBoxRef.current && !contactBoxRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pickContact(c: ContactRow) {
    setContactId(c.id);
    setContactDisplay([c.first_name, c.last_name].filter(Boolean).join(" "));
    setContactQuery("");
    setContactDropdownOpen(false);
  }

  function clearContact() {
    setContactId(null);
    setContactDisplay("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Opportunity name is required."); return; }
    if (!pipelineId) { setError("Pipeline is required."); return; }
    if (!stageId) { setError("Stage is required."); return; }

    setSubmitting(true);
    const supabase = createClient();

    const valueNum = valueEstimate.trim() ? Number(valueEstimate.replace(/[^0-9.]/g, "")) : null;

    const stage = stages.find((s) => s.id === stageId);
    const probability = stage ? null : null;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      pipeline_id: pipelineId,
      stage_id: stageId,
      primary_contact_id: contactId,
      value_estimate: valueNum,
      source: source || null,
      interest_category: interestCategory || null,
      owner_id: ownerId,
      status: "open",
    };
    if (probability != null) payload.probability = probability;

    const { data, error: insertError } = await supabase
      .from("opportunities")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    if (data?.id) {
      router.push(`/crm/opportunities/${data.id}`);
    } else {
      router.push("/crm/pipeline");
    }
  }

  const filteredStages = stages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="sticky top-0 z-10 h-16 px-5 flex items-center gap-3 border-b border-white/5 text-white"
        style={{ backgroundColor: "#0B1929" }}
      >
        <Link
          href="/crm/pipeline"
          aria-label="Back"
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight tracking-tight truncate">New Opportunity</h1>
          <div className="text-white/50 text-xs leading-tight truncate">Create a deal in the pipeline</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {loadingMeta ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="w-6 h-6 border-2 border-[#00929C] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-visible">
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Opportunity name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. Smith family — Twilight 8.25"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                />
              </div>

              {/* Contact picker */}
              <div ref={contactBoxRef}>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Primary contact
                </label>
                {contactId ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-[#00929C]/5 border border-[#00929C]/30 rounded-lg">
                    <span className="text-sm font-semibold text-slate-900">{contactDisplay}</span>
                    <button
                      type="button"
                      onClick={clearContact}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={contactQuery}
                      onChange={(e) => setContactQuery(e.target.value)}
                      onFocus={() => setContactDropdownOpen(true)}
                      placeholder="Search contacts by name, email, or phone…"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                    />
                    {contactDropdownOpen && (contactQuery.trim() || contactResults.length > 0) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                        {searchingContacts ? (
                          <div className="px-3 py-3 text-xs text-slate-400 text-center">Searching…</div>
                        ) : contactResults.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-slate-400 text-center">
                            No contacts found.{" "}
                            <Link href="/crm/contacts/new" className="text-[#00929C] font-semibold hover:underline">
                              Create one
                            </Link>
                          </div>
                        ) : (
                          contactResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => pickContact(c)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {c.email_primary ?? "no email"}
                                {c.phone_primary && ` · ${c.phone_primary}`}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pipeline + Stage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pipeline <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={pipelineId}
                    onChange={(e) => setPipelineId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Stage <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                  >
                    {filteredStages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Value + Interest */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Estimated value
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valueEstimate}
                      onChange={(e) => setValueEstimate(e.target.value)}
                      placeholder="12,500"
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C] tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Interest
                  </label>
                  <select
                    value={interestCategory}
                    onChange={(e) => setInterestCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                  >
                    <option value="">— Select —</option>
                    {INTEREST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source + Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Source
                  </label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Owner
                  </label>
                  <select
                    value={ownerId ?? ""}
                    onChange={(e) => setOwnerId(e.target.value || null)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                  >
                    <option value="">— Unassigned —</option>
                    {reps.map((r) => (
                      <option key={r.id} value={r.id}>{r.full_name ?? "(no name)"}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50">
              <Link
                href="/crm/pipeline"
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !pipelineId || !stageId}
                className="px-4 py-2 rounded-lg bg-[#00929C] hover:bg-[#007a82] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {submitting ? "Creating…" : "Create opportunity"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
