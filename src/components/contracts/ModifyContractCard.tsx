"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { PER_NAT_REASON_LABEL, daysHeld, holdSeverity } from "@/lib/per-nat";

interface CurrentUnit {
  inventory_unit_id: string;
  serial_number: string | null;
  model: string | null;
  stock_assigned_at: string | null;
}

interface FinancingEntryLite {
  financer_name?: string;
  financed_amount?: number;
  deduct_from_balance?: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  actor_name: string | null;
  metadata: Record<string, unknown>;
}

interface Props {
  contractId: string;
  contractNumber: string;
  total: number;
  depositPaid: number;
  balanceDue: number;
  isPerNat: boolean;
  perNatReason: string | null;
  currentUnit: CurrentUnit | null;
  financing: FinancingEntryLite[];
  auditEntries: AuditEntry[];
}

const KNOWN_FINANCERS = [
  "Wells Fargo",
  "Synchrony",
  "Foundation",
  "Lyon",
  "GreenSky",
  "In-house",
];

const REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "low_deposit", label: PER_NAT_REASON_LABEL.low_deposit },
  { value: "future_delivery", label: PER_NAT_REASON_LABEL.future_delivery },
  { value: "special_order", label: PER_NAT_REASON_LABEL.special_order },
  { value: "manual", label: PER_NAT_REASON_LABEL.manual },
];

export default function ModifyContractCard({
  contractId,
  contractNumber,
  total,
  depositPaid,
  balanceDue,
  isPerNat,
  perNatReason,
  currentUnit,
  financing,
  auditEntries,
}: Props) {
  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Modify Contract
          <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
            Admin / Manager only
          </span>
        </CardTitle>
        <p className="text-xs text-slate-600 mt-1">
          Post-sale changes. Every edit is recorded in the audit log below.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        <PerNatSection
          contractId={contractId}
          contractNumber={contractNumber}
          isPerNat={isPerNat}
          perNatReason={perNatReason}
        />
        <InventoryUnitSection
          contractId={contractId}
          currentUnit={currentUnit}
        />
        <FinancingConversionSection
          contractId={contractId}
          total={total}
          depositPaid={depositPaid}
          balanceDue={balanceDue}
          financing={financing}
        />
        <AuditLogSection entries={auditEntries} />
      </CardContent>
    </Card>
  );
}

