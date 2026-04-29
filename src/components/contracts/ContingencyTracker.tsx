"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Status = "pending" | "approved" | "denied" | null;

interface Props {
  contractId: string;
  needsPermit: boolean;
  permitStatus: Status;
  permitNumber: string | null;
  permitJurisdiction: string | null;
  needsHoa: boolean;
  hoaStatus: Status;
}

const STATUS_BADGE: Record<NonNullable<Status>, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-800 border-amber-300" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  denied:   { label: "Denied",   cls: "bg-red-100 text-red-800 border-red-300" },
};

export default function ContingencyTracker(props: Props) {
  const router = useRouter();
  const [permitNumber, setPermitNumber] = useState(props.permitNumber ?? "");
  const [permitJurisdiction, setPermitJurisdiction] = useState(props.permitJurisdiction ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const r = await fetch(`/api/contracts/${props.contractId}/contingencies`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  if (!props.needsPermit && !props.needsHoa) return null;

  const allClear =
    (!props.needsPermit || props.permitStatus === "approved") &&
    (!props.needsHoa || props.hoaStatus === "approved");

  return (
    <Card className={allClear ? "border-emerald-200" : "border-amber-200 bg-amber-50/40"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          Contingencies
          {allClear ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2 py-0.5">
              All clear — ok to deliver
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
              Delivery blocked
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {props.needsPermit && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Permit</p>
              {props.permitStatus && (
                <span className={`text-xs font-bold rounded-full px-2 py-0.5 border ${STATUS_BADGE[props.permitStatus].cls}`}>
                  {STATUS_BADGE[props.permitStatus].label}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Permit number"
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              type="text"
              placeholder="Jurisdiction (city / county)"
              value={permitJurisdiction}
              onChange={(e) => setPermitJurisdiction(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => update({ permit_number: permitNumber, permit_jurisdiction: permitJurisdiction })}
              >
                Save details
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={saving || props.permitStatus === "approved"}
                onClick={() => update({ permit_status: "approved" })}
              >
                Mark Approved
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => update({ permit_status: "denied" })}
              >
                Mark Denied
              </Button>
            </div>
          </div>
        )}

        {props.needsHoa && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">HOA Approval</p>
              {props.hoaStatus && (
                <span className={`text-xs font-bold rounded-full px-2 py-0.5 border ${STATUS_BADGE[props.hoaStatus].cls}`}>
                  {STATUS_BADGE[props.hoaStatus].label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Fair Housing packet auto-emailed to the customer at sign — they can also access it in their portal.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/legal/fair_housing_legal_compliance_memorandum.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                View Packet PDF
              </a>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  const r = await fetch(`/api/contracts/${props.contractId}/hoa-packet`, { method: "POST" });
                  setSaving(false);
                  if (!r.ok) {
                    const b = await r.json().catch(() => ({}));
                    setError(b.error ?? "Resend failed");
                  }
                }}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Resend to customer
              </button>
              <Button
                variant="default"
                size="sm"
                disabled={saving || props.hoaStatus === "approved"}
                onClick={() => update({ hoa_status: "approved" })}
              >
                Mark Approved
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => update({ hoa_status: "denied" })}
              >
                Mark Denied
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
