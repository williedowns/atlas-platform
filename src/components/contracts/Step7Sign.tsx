"use client";

import React, { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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

export default function Step7Sign({ onNext }: Step7SignProps) {
  const { draft, setCreatedContractId } = useContractStore();
  const sigCanvasRef = useRef<any>(null);

  const [printedName, setPrintedName] = useState("");
  const [hasSigned, setHasSigned] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositAmount = draft.deposit_amount;
  const balance = Math.max(0, draft.total - depositAmount);

  const handleSignEnd = useCallback(() => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      setHasSigned(true);
    }
  }, []);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setHasSigned(false);
  };

  const canSubmit = hasSigned && printedName.trim().length > 0 && hasConsented && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

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
      const contractResponse = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          customer_signature_url: signatureUrl,
          signed_name: printedName.trim(),
          signed_at: new Date().toISOString(),
          electronic_consent: true,
          consent_timestamp: new Date().toISOString(),
        }),
      });

      if (!contractResponse.ok) {
        const body = await contractResponse.json().catch(() => null);
        throw new Error(
          body?.error ?? `Contract creation failed (${contractResponse.status})`
        );
      }

      // Parse response — API returns { contract_id, contract_number }
      const contractData = await contractResponse.json().catch(() => null);
      const createdId = contractData?.contract_id ?? contractData?.id;
      if (createdId) {
        setCreatedContractId(createdId);
        // Fire-and-forget welcome email
        fetch(`/api/contracts/${createdId}/welcome-email`, { method: "POST" })
          .catch(() => {/* non-fatal */});
      }

      onNext();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
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

      {/* ── Legal Disclosure ── */}
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
              onChange={(e) => setHasConsented(e.target.checked)}
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
            onChange={(e) => setPrintedName(e.target.value)}
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
          Please sign above and print your name to continue
        </p>
      )}
    </div>
  );
}
