"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

type CheckStatus = "pending" | "verified" | "discrepancy" | "na";
type CheckKind = "auto" | "manual";

interface CheckRow {
  key: string;
  label: string;
  kind: CheckKind;
  description: string;
  status: CheckStatus;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  auto_computed_status: CheckStatus | null;
  auto_reason: string | null;
}

interface PaymentRow {
  id: string;
  method: string | null;
  status: string | null;
  amount: number;
  intuit_charge_id: string | null;
}

interface ContractEntry {
  id: string;
  contract_number: string;
  customer_name: string;
  total: number;
  created_at: string;
  day_key: string | null;
  is_cash_deal: boolean;
  has_card_payments: boolean;
  payments: PaymentRow[];
  checks: CheckRow[];
}

interface ApiResponse {
  ok: boolean;
  contracts: ContractEntry[];
  summary: { ready: boolean; remaining: number };
}

interface Props {
  showId: string;
}

const STATUS_BADGE: Record<CheckStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  discrepancy: { label: "Discrepancy", cls: "bg-amber-50 text-amber-800 border-amber-300" },
  na: { label: "N/A", cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

function todayUtcKey(): string {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "verified") {
    return (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "discrepancy") {
    return (
      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
  }
  if (status === "na") {
    return (
      <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
    </svg>
  );
}

export default function VerificationDashboard({ showId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"today" | "postshow">("today");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [noteModal, setNoteModal] = useState<{
    contractId: string;
    contractNumber: string;
    checkKey: string;
    checkLabel: string;
    nextStatus: Extract<CheckStatus, "discrepancy" | "na">;
    initialNotes: string;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/shows/${showId}/verification`, { cache: "no-store" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as ApiResponse;
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load verification data");
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayUtcKey();
  const todayContracts = useMemo(
    () => (data?.contracts ?? []).filter((c) => c.day_key === today),
    [data, today],
  );
  const postShowContracts = data?.contracts ?? [];

  const visibleContracts = tab === "today" ? todayContracts : postShowContracts;

  const dayBuckets = useMemo(() => {
    if (tab === "today") return null;
    const map = new Map<string, ContractEntry[]>();
    for (const c of postShowContracts) {
      const k = c.day_key ?? "unknown";
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [postShowContracts, tab]);

  const toggleExpand = (contractId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  };

  const persist = async (
    contractId: string,
    checkKey: string,
    status: CheckStatus,
    notes: string | null,
  ) => {
    const busyKey = `${contractId}::${checkKey}`;
    setBusy((prev) => new Set(prev).add(busyKey));
    try {
      const r = await fetch(`/api/shows/${showId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: contractId, check_key: checkKey, status, notes }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(busyKey);
        return next;
      });
    }
  };

  const handleVerify = (c: ContractEntry, check: CheckRow) => {
    void persist(c.id, check.key, "verified", check.notes ?? null);
  };
  const handleNa = (c: ContractEntry, check: CheckRow) => {
    void persist(c.id, check.key, "na", check.notes ?? null);
  };
  const handleReset = (c: ContractEntry, check: CheckRow) => {
    void persist(c.id, check.key, "pending", null);
  };
  const openNoteModal = (
    c: ContractEntry,
    check: CheckRow,
    nextStatus: "discrepancy" | "na",
  ) => {
    setNoteDraft(check.notes ?? "");
    setNoteModal({
      contractId: c.id,
      contractNumber: c.contract_number,
      checkKey: check.key,
      checkLabel: check.label,
      nextStatus,
      initialNotes: check.notes ?? "",
    });
  };

  const saveNoteModal = async () => {
    if (!noteModal) return;
    const notes = noteDraft.trim();
    if (noteModal.nextStatus === "discrepancy" && !notes) {
      setError("Notes are required when flagging a discrepancy.");
      return;
    }
    await persist(noteModal.contractId, noteModal.checkKey, noteModal.nextStatus, notes || null);
    setNoteModal(null);
    setNoteDraft("");
  };

  const summary = data?.summary ?? { ready: false, remaining: 0 };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#010F21] text-white px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-base truncate">Verification Dashboard</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Daily + post-show checks before bookkeeper handoff
          </p>
        </div>
        {loading ? (
          <Badge className="bg-slate-700 text-slate-200 border-slate-600">Loading…</Badge>
        ) : summary.ready ? (
          <Badge className="bg-emerald-500 text-white border-emerald-400 font-semibold">
            Ready for Bookkeeper
          </Badge>
        ) : (
          <Badge className="bg-amber-500 text-white border-amber-400 font-semibold">
            {summary.remaining} unverified
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setTab("today")}
          className={`flex-1 py-3 text-sm font-semibold min-h-[44px] ${
            tab === "today"
              ? "bg-white text-[#00929C] border-b-2 border-[#00929C]"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Today ({todayContracts.length})
        </button>
        <button
          onClick={() => setTab("postshow")}
          className={`flex-1 py-3 text-sm font-semibold min-h-[44px] ${
            tab === "postshow"
              ? "bg-white text-[#00929C] border-b-2 border-[#00929C]"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Post-Show ({postShowContracts.length})
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        {error && (
          <div className="mb-3 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 underline font-medium"
            >
              dismiss
            </button>
          </div>
        )}

        {loading && !data && (
          <p className="text-sm text-slate-500 text-center py-6">Loading verification data…</p>
        )}

        {!loading && visibleContracts.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            {tab === "today"
              ? "No contracts created today."
              : "No contracts on this show yet."}
          </p>
        )}

        {tab === "today" &&
          visibleContracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              expanded={expanded.has(c.id)}
              onToggle={() => toggleExpand(c.id)}
              onVerify={(check) => handleVerify(c, check)}
              onFlag={(check) => openNoteModal(c, check, "discrepancy")}
              onNa={(check) => handleNa(c, check)}
              onReset={(check) => handleReset(c, check)}
              busy={busy}
            />
          ))}

        {tab === "postshow" &&
          dayBuckets &&
          dayBuckets.map(([dayKey, dayContracts]) => (
            <div key={dayKey} className="mb-4">
              <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {dayKey === "unknown"
                  ? "Unknown day"
                  : new Date(dayKey + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                <span className="ml-2 text-slate-400 normal-case">
                  · {dayContracts.length} contract{dayContracts.length === 1 ? "" : "s"}
                </span>
              </div>
              {dayContracts.map((c) => (
                <ContractCard
                  key={c.id}
                  contract={c}
                  expanded={expanded.has(c.id)}
                  onToggle={() => toggleExpand(c.id)}
                  onVerify={(check) => handleVerify(c, check)}
                  onFlag={(check) => openNoteModal(c, check, "discrepancy")}
                  onNa={(check) => handleNa(c, check)}
                  onReset={(check) => handleReset(c, check)}
                  busy={busy}
                />
              ))}
            </div>
          ))}
      </div>

      {/* Discrepancy note modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl">
            <div className="px-5 py-3 border-b border-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Contract {noteModal.contractNumber}
              </p>
              <p className="font-semibold text-slate-900">
                Flag discrepancy: {noteModal.checkLabel}
              </p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <label className="text-xs font-medium text-slate-700 block">
                What's wrong? <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Foundation portal shows $5k but contract says $6k — talked to Alex, awaiting fix"
                className="w-full h-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNoteModal(null);
                  setNoteDraft("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveNoteModal()}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md min-h-[44px]"
              >
                Flag &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ContractCardProps {
  contract: ContractEntry;
  expanded: boolean;
  onToggle: () => void;
  onVerify: (c: CheckRow) => void;
  onFlag: (c: CheckRow) => void;
  onNa: (c: CheckRow) => void;
  onReset: (c: CheckRow) => void;
  busy: Set<string>;
}

function ContractCard({
  contract,
  expanded,
  onToggle,
  onVerify,
  onFlag,
  onNa,
  onReset,
  busy,
}: ContractCardProps) {
  const verifiedCount = contract.checks.filter(
    (c) => c.status === "verified" || c.status === "na",
  ).length;
  const totalCount = contract.checks.length;
  const remaining = totalCount - verifiedCount;
  const hasDiscrepancy = contract.checks.some((c) => c.status === "discrepancy");

  return (
    <div className="mb-2 rounded-lg border border-slate-200 overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
      >
        <div className="text-left min-w-0">
          <p className="font-semibold text-slate-900 truncate">{contract.customer_name || "—"}</p>
          <p className="text-xs text-slate-500 truncate">
            {contract.contract_number} · {formatCurrency(contract.total)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasDiscrepancy && (
            <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-xs">⚠ flagged</Badge>
          )}
          <Badge
            className={`text-xs ${
              remaining === 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-slate-100 text-slate-700 border-slate-300"
            }`}
          >
            {verifiedCount}/{totalCount}
          </Badge>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
          {contract.payments.length > 0 && (
            <div className="rounded-md bg-white border border-slate-200 px-3 py-2">
              <p className="text-xs font-semibold text-slate-600 mb-1">
                Payments on this contract ({contract.payments.length})
              </p>
              <ul className="space-y-1">
                {contract.payments.map((p) => (
                  <li key={p.id} className="text-xs text-slate-700 flex justify-between gap-2">
                    <span className="truncate">
                      {p.method ?? "?"}{" "}
                      {p.intuit_charge_id && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          · {p.intuit_charge_id.slice(0, 10)}…
                        </span>
                      )}
                    </span>
                    <span className="shrink-0">
                      {formatCurrency(p.amount)}
                      <Badge
                        className={`ml-2 text-[10px] ${
                          p.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {p.status ?? "?"}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-2">
            {contract.checks.map((check) => {
              const busyKey = `${contract.id}::${check.key}`;
              const isBusy = busy.has(busyKey);
              const statusInfo = STATUS_BADGE[check.status];
              return (
                <li
                  key={check.key}
                  className={`rounded-md bg-white border ${
                    check.status === "discrepancy" ? "border-amber-300" : "border-slate-200"
                  } px-3 py-2`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon status={check.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">{check.label}</p>
                        <Badge className={`text-[10px] ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </Badge>
                        <Badge className="text-[10px] bg-slate-50 text-slate-500 border-slate-200">
                          {check.kind}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{check.description}</p>
                      {check.auto_reason && (
                        <p
                          className={`text-[11px] mt-1 ${
                            check.auto_computed_status === "verified"
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }`}
                        >
                          Auto: {check.auto_reason}
                        </p>
                      )}
                      {check.notes && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                          📝 {check.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 justify-end">
                    {check.status !== "verified" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onVerify(check)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white min-h-[36px]"
                      >
                        ✓ Verify
                      </button>
                    )}
                    {check.status !== "discrepancy" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onFlag(check)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 border border-amber-300 min-h-[36px]"
                      >
                        ⚠ Flag
                      </button>
                    )}
                    {check.status !== "na" && check.kind === "manual" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onNa(check)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-300 min-h-[36px]"
                      >
                        N/A
                      </button>
                    )}
                    {check.status !== "pending" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onReset(check)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50 min-h-[36px]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
