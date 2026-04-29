"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

type InhouseStatus = "application_sent" | "docusign_sent" | "cleared_for_delivery" | "in_repayment" | "paid_off" | "failed";

const STATUS_LABEL: Record<InhouseStatus, string> = {
  application_sent: "Application sent",
  docusign_sent: "DocuSign sent",
  cleared_for_delivery: "Cleared for Delivery",
  in_repayment: "In Repayment",
  paid_off: "Paid Off",
  failed: "Failed",
};

const STATUS_BADGE: Record<InhouseStatus, string> = {
  application_sent: "bg-blue-100 text-blue-800 border-blue-300",
  docusign_sent: "bg-amber-100 text-amber-800 border-amber-300",
  cleared_for_delivery: "bg-emerald-100 text-emerald-800 border-emerald-300",
  in_repayment: "bg-violet-100 text-violet-800 border-violet-300",
  paid_off: "bg-slate-100 text-slate-700 border-slate-300",
  failed: "bg-red-100 text-red-800 border-red-300",
};

const NEXT_BY_STATUS: Record<InhouseStatus, { label: string; status: InhouseStatus } | null> = {
  application_sent: { label: "Mark DocuSign sent", status: "docusign_sent" },
  docusign_sent: { label: "Mark Cleared for Delivery", status: "cleared_for_delivery" },
  cleared_for_delivery: { label: "Mark In Repayment", status: "in_repayment" },
  in_repayment: { label: "Mark Paid Off", status: "paid_off" },
  paid_off: null,
  failed: null,
};

export interface InhouseRow {
  contractId: string;
  contractNumber: string;
  customerName: string;
  customerEmail: string | null;
  showName: string;
  rep: string;
  signedAt: string | null;
  financedAmount: number;
  contractTotal: number;
  balanceDue: number;
  fundingIdx: number;
  status: InhouseStatus;
  appSentAt: string | null;
  achOnFile: boolean;
  achWaived: boolean;
  dlUploaded: boolean;
  notes: string | null;
}

interface Props {
  rows: InhouseRow[];
}

export default function InhouseTrackerSection({ rows }: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(row: InhouseRow, nextStatus: InhouseStatus) {
    const key = `${row.contractId}-${row.fundingIdx}`;
    setBusyKey(key);
    setError(null);
    const body: Record<string, unknown> = { inhouse_app_status: nextStatus };
    if (nextStatus === "cleared_for_delivery") body.inhouse_docusign_signed_at = new Date().toISOString();
    const r = await fetch(`/api/contracts/${row.contractId}/financing/${row.fundingIdx}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyKey(null);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Status update failed");
      return;
    }
    router.refresh();
  }

  async function resendApplication(row: InhouseRow) {
    const key = `resend-${row.contractId}-${row.fundingIdx}`;
    setBusyKey(key);
    setError(null);
    const r = await fetch(`/api/contracts/${row.contractId}/inhouse-application`, { method: "POST" });
    setBusyKey(null);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Failed to resend");
      return;
    }
  }

  const totalFinanced = rows.reduce((s, r) => s + r.financedAmount, 0);
  const groups: Record<InhouseStatus, InhouseRow[]> = {
    application_sent: [],
    docusign_sent: [],
    cleared_for_delivery: [],
    in_repayment: [],
    paid_off: [],
    failed: [],
  };
  for (const r of rows) groups[r.status].push(r);

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Active applications" value={`${rows.length}`} />
        <Stat label="Total financed" value={formatCurrency(totalFinanced)} />
        <Stat label="Awaiting DocuSign" value={`${groups.application_sent.length + groups.docusign_sent.length}`} />
        <Stat label="In repayment" value={`${groups.in_repayment.length}`} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No in-house financing applications yet. They'll show here as contracts are signed.</p>
      ) : (
        <div className="space-y-4">
          {(Object.keys(groups) as InhouseStatus[])
            .filter((s) => groups[s].length > 0)
            .map((status) => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold rounded-full px-2 py-0.5 border ${STATUS_BADGE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-slate-500">{groups[status].length}</span>
                </div>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {groups[status].map((row) => {
                    const next = NEXT_BY_STATUS[row.status];
                    const stuck = row.status === "application_sent" && (!row.dlUploaded || (!row.achOnFile && !row.achWaived));
                    return (
                      <div key={`${row.contractId}-${row.fundingIdx}`} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/contracts/${row.contractId}`} className="font-semibold text-slate-900 text-sm hover:underline">
                                {row.contractNumber}
                              </Link>
                              <span className="text-xs text-slate-500">{row.customerName}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {row.showName} · {row.rep}
                              {row.signedAt ? ` · signed ${formatDate(row.signedAt)}` : ""}
                            </p>
                            {/* Readiness flags */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <Flag ok={row.dlUploaded} label="DL" />
                              <Flag ok={row.achOnFile || row.achWaived} label={row.achWaived ? "ACH waived" : "ACH"} />
                              {row.appSentAt ? (
                                <span className="text-[10px] text-slate-500">App sent {formatDate(row.appSentAt)}</span>
                              ) : null}
                            </div>
                            {row.notes && <p className="text-xs text-slate-500 italic mt-1">{row.notes}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-blue-700">{formatCurrency(row.financedAmount)}</p>
                            <p className="text-[11px] text-slate-400">of {formatCurrency(row.contractTotal)}</p>
                          </div>
                        </div>

                        {stuck && (
                          <p className="text-[11px] font-semibold text-amber-700 mt-1">
                            ⚠ Application can't fully process — missing {[!row.dlUploaded && "DL", !row.achOnFile && !row.achWaived && "ACH"].filter(Boolean).join(" + ")}.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {next && (
                            <button
                              type="button"
                              disabled={busyKey === `${row.contractId}-${row.fundingIdx}`}
                              onClick={() => patchStatus(row, next.status)}
                              className="text-xs font-semibold px-3 py-1 rounded-lg bg-[#00929C] text-white hover:bg-[#007279] disabled:opacity-50"
                            >
                              {next.label}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyKey === `resend-${row.contractId}-${row.fundingIdx}`}
                            onClick={() => resendApplication(row)}
                            className="text-xs font-semibold px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Resend application to Robert
                          </button>
                          {row.status !== "failed" && (
                            <button
                              type="button"
                              disabled={busyKey === `${row.contractId}-${row.fundingIdx}`}
                              onClick={() => patchStatus(row, "failed")}
                              className="text-xs font-semibold px-3 py-1 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Mark Failed
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</p>
      <p className="text-base font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}
