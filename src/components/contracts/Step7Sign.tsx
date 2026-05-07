"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  TERMS_AND_CONDITIONS,
  REQUIRED_ACKNOWLEDGMENTS,
  type AcknowledgmentClause,
} from "@/lib/contract-terms";

// react-signature-canvas types are incompatible with Next.js dynamic — cast to any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[200px] rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
      <span className="text-slate-400">Loading signature pad...</span>
    </div>
  ),
}) as React.ComponentType<React.ComponentProps<"canvas"> & {
  ref?: React.Ref<any>;
  penColor?: string;
  canvasProps?: Record<string, unknown>;
  onEnd?: () => void;
  clear?: () => void;
  toDataURL?: (type?: string) => string;
}>;

interface Step7SignProps {
  onNext: () => void;
}

type AckKey = AcknowledgmentClause["key"];

export default function Step7Sign({ onNext }: Step7SignProps) {
  const {
    draft,
    setCreatedContractId,
    setIdempotencyKey,
    setSignatureDataUrl,
    setSignedName,
    setElectronicConsent,
    setInitialUrl,
  } = useContractStore();
  const sigCanvasRef = useRef<any>(null);
  // Per-clause initials pads — one mini SignatureCanvas per acknowledgment.
  // Customer hand-draws their initials in each box. The captured ink is
  // stored as a data URL in `initialsUrls` and embedded into the generated
  // PDF so the printed contract shows the actual handwritten initials, not
  // a typed approximation. Mirrored to zustand on every onEnd so a reload
  // (iPad sleep, accidental tab switch) restores them on remount.
  const initialsRefs = useRef<Record<AckKey, any>>({
    sales_final: null,
    cancellation_forfeit: null,
    rx_30_day: null,
  });

  // Hydrate from persisted draft so a reload mid-signing brings everything
  // back instead of forcing a redo. Local state is the source of truth for
  // the canvas (because the canvas itself is a DOM element), but each change
  // is mirrored to the store via the setters below.
  const [printedName, setPrintedName] = useState(draft.signed_name ?? "");
  const [hasSigned, setHasSigned] = useState(!!draft.signature_data_url);
  const [hasConsented, setHasConsented] = useState(!!draft.electronic_consent);
  const [initialsUrls, setInitialsUrls] = useState<Record<AckKey, string | null>>({
    sales_final: draft.initials_urls?.sales_final ?? null,
    cancellation_forfeit: draft.initials_urls?.cancellation_forfeit ?? null,
    rx_30_day: draft.initials_urls?.rx_30_day ?? null,
  });
  const allAcked = REQUIRED_ACKNOWLEDGMENTS.every((a) => !!initialsUrls[a.key]);
  const missingAcks = REQUIRED_ACKNOWLEDGMENTS.filter((a) => !initialsUrls[a.key]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-paint persisted signature & initials onto their canvases after the
  // dynamic SignatureCanvas import resolves. Without this a reload would show
  // hasSigned=true but an empty canvas, leading to a "Could not capture
  // signature" error on submit.
  useEffect(() => {
    if (draft.signature_data_url && sigCanvasRef.current?.fromDataURL) {
      try { sigCanvasRef.current.fromDataURL(draft.signature_data_url); } catch { /* canvas not ready yet */ }
    }
    REQUIRED_ACKNOWLEDGMENTS.forEach((a) => {
      const url = draft.initials_urls?.[a.key];
      const ref = initialsRefs.current[a.key];
      if (url && ref?.fromDataURL) {
        try { ref.fromDataURL(url); } catch { /* canvas not ready yet */ }
      }
    });
    // Run once on mount — values come from persisted store. Re-running on
    // store changes would clobber active drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInitialsEnd = useCallback((key: AckKey) => () => {
    const ref = initialsRefs.current[key];
    if (ref && !ref.isEmpty()) {
      const url = ref.toDataURL("image/png");
      setInitialsUrls((prev) => ({ ...prev, [key]: url }));
      setInitialUrl(key, url);
    }
  }, [setInitialUrl]);

  const handleInitialsClear = (key: AckKey) => () => {
    initialsRefs.current[key]?.clear();
    setInitialsUrls((prev) => ({ ...prev, [key]: null }));
    setInitialUrl(key, null);
  };

  const depositAmount = draft.deposit_amount;
  const balance = Math.max(0, draft.total - depositAmount);

  const handleSignEnd = useCallback(() => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      setHasSigned(true);
      try {
        setSignatureDataUrl(sigCanvasRef.current.toDataURL("image/png"));
      } catch {
        /* canvas not ready — handleSubmit re-captures from the live canvas */
      }
    }
  }, [setSignatureDataUrl]);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setHasSigned(false);
    setSignatureDataUrl(undefined);
  };

  const canSubmit = hasSigned && printedName.trim().length > 0 && hasConsented && allAcked && !isSubmitting;

  // Fire-and-forget client error logging. Never blocks the contract flow —
  // a logging outage must not stop the rep from finishing the sale.
  const reportClientError = (context: Record<string, unknown>) => {
    try {
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "contract.submission_failed",
          context,
        }),
        keepalive: true,
      }).catch(() => {/* non-fatal */});
    } catch {
      /* non-fatal */
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    // Generate (or reuse) the idempotency key BEFORE the network request.
    // Stored in zustand persist, so a retry after iPad sleep / network blip
    // / page reload re-sends the same key and the server returns the
    // already-created contract instead of inserting a duplicate.
    let idempotencyKey = draft.idempotency_key;
    if (!idempotencyKey) {
      idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      setIdempotencyKey(idempotencyKey);
    }

    try {
      // Get signature as data URL
      const signatureDataUrl = sigCanvasRef.current?.toDataURL("image/png");
      if (!signatureDataUrl) {
        throw new Error("Could not capture signature");
      }

      // Try to upload to Supabase Storage; fall back to embedding as data URL if bucket
      // is unavailable (e.g. during setup / demo environments).
      let signatureUrl = signatureDataUrl; // fallback: embed inline
      try {
        const blob = await fetch(signatureDataUrl).then((r) => r.blob());
        const tempId = `draft-${Date.now()}`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("signatures")
          .upload(`${tempId}.png`, blob, { contentType: "image/png", upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("signatures")
            .getPublicUrl(`${tempId}.png`);
          signatureUrl = urlData.publicUrl;
        }
        // If upload fails we silently keep signatureUrl as the base64 data URL —
        // the signature is still captured in signature_metadata.signed_name.
      } catch {
        // non-fatal — proceed with inline data URL
      }

      // Submit the contract
      const nowIso = new Date().toISOString();
      const contractResponse = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          idempotency_key: idempotencyKey,
          customer_signature_url: signatureUrl,
          signed_name: printedName.trim(),
          signed_at: nowIso,
          electronic_consent: true,
          consent_timestamp: nowIso,
          acknowledgments: {
            sales_final: !!initialsUrls.sales_final,
            sales_final_initials_url: initialsUrls.sales_final ?? null,
            cancellation_forfeit: !!initialsUrls.cancellation_forfeit,
            cancellation_forfeit_initials_url: initialsUrls.cancellation_forfeit ?? null,
            rx_30_day: !!initialsUrls.rx_30_day,
            rx_30_day_initials_url: initialsUrls.rx_30_day ?? null,
            acknowledged_at: nowIso,
          },
        }),
      });

      if (!contractResponse.ok) {
        const errBody = await contractResponse.text().catch(() => "");
        reportClientError({
          where: "step7.fetch_not_ok",
          status: contractResponse.status,
          body_snippet: errBody.slice(0, 500),
          idempotency_key: idempotencyKey,
          customer_email: draft.customer?.email ?? null,
          total: draft.total,
        });
        let parsedErr: { error?: string } | null = null;
        try { parsedErr = errBody ? JSON.parse(errBody) : null; } catch { /* keep raw */ }
        throw new Error(
          parsedErr?.error ?? `Contract creation failed (${contractResponse.status})`
        );
      }

      // Parse response — API returns { contract_id, contract_number }
      const rawBody = await contractResponse.text().catch(() => "");
      let contractData: { contract_id?: string; id?: string; contract_number?: string } | null = null;
      try { contractData = rawBody ? JSON.parse(rawBody) : null; } catch { /* malformed */ }
      const createdId = contractData?.contract_id ?? contractData?.id;
      // Guard: if the API responded ok but didn't return a contract ID, do NOT
      // advance to Step 8 — Step 8 needs the ID to charge the deposit. The
      // contract row may already be saved server-side, so the rep should check
      // the Contracts list before resubmitting to avoid a duplicate.
      if (!createdId) {
        reportClientError({
          where: "step7.no_contract_id_in_ok_response",
          status: contractResponse.status,
          body_snippet: rawBody.slice(0, 500),
          idempotency_key: idempotencyKey,
          customer_email: draft.customer?.email ?? null,
          total: draft.total,
        });
        throw new Error(
          "Submission completed but no contract ID was returned. Check Contracts list before retrying — the contract may already be saved."
        );
      }
      setCreatedContractId(createdId);
      fetch(`/api/contracts/${createdId}/welcome-email`, { method: "POST" })
        .catch(() => {/* non-fatal */});
      const hasInHouse = (draft.financing ?? []).some((f) => f?.type === "in_house");
      if (hasInHouse) {
        fetch(`/api/contracts/${createdId}/inhouse-application`, { method: "POST" })
          .catch(() => {/* non-fatal */});
      }
      if (draft.needs_hoa) {
        fetch(`/api/contracts/${createdId}/hoa-packet`, { method: "POST" })
          .catch(() => {/* non-fatal */});
      }

      // Tax-exemption certificate captured at Step 5 — convert the staged
      // data URL back into a File and POST to the existing portal upload
      // endpoint (which accepts staff uploads on behalf of customers).
      // Fire-and-forget: a failure here must not block the contract flow.
      if (draft.tax_exempt_cert_data_url) {
        (async () => {
          try {
            const blob = await fetch(draft.tax_exempt_cert_data_url!).then((r) => r.blob());
            const file = new File(
              [blob],
              draft.tax_exempt_cert_filename ?? "tax-cert.jpg",
              { type: draft.tax_exempt_cert_mime ?? blob.type ?? "image/jpeg" }
            );
            const fd = new FormData();
            fd.append("file", file);
            fd.append("contractId", createdId);
            await fetch("/api/portal/upload-cert", { method: "POST", body: fd });
          } catch {/* non-fatal — bookkeeper can chase via the portal later */}
        })();
      }

      onNext();
    } catch (err: any) {
      const message = err?.message ?? "Something went wrong. Please try again.";
      // Always console.error so a rep can read the iPad debug log via Safari
      // remote inspector if they need to. Server-side audit happened above
      // for the specific failure cases that detect status / no-id; this
      // catches network errors, signature capture failures, etc.
      // eslint-disable-next-line no-console
      console.error("[Step7Sign] submit failed", err);
      reportClientError({
        where: "step7.catch",
        message,
        idempotency_key: idempotencyKey,
        customer_email: draft.customer?.email ?? null,
        total: draft.total,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      });
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Step label + instruction ───────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">Step 7 of 8 · Contract phase</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">
          Customer signature
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Review the summary one more time, then capture the customer's signature below.
        </p>
      </div>

      {/* ── Compact Summary ────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Customer</span>
              <p className="font-medium">
                {draft.customer
                  ? `${draft.customer.first_name} ${draft.customer.last_name}`
                  : "N/A"}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Product</span>
              <p className="font-medium">
                {draft.line_items.length > 0
                  ? draft.line_items.map((i) => i.product_name).join(", ")
                  : "N/A"}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Total</span>
              <p className="font-semibold text-[#00929C]">
                {formatCurrency(draft.total)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Deposit</span>
              <p className="font-semibold text-[#00929C]">
                {formatCurrency(depositAmount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Terms & Conditions ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Scrollable so the customer can read on iPad without pushing the
              signature pad off-screen. Same legal language is rendered into
              the generated PDF (src/lib/contract-terms.ts). */}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3 text-xs leading-relaxed text-slate-700">
            {TERMS_AND_CONDITIONS.map((section, sIdx) => (
              <div key={section.heading}>
                <p className="font-bold uppercase tracking-wide text-[10px] text-slate-500">
                  {section.heading}
                </p>
                <ol className="mt-1 space-y-1 list-decimal pl-5">
                  {section.clauses.map((c, cIdx) => (
                    <li key={`${sIdx}-${cIdx}`}>{c}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Customer Acknowledgments — required initials pads ── */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-amber-900">Required Initials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-amber-800">
            Please initial each clause below. The customer must initial all three boxes to proceed.
          </p>
          {REQUIRED_ACKNOWLEDGMENTS.map((a) => {
            const url = initialsUrls[a.key];
            return (
              <div
                key={a.key}
                className={`rounded-lg border-2 px-3 py-2.5 transition-colors ${
                  url ? "border-emerald-300 bg-white" : "border-amber-300 bg-white"
                }`}
              >
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{a.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{a.text}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 md:w-44 flex-shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Initials</p>
                    <div className="relative">
                      <div className={`w-full rounded border-2 bg-slate-50 overflow-hidden ${
                        url ? "border-emerald-400" : "border-dashed border-amber-400"
                      }`}>
                        <SignatureCanvas
                          ref={(el: any) => {
                            initialsRefs.current[a.key] = el;
                          }}
                          penColor="#0f172a"
                          canvasProps={{
                            className: "w-full touch-manipulation",
                            style: { width: "100%", height: "70px" },
                          }}
                          onEnd={handleInitialsEnd(a.key)}
                        />
                      </div>
                      {!url && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-amber-300 text-sm italic">Initial here</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleInitialsClear(a.key)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-red-600 self-end"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Electronic Signature Disclosure ── */}
      <Card className="border-slate-200">
        <CardContent className="py-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>Electronic Signature Disclosure:</strong> By checking the box below and signing, you agree that your electronic signature is the legal equivalent of your handwritten signature. You consent to conduct this transaction electronically and agree to be bound by the terms of this agreement. This electronic record will be retained and is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN) and the Texas Uniform Electronic Transactions Act (TUETA).
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            By signing below, I agree to the terms and conditions of this purchase agreement. I authorize a deposit of <strong>{formatCurrency(depositAmount)}</strong> to be collected today. The remaining balance of <strong>{formatCurrency(balance)}</strong> is due at delivery.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => {
                setHasConsented(e.target.checked);
                setElectronicConsent(e.target.checked);
              }}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#00929C] accent-[#00929C] cursor-pointer flex-shrink-0"
            />
            <span className="text-sm font-medium text-slate-800">
              I understand and agree that my electronic signature has the same legal effect as a handwritten signature
            </span>
          </label>
        </CardContent>
      </Card>

      {/* ── Signature Pad ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Signature</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="w-full rounded-lg border-2 border-slate-300 bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="#1a1a1a"
                canvasProps={{
                  className: "w-full touch-manipulation",
                  style: { width: "100%", height: "200px" },
                }}
                onEnd={handleSignEnd}
              />
            </div>
            {!hasSigned && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-slate-300 text-lg italic">
                  Sign here
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear Signature
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Printed Name ───────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          <Input
            label="Print Name"
            type="text"
            value={printedName}
            onChange={(e) => {
              setPrintedName(e.target.value);
              setSignedName(e.target.value);
            }}
            placeholder="Customer full name"
          />
        </CardContent>
      </Card>

      {/* ── Error ──────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Submit Button ──────────────────────────────────── */}
      <Button
        variant="accent"
        size="xl"
        className="w-full text-lg"
        disabled={!canSubmit}
        loading={isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? "Creating contract..." : "Submit & Email Contract \u2192"}
      </Button>

      {!canSubmit && !isSubmitting && (
        <p className="text-center text-sm text-slate-400">
          {missingAcks.length > 0
            ? `Acknowledge: ${missingAcks.map((a) => a.label).join(" · ")}`
            : !hasConsented
              ? "Check the electronic-signature consent box to continue"
              : "Please sign above and print your name to continue"}
        </p>
      )}
    </div>
  );
}
