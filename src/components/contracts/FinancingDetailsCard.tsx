"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LYON_PROJECT_TYPE_LABELS } from "@/lib/lyon-stages";
import type { ContractFinancing, LyonStage } from "@/types";

interface Props {
  contractId: string;
  financing: ContractFinancing[];
}

// Status colors for the funding status badge
const FUNDING_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  awaiting_customer_accept: { label: "Awaiting customer accept", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  authorized_no_charge:     { label: "Authorized — not charged", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  pending_funding:          { label: "Pending funding",          cls: "bg-amber-100 text-amber-800 border-amber-300" },
  partially_funded:         { label: "Partially funded",         cls: "bg-blue-100 text-blue-800 border-blue-300" },
  fully_funded:             { label: "Fully funded",             cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  failed:                   { label: "Failed / reversed",        cls: "bg-red-100 text-red-800 border-red-300" },
  manual_reconcile:         { label: "Manual reconcile needed",  cls: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300" },
};

const LYON_STAGE_BADGE: Record<NonNullable<LyonStage["status"]>, { label: string; cls: string }> = {
  not_started:        { label: "Not started",       cls: "bg-slate-100 text-slate-700 border-slate-300" },
  photo_uploaded:     { label: "Photo uploaded",    cls: "bg-blue-100 text-blue-800 border-blue-300" },
  submitted_to_lyon:  { label: "Sent to Lyon",      cls: "bg-amber-100 text-amber-800 border-amber-300" },
  funded:             { label: "Funded",            cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  skipped:            { label: "Skipped",           cls: "bg-slate-100 text-slate-700 border-slate-300" },
};

export default function FinancingDetailsCard({ contractId, financing }: Props) {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline-edit state for funding update
  const [drawAmount, setDrawAmount] = useState("");
  const [drawReference, setDrawReference] = useState("");
  const [drawNotes, setDrawNotes] = useState("");
  const [externalAppId, setExternalAppId] = useState("");
  const [externalChargeId, setExternalChargeId] = useState("");

  if (!financing || financing.length === 0) return null;

  async function patchEntry(idx: number, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/contracts/${contractId}/financing/${idx}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  async function patchLyonStage(financingIdx: number, stageNum: number, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/contracts/${contractId}/financing/${financingIdx}/lyon-stage/${stageNum}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Stage update failed");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Financing Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {financing.map((f, idx) => {
          const isFoundation = f.deduct_from_balance === false;
          const isLyon = !!f.lyon_project_type;
          const fundedAmt = (f as any).funded_amount ?? 0;
          const fundedAt = (f as any).funded_at;
          const fundingStatus: string | undefined = (f as any).funding_status;
          const externalAppIdStored: string | undefined = (f as any).external_application_id;
          const externalChargeIdStored: string | undefined = (f as any).external_charge_request_id;
          const fundedPct = f.financed_amount > 0 ? (fundedAmt / f.financed_amount) * 100 : 0;
          const isOpen = openIdx === idx;

          return (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white">
              {/* Header row */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{f.financer_name ?? "—"}</p>
                      {isFoundation ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                          Carries to balance
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C] border border-[#00929C]/30">
                          Deducted at POS
                        </span>
                      )}
                      {fundingStatus && FUNDING_STATUS_BADGE[fundingStatus] && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${FUNDING_STATUS_BADGE[fundingStatus].cls}`}>
                          {FUNDING_STATUS_BADGE[fundingStatus].label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {f.plan_number ? `Plan ${f.plan_number}` : ""}
                      {f.plan_description ? ` — ${f.plan_description}` : ""}
                    </p>
                  </div>
                </div>

                {/* Tri-pane: Total Financed | Run So Far | Remaining To Run */}
                {!isFoundation && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Total Financed</p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(f.financed_amount)}</p>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${fundedAmt > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Run So Far</p>
                      <p className={`text-sm font-bold tabular-nums ${fundedAmt > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                        {formatCurrency(fundedAmt)}
                      </p>
                      {fundedAmt > 0 && f.financed_amount > 0 && (
                        <p className="text-[10px] text-emerald-600">{fundedPct.toFixed(0)}%</p>
                      )}
                    </div>
                    {(() => {
                      const remaining = Math.max(0, f.financed_amount - fundedAmt);
                      return (
                        <div className={`rounded-lg border px-3 py-2 ${remaining > 0 ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-200"}`}>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Remaining To Run</p>
                          <p className={`text-sm font-bold tabular-nums ${remaining > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                            {formatCurrency(remaining)}
                          </p>
                          {remaining > 0 && (
                            <p className="text-[10px] font-semibold text-amber-800">
                              Run via lender portal
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Foundation: just the financed amount (funding tracked at delivery via Foundation portal) */}
                {isFoundation && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <p className="text-xs text-amber-800">
                      Foundation funds Atlas <strong>after delivery</strong> via their stage process. Track in the Foundation portal until then.
                    </p>
                    <p className="text-base font-bold text-amber-800 whitespace-nowrap ml-3">{formatCurrency(f.financed_amount)}</p>
                  </div>
                )}
              </div>

              {/* Draw history — each individual portal-ACH draw logged against this entry */}
              {(() => {
                const draws = Array.isArray((f as any).draw_history) ? (f as any).draw_history : [];
                if (draws.length === 0) return null;
                return (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Draw History</p>
                    <div className="space-y-1">
                      {(draws as Array<{ amount: number; reference?: string | null; notes?: string | null; drawn_at: string }>).map((d, di) => (
                        <div key={di} className="flex items-center justify-between text-xs gap-2">
                          <span className="text-slate-700 whitespace-nowrap">{formatDate(d.drawn_at)}</span>
                          {d.reference && <span className="text-slate-400 font-mono truncate flex-1">Ref {d.reference}</span>}
                          <span className="font-semibold text-emerald-700 whitespace-nowrap">{formatCurrency(d.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Static details */}
              <div className="px-4 py-3 space-y-1 text-xs">
                {f.approval_number && <Detail k="Approval #" v={f.approval_number} />}
                {externalAppIdStored && <Detail k="External App ID" v={externalAppIdStored} />}
                {externalChargeIdStored && <Detail k="Charge Request #" v={externalChargeIdStored} />}
                {fundedAt && <Detail k="Last charged" v={formatDate(fundedAt)} />}

                {/* Foundation specifics */}
                {f.foundation_tier && (
                  <Detail
                    k="Foundation"
                    v={[
                      `Tier ${f.foundation_tier}`,
                      f.foundation_approved_pct ? `approved ${f.foundation_approved_pct}%` : "",
                      f.foundation_buydown_rate ? `buy-down ${f.foundation_buydown_rate}%` : "",
                    ].filter(Boolean).join(" · ")}
                  />
                )}
                {f.foundation_ach_waived && <Detail k="ACH" v="WAIVED (commission absorbs up to $250)" valueClass="text-red-700 font-semibold" />}
                {f.foundation_ach_routing && f.foundation_ach_account && (
                  <Detail k="ACH on file" v={`acct ····${f.foundation_ach_account.slice(-4)}${f.foundation_ach_bank ? ` · ${f.foundation_ach_bank}` : ""}`} />
                )}

                {/* In-House specifics */}
                {f.type === "in_house" && (
                  <>
                    {f.inhouse_ach_holder_name && (
                      <Detail k="In-House ACH" v={`${f.inhouse_ach_holder_name}${f.inhouse_ach_account ? ` · acct ····${f.inhouse_ach_account.slice(-4)}` : ""}${f.inhouse_ach_bank ? ` · ${f.inhouse_ach_bank}` : ""}`} />
                    )}
                    <div className="flex justify-between items-center gap-4 text-xs pt-1">
                      <span className="text-slate-500">Application packet</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError(null);
                          const r = await fetch(`/api/contracts/${contractId}/inhouse-application`, { method: "POST" });
                          setBusy(false);
                          if (!r.ok) {
                            const b = await r.json().catch(() => ({}));
                            setError(b.error ?? "Failed to send application");
                            return;
                          }
                          const body = await r.json().catch(() => ({}));
                          if (body.skipped) setError(body.reason ?? "Skipped");
                        }}
                      >
                        Resend to Robert
                      </Button>
                    </div>
                  </>
                )}

                {/* Lyon specifics */}
                {isLyon && f.lyon_project_type && (
                  <Detail
                    k="Lyon project"
                    v={`${LYON_PROJECT_TYPE_LABELS[f.lyon_project_type]} · ${f.lyon_funding_flavor === "lightstream_via_customer" ? "LightStream/customer" : "Lyon-direct"}`}
                  />
                )}

                {/* Borrowers — primary defaults to spa contract customer when fields are unset */}
                {(f.primary_buyer_first_name || f.primary_buyer_last_name || f.primary_buyer_email || f.primary_buyer_phone) && (
                  <Detail
                    k="Primary Borrower"
                    v={`${[f.primary_buyer_first_name, f.primary_buyer_last_name].filter(Boolean).join(" ") || "—"}${f.primary_buyer_email ? ` · ${f.primary_buyer_email}` : ""}${f.primary_buyer_phone ? ` · ${f.primary_buyer_phone}` : ""}`}
                  />
                )}
                {(f.secondary_buyer_first_name || f.secondary_buyer_last_name || f.secondary_buyer_email) && (
                  <Detail
                    k="Co-Borrower"
                    v={`${[f.secondary_buyer_first_name, f.secondary_buyer_last_name].filter(Boolean).join(" ") || "—"}${f.secondary_buyer_email ? ` · ${f.secondary_buyer_email}` : ""}${f.secondary_buyer_phone ? ` · ${f.secondary_buyer_phone}` : ""}`}
                  />
                )}
              </div>

              {/* Lyon stages with action buttons */}
              {isLyon && Array.isArray(f.lyon_stages) && f.lyon_stages.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lyon Stages</p>
                  {f.lyon_stages.map((s) => {
                    const status = (s.status ?? "not_started") as LyonStage["status"];
                    const badge = LYON_STAGE_BADGE[status];
                    return (
                      <div key={s.stage_num} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            Stage {s.stage_num}: {s.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {s.percent}% · expected {formatCurrency(s.expected_amount)}
                            {s.funded_amount && s.funded_at ? ` · funded ${formatCurrency(s.funded_amount)} on ${formatDate(s.funded_at)}` : ""}
                          </p>
                        </div>
                        <span className={`text-xs font-bold rounded-full px-2 py-0.5 border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {status !== "photo_uploaded" && status !== "submitted_to_lyon" && status !== "funded" && (
                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => patchLyonStage(idx, s.stage_num, { status: "photo_uploaded" })}>
                              Mark photo uploaded
                            </Button>
                          )}
                          {status !== "submitted_to_lyon" && status !== "funded" && (
                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => patchLyonStage(idx, s.stage_num, { status: "submitted_to_lyon" })}>
                              Sent to Lyon
                            </Button>
                          )}
                          {status !== "funded" && (
                            <Button variant="default" size="sm" disabled={busy} onClick={() => patchLyonStage(idx, s.stage_num, { status: "funded", funded_amount: s.expected_amount, funded_at: new Date().toISOString() })}>
                              Mark funded
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Log draw / update IDs / status */}
              <div className="border-t border-slate-100 px-4 py-3">
                {isOpen ? (
                  <div className="space-y-3">
                    {/* Log a draw — primary action for GreenSky / WF / etc portal ACH */}
                    {!isFoundation && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Log a Draw</p>
                        <p className="text-xs text-slate-600">
                          After running an ACH through the lender's portal (GreenSky, WF, etc), log it here.
                          The amount accumulates onto Run So Far.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">This draw amount</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={Math.max(0, f.financed_amount - fundedAmt).toFixed(2)}
                              value={drawAmount}
                              onChange={(e) => setDrawAmount(e.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Reference / confirmation #</label>
                            <input
                              type="text"
                              placeholder="From the lender portal"
                              value={drawReference}
                              onChange={(e) => setDrawReference(e.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={drawNotes}
                          onChange={(e) => setDrawNotes(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        />
                        <Button
                          variant="default"
                          size="sm"
                          disabled={busy || !(parseFloat(drawAmount) > 0)}
                          onClick={async () => {
                            await patchEntry(idx, {
                              add_draw: {
                                amount: parseFloat(drawAmount),
                                reference: drawReference || undefined,
                                notes: drawNotes || undefined,
                              },
                            });
                            setDrawAmount("");
                            setDrawReference("");
                            setDrawNotes("");
                          }}
                        >
                          Log Draw
                        </Button>
                      </div>
                    )}

                    {/* External IDs + status overrides */}
                    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">External IDs / Status</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">External App ID</label>
                          <input
                            type="text"
                            placeholder="e.g. 8611005447"
                            value={externalAppId}
                            onChange={(e) => setExternalAppId(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">Charge Request #</label>
                          <input
                            type="text"
                            placeholder="e.g. 5197393"
                            value={externalChargeId}
                            onChange={(e) => setExternalChargeId(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy || (!externalAppId && !externalChargeId)}
                          onClick={() => patchEntry(idx, {
                            ...(externalAppId ? { external_application_id: externalAppId } : {}),
                            ...(externalChargeId ? { external_charge_request_id: externalChargeId } : {}),
                          })}
                        >
                          Save IDs
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => patchEntry(idx, { funding_status: "pending_funding" })}
                        >
                          Mark Pending
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => patchEntry(idx, { funding_status: "failed" })}
                        >
                          Mark Failed
                        </Button>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => setOpenIdx(null)}>
                      Close
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpenIdx(idx);
                      setDrawAmount("");
                      setDrawReference("");
                      setDrawNotes("");
                      setExternalAppId(externalAppIdStored ?? "");
                      setExternalChargeId(externalChargeIdStored ?? "");
                    }}
                  >
                    Log a draw / update IDs
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}

function Detail({ k, v, valueClass }: { k: string; v: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{k}</span>
      <span className={`text-slate-800 text-right ${valueClass ?? ""}`}>{v}</span>
    </div>
  );
}