// ─── Per Nat flag toggle ─────────────────────────────────────────────────────
function PerNatSection({
  contractId,
  contractNumber: _contractNumber,
  isPerNat,
  perNatReason,
}: {
  contractId: string;
  contractNumber: string;
  isPerNat: boolean;
  perNatReason: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(isPerNat);
  const [reason, setReason] = useState<string>(perNatReason ?? "manual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = enabled !== isPerNat || (enabled && reason !== (perNatReason ?? "manual"));

  async function save() {
    setBusy(true);
    setErr(null);
    const body = enabled ? { is_per_nat: true, reason } : { is_per_nat: false };
    const r = await fetch(`/api/contracts/${contractId}/per-nat-flag`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setErr(b.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  return (
    <section>
      <h4 className="text-sm font-bold text-slate-900 mb-2">Per Nat status</h4>
      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#00929C]"
          />
          On the Per Nat list
        </label>
        {enabled && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-700 font-medium">Reason:</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30"
            >
              {REASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
        {err && <p className="text-xs text-red-700">{err}</p>}
        <div className="flex justify-end pt-1">
          <Button
            variant="accent"
            size="sm"
            disabled={!dirty || busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save Per Nat status"}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Inventory unit assign / release ─────────────────────────────────────────
function InventoryUnitSection({
  contractId,
  currentUnit,
}: {
  contractId: string;
  currentUnit: CurrentUnit | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [releaseReason, setReleaseReason] = useState("");

  const heldDays = daysHeld(currentUnit?.stock_assigned_at ?? null);
  const severity = holdSeverity(heldDays);
  const heldChip =
    severity === "critical"
      ? "bg-red-100 text-red-800 border-red-300"
      : severity === "warn"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-slate-100 text-slate-700 border-slate-300";

  async function assign() {
    if (serialInput.trim().length === 0) return;
    setBusy(true);
    setErr(null);
    setErrCode(null);
    const r = await fetch(`/api/contracts/${contractId}/inventory-unit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial_number: serialInput.trim() }),
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setErr(b.error ?? "Assignment failed");
      setErrCode(b.code ?? null);
      return;
    }
    setSerialInput("");
    router.refresh();
  }

  async function release() {
    if (!confirm("Release this inventory unit? It will return to available stock.")) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/contracts/${contractId}/inventory-unit`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: releaseReason.trim() || undefined }),
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setErr(b.error ?? "Release failed");
      return;
    }
    setReleaseReason("");
    router.refresh();
  }

  return (
    <section>
      <h4 className="text-sm font-bold text-slate-900 mb-2">Inventory unit</h4>
      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-3">
        {currentUnit ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-sm">
                  {currentUnit.serial_number ?? "(no serial)"}
                </p>
                <p className="text-xs text-slate-600">
                  {currentUnit.model ?? "Unknown model"}
                  {heldDays !== null && (
                    <span className={cn("ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border", heldChip)}>
                      {heldDays}d held
                      {severity === "critical" && " · 90-day rule!"}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Release reason (optional)"
                className="text-sm flex-1"
              />
              <Button variant="outline" size="sm" disabled={busy} onClick={release}>
                {busy ? "…" : "Release unit"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">No inventory unit currently assigned.</p>
            <div className="flex items-center gap-2">
              <Input
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="Serial number (e.g. W246016)"
                className="text-sm flex-1"
              />
              <Button variant="accent" size="sm" disabled={busy || !serialInput.trim()} onClick={assign}>
                {busy ? "…" : "Assign unit"}
              </Button>
            </div>
            {err && errCode === "deposit_below_30_pct" && (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-sm">
                <p className="font-semibold text-red-800">
                  You have to add at least a 30% deposit in order to tag it.
                </p>
              </div>
            )}
            {err && errCode !== "deposit_below_30_pct" && (
              <p className="text-xs text-red-700">{err}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Balance → Financing conversion ──────────────────────────────────────────
function FinancingConversionSection({
  contractId,
  total,
  depositPaid,
  balanceDue,
  financing,
}: {
  contractId: string;
  total: number;
  depositPaid: number;
  balanceDue: number;
  financing: FinancingEntryLite[];
}) {
  const router = useRouter();

  // Live calc — the math the rep sees.
  const existingDeducting = financing.reduce((sum, f) => {
    if (f.deduct_from_balance !== false) return sum + Number(f.financed_amount ?? 0);
    return sum;
  }, 0);
  const computedBalance = Math.max(0, total - depositPaid - existingDeducting);
  // If contract.balance_due is in sync, use it; otherwise show the computed.
  const displayBalance = Math.abs(computedBalance - balanceDue) < 0.01 ? balanceDue : computedBalance;

  const [open, setOpen] = useState(false);
  const [financer, setFinancer] = useState<string>(KNOWN_FINANCERS[0]);
  const [otherFinancer, setOtherFinancer] = useState("");
  const [amount, setAmount] = useState<string>(displayBalance.toFixed(2));
  const [termMonths, setTermMonths] = useState<string>("");
  const [apr, setApr] = useState<string>("");
  const [approvalNumber, setApprovalNumber] = useState<string>("");
  const [externalAppId, setExternalAppId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (displayBalance <= 0 && !open) {
    return (
      <section>
        <h4 className="text-sm font-bold text-slate-900 mb-2">Convert balance to financing</h4>
        <div className="rounded-lg bg-white border border-slate-200 p-3 text-sm text-slate-600">
          No balance remaining to finance.
        </div>
      </section>
    );
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    const financerName = financer === "Other" ? otherFinancer.trim() : financer;
    if (!financerName) {
      setErr("Financer name is required.");
      setBusy(false);
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Financed amount must be a positive number.");
      setBusy(false);
      return;
    }
    const body: Record<string, unknown> = {
      financer_name: financerName,
      financed_amount: amt,
      type: financer === "In-house" ? "in_house" : "third_party",
      deduct_from_balance: true,
    };
    if (termMonths.trim()) body.term_months = Number(termMonths);
    if (apr.trim()) body.apr = Number(apr);
    if (approvalNumber.trim()) body.approval_number = approvalNumber.trim();
    if (externalAppId.trim()) body.external_application_id = externalAppId.trim();
    if (notes.trim()) body.notes = notes.trim();

    const r = await fetch(`/api/contracts/${contractId}/financing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setErr(b.error ?? "Could not add financing.");
      return;
    }
    const result = await r.json();
    setOkMsg(
      `Financing added. New balance due: ${formatCurrency(result.balance_due ?? 0)}. ` +
      (result.pdf_archived
        ? "Original signed PDF archived; new PDF will regenerate on next view."
        : "PDF will regenerate on next view.")
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <section>
      <h4 className="text-sm font-bold text-slate-900 mb-2">Convert balance to financing</h4>
      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-3">
        {/* Math breakdown */}
        <div className="rounded bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-slate-600">Contract total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">− Deposits paid</span>
            <span>−{formatCurrency(depositPaid)}</span>
          </div>
          {existingDeducting > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">− Existing financing (deducting)</span>
              <span>−{formatCurrency(existingDeducting)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-slate-300 pt-1 mt-1">
            <span>= Current balance</span>
            <span>{formatCurrency(displayBalance)}</span>
          </div>
        </div>

        {okMsg && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
            {okMsg}
          </div>
        )}

        {!open ? (
          <Button variant="accent" size="sm" onClick={() => { setOpen(true); setOkMsg(null); }}>
            Convert balance to financing
          </Button>
        ) : (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-700 font-medium block mb-1">Financer</span>
                <select
                  value={financer}
                  onChange={(e) => setFinancer(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30"
                >
                  {KNOWN_FINANCERS.map((f) => <option key={f} value={f}>{f}</option>)}
                  <option value="Other">Other…</option>
                </select>
                {financer === "Other" && (
                  <Input
                    value={otherFinancer}
                    onChange={(e) => setOtherFinancer(e.target.value)}
                    placeholder="Financer name"
                    className="mt-1 text-sm"
                  />
                )}
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium block mb-1">Financed amount</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  max={displayBalance}
                  className="text-sm"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Max: {formatCurrency(displayBalance)} (current balance)
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium block mb-1">Term (months)</span>
                <Input
                  type="number"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="e.g. 60"
                  className="text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium block mb-1">APR (%)</span>
                <Input
                  type="number"
                  value={apr}
                  onChange={(e) => setApr(e.target.value)}
                  step="0.01"
                  placeholder="e.g. 9.99"
                  className="text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium block mb-1">Approval #</span>
                <Input
                  value={approvalNumber}
                  onChange={(e) => setApprovalNumber(e.target.value)}
                  className="text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium block mb-1">External app ID</span>
                <Input
                  value={externalAppId}
                  onChange={(e) => setExternalAppId(e.target.value)}
                  className="text-sm"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-slate-700 font-medium block mb-1">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Customer called to cancel; converted balance to WF to save the deal."
                className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-none"
              />
            </label>

            {err && (
              <p className="text-sm text-red-700">{err}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="accent" size="sm" onClick={submit} disabled={busy}>
                {busy ? "Saving…" : "Add financing"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Audit log of post-sign edits ────────────────────────────────────────────
const ACTION_LABEL: Record<string, string> = {
  "contract.delivery_timeframe_updated": "Delivery timeframe updated",
  "contract.per_nat_flagged": "Per Nat flagged",
  "contract.per_nat_unflagged": "Per Nat cleared",
  "contract.inventory_unit_assigned": "Inventory unit assigned",
  "contract.inventory_unit_released": "Inventory unit released",
  "contract.financing_added": "Financing added",
  "contract.cancelled": "Contract cancelled",
  "contract.refund_marked": "Refund marked",
  "contract.tax_refund_issued": "Tax refund issued",
};

function AuditLogSection({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <section>
        <h4 className="text-sm font-bold text-slate-900 mb-2">Modification history</h4>
        <div className="rounded-lg bg-white border border-slate-200 p-3 text-sm text-slate-500">
          No post-sale modifications yet.
        </div>
      </section>
    );
  }
  return (
    <section>
      <h4 className="text-sm font-bold text-slate-900 mb-2">
        Modification history
        <span className="ml-2 text-xs font-normal text-slate-500">
          ({entries.length} {entries.length === 1 ? "entry" : "entries"})
        </span>
      </h4>
      <div className="rounded-lg bg-white border border-slate-200 divide-y divide-slate-100">
        {entries.map((e) => {
          const label = ACTION_LABEL[e.action] ?? e.action;
          const summary = summarizeMetadata(e.action, e.metadata);
          return (
            <div key={e.id} className="px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{label}</p>
                  {summary && <p className="text-xs text-slate-600 mt-0.5">{summary}</p>}
                </div>
                <div className="text-xs text-slate-500 text-right whitespace-nowrap">
                  <p>{formatDate(e.created_at)}</p>
                  <p>{e.actor_name ?? "—"}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function summarizeMetadata(action: string, meta: Record<string, unknown>): string | null {
  if (!meta) return null;
  if (action === "contract.delivery_timeframe_updated") {
    const prev = (meta.previous ?? "—") as string;
    const next = (meta.next ?? "—") as string;
    return `${prev || "(empty)"} → ${next || "(empty)"}`;
  }
  if (action === "contract.per_nat_flagged" || action === "contract.per_nat_unflagged") {
    const next = meta.next as { is_per_nat?: boolean; reason?: string } | undefined;
    if (next) {
      return next.is_per_nat
        ? `On Per Nat list · reason: ${next.reason ?? "—"}`
        : "Removed from Per Nat list";
    }
    return null;
  }
  if (action === "contract.inventory_unit_assigned") {
    const serial = meta.serial_number as string | undefined;
    const pct = meta.secured_pct as number | undefined;
    return serial ? `Assigned ${serial}${pct !== undefined ? ` · ${pct}% secured` : ""}` : null;
  }
  if (action === "contract.inventory_unit_released") {
    const units = meta.released_units as Array<{ serial_number: string | null }> | undefined;
    const reason = meta.reason as string | undefined;
    const serialList = units?.map((u) => u.serial_number).filter(Boolean).join(", ");
    const parts = [];
    if (serialList) parts.push(`Released ${serialList}`);
    if (reason) parts.push(`reason: ${reason}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  if (action === "contract.financing_added") {
    const financer = meta.financer_name as string | undefined;
    const amt = meta.financed_amount as number | undefined;
    const prevBal = meta.previous_balance_due as number | undefined;
    const newBal = meta.new_balance_due as number | undefined;
    const parts: string[] = [];
    if (financer && amt !== undefined) parts.push(`${financer} ${formatCurrency(amt)}`);
    if (prevBal !== undefined && newBal !== undefined) {
      parts.push(`balance ${formatCurrency(prevBal)} → ${formatCurrency(newBal)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return null;
}
