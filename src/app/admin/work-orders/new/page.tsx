"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReadinessBlockerPanel from "@/components/contracts/ReadinessBlockerPanel";
import ReadinessChecklist from "@/components/contracts/ReadinessChecklist";
import ConflictWarningPanel from "@/components/contracts/ConflictWarningPanel";
import { evaluateReadiness, blockerLabels, type ReadinessResult } from "@/lib/readiness";

type Profile = { id: string; full_name: string };

function NewWorkOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractId = searchParams.get("contract_id") ?? "";
  const supabase = createClient();

  const [contract, setContract] = useState<any>(null);
  const [crew, setCrew] = useState<Profile[]>([]);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [canOverride, setCanOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [conflictReason, setConflictReason] = useState("");
  const [form, setForm] = useState({
    contract_id: contractId,
    scheduled_date: "",
    scheduled_window: "",
    notes: "",
    assigned_crew_ids: [] as string[],
  });

  useEffect(() => {
    async function load() {
      if (!contractId) return;

      // Pull contract (with readiness fields), caller role, and crew list in parallel.
      const [
        { data: contractData },
        { data: { user } },
        { data: crewData },
      ] = await Promise.all([
        supabase
          .from("contracts")
          .select(`
            id, contract_number, balance_due, financing, customer_id,
            needs_permit, permit_status, needs_hoa, hoa_status,
            customer:customers(first_name, last_name),
            location:locations(name),
            show:shows(name)
          `)
          .eq("id", contractId)
          .single(),
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("role", ["field_crew", "admin", "manager"])
          .order("full_name"),
      ]);

      setContract(contractData);
      setCrew(crewData ?? []);

      if (!contractData) return;

      const [{ data: dlRows }, { data: profile }] = await Promise.all([
        contractData.customer_id
          ? supabase
              .from("customer_files")
              .select("id")
              .eq("customer_id", contractData.customer_id)
              .eq("category", "drivers_license")
              .limit(1)
          : Promise.resolve({ data: [] as Array<{ id: string }> }),
        user
          ? supabase.from("profiles").select("role").eq("id", user.id).single()
          : Promise.resolve({ data: null }),
      ]);

      const result = evaluateReadiness(contractData, (dlRows ?? []).length > 0);
      const isAdminOrManager = ["admin", "manager"].includes((profile as any)?.role ?? "");
      setReadiness(result);
      setCanOverride(isAdminOrManager);
      // Pre-populate blockers so the override panel appears immediately when
      // items are missing — same proactive UX as the contract detail page.
      if (!result.ok) setBlockers(blockerLabels(result));
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCrew(id: string) {
    setForm((f) => ({
      ...f,
      assigned_crew_ids: f.assigned_crew_ids.includes(id)
        ? f.assigned_crew_ids.filter((x) => x !== id)
        : [...f.assigned_crew_ids, id],
    }));
  }

  async function handleSave(opts: { overrideReadiness?: boolean; overrideConflicts?: boolean } = {}) {
    const { overrideReadiness = false, overrideConflicts = false } = opts;
    if (!form.contract_id || !form.scheduled_date) return;
    setSaving(true);
    setError(null);
    if (!overrideReadiness) {
      setBlockers([]);
      setCanOverride(false);
    }
    if (!overrideConflicts) setConflicts([]);

    const r = await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: form.contract_id,
        scheduled_date: form.scheduled_date,
        scheduled_window: form.scheduled_window || null,
        special_instructions: form.notes || null,
        assigned_crew_ids: form.assigned_crew_ids,
        override_readiness: overrideReadiness,
        override_reason: overrideReadiness ? overrideReason : null,
        override_conflicts: overrideConflicts,
        conflict_reason: overrideConflicts ? conflictReason : null,
      }),
    });
    setSaving(false);

    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      if (r.status === 409 && body.blockers) {
        setBlockers(body.blockers);
        setCanOverride(!!body.can_override);
        return;
      }
      if (r.status === 409 && body.conflicts) {
        setConflicts(body.conflicts);
        return;
      }
      setError(body.error ?? "Failed to create work order");
      return;
    }

    const { delivery } = await r.json();
    if (delivery?.id) router.push(`/admin/work-orders/${delivery.id}`);
    else router.push("/admin/work-orders");
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto pb-24 space-y-4">
      {contract && (
        <Card>
          <CardContent className="p-4">
            <p className="font-semibold text-slate-900">
              {contract.customer?.first_name} {contract.customer?.last_name}
            </p>
            <p className="text-sm text-slate-500">
              {contract.contract_number} · {contract.show?.name ?? contract.location?.name ?? "—"}
            </p>
          </CardContent>
        </Card>
      )}

      {readiness && <ReadinessChecklist readiness={readiness} />}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Scheduled Date"
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            />
            <Input
              label="Time Window"
              type="text"
              placeholder="e.g. 2-4 PM"
              value={form.scheduled_window}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_window: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Access code, gate instructions, customer notes…"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Assign Crew</p>
          <div className="space-y-2">
            {crew.map((p) => {
              const assigned = form.assigned_crew_ids.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleCrew(p.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                    assigned
                      ? "bg-[#010F21] border-[#010F21] text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <span className="font-medium text-sm">{p.full_name}</span>
                  {assigned && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ReadinessBlockerPanel
        blockers={blockers}
        canOverride={canOverride}
        overrideReason={overrideReason}
        onOverrideReasonChange={setOverrideReason}
        onConfirm={() => handleSave({ overrideReadiness: true })}
        submitting={saving}
        confirmLabel="Override and Create Anyway"
      />

      <ConflictWarningPanel
        conflicts={conflicts}
        reason={conflictReason}
        onReasonChange={setConflictReason}
        onContinue={() => handleSave({ overrideConflicts: true })}
        submitting={saving}
        continueLabel="Create Anyway"
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button
        size="xl"
        className="w-full"
        loading={saving}
        onClick={() => handleSave()}
        disabled={!form.contract_id || !form.scheduled_date}
      >
        Create Work Order
      </Button>
    </main>
  );
}

export default function NewWorkOrderPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin/work-orders" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">New Work Order</h1>
        </div>
      </header>
      <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-400">Loading…</div>}>
        <NewWorkOrderForm />
      </Suspense>
    </div>
  );
}
