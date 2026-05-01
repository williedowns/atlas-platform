"use client";

import React, { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
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
    <div className="w-full h-[180px] rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
      <span className="text-slate-400 text-sm">Loading signature pad…</span>
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

type AckKey = AcknowledgmentClause["key"];

interface RemoteSignFormProps {
  token: string;
  contractNumber: string;
  customerFirstName: string;
  customerLastName: string;
  productNames: string[];
  total: number;
  depositAmount: number;
}

export default function RemoteSignForm({
  token,
  contractNumber,
  customerFirstName,
  customerLastName,
  productNames,
  total,
  depositAmount,
}: RemoteSignFormProps) {
  const sigCanvasRef = useRef<any>(null);
  const initialsRefs = useRef<Record<AckKey, any>>({
    sales_final: null,
    cancellation_forfeit: null,
    rx_30_day: null,
  });

  const [printedName, setPrintedName] = useState(`${customerFirstName} ${customerLastName}`.trim());
  const [hasSigned, setHasSigned] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [initialsUrls, setInitialsUrls] = useState<Record<AckKey, string | null>>({
    sales_final: null,
    cancellation_forfeit: null,
    rx_30_day: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ contract_number: string } | null>(null);

  const allAcked = REQUIRED_ACKNOWLEDGMENTS.every((a) => !!initialsUrls[a.key]);
  const missingAcks = REQUIRED_ACKNOWLEDGMENTS.filter((a) => !initialsUrls[a.key]);
  const canSubmit = hasSigned && printedName.trim().length > 0 && hasConsented && allAcked && !isSubmitting;

  const handleSignEnd = useCallback(() => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      setHasSigned(true);
    }
  }, []);

  const handleClearSig = () => {
    sigCanvasRef.current?.clear();
    setHasSigned(false);
  };

  const handleInitialsEnd = useCallback(
    (key: AckKey) => () => {
      const ref = initialsRefs.current[key];
      if (ref && !ref.isEmpty()) {
        setInitialsUrls((prev) => ({ ...prev, [key]: ref.toDataURL("image/png") }));
      }
    },
    []
  );

  const handleInitialsClear = (key: AckKey) => () => {
    initialsRefs.current[key]?.clear();
    setInitialsUrls((prev) => ({ ...prev, [key]: null }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const signatureDataUrl = sigCanvasRef.current?.toDataURL("image/png");
      if (!signatureDataUrl) throw new Error("Could not capture signature");

      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printed_name: printedName.trim(),
          signature_data_url: signatureDataUrl,
          electronic_consent: true,
          initials: {
            sales_final: initialsUrls.sales_final,
            cancellation_forfeit: initialsUrls.cancellation_forfeit,
            rx_30_day: initialsUrls.rx_30_day,
          },
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? `Signing failed (${res.status})`);
      }

      setSuccess({ contract_number: body.contract_number ?? contractNumber });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 px-4 text-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-40" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-emerald-700 tracking-tight">All Signed!</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Contract <span className="font-semibold">{success.contract_number}</span> is signed and on its way to your inbox.
          </p>
          <p className="text-slate-400 mt-2 text-xs">You can close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">Atlas Spas · Contract Signing</p>
        <h1 className="text-xl font-black text-slate-900 mt-1">
          Hi {customerFirstName}, ready to make it official?
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review the agreement, initial each acknowledgment, then sign at the bottom.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Contract #</span>
              <p className="font-medium">{contractNumber}</p>
            </div>
            <div>
              <span className="text-slate-500">Product</span>
              <p className="font-medium">{productNames.length > 0 ? productNames.join(", ") : "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">Total</span>
              <p className="font-semibold text-[#00929C]">{formatCurrency(total)}</p>
            </div>
            <div>
              <span className="text-slate-500">Deposit</span>
              <p className="font-semibold text-[#00929C]">{formatCurrency(depositAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Terms &amp; Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3 text-xs leading-relaxed text-slate-700">
            {TERMS_AND_CONDITIONS.map((section, sIdx) => (
              <div key={section.heading}>
                <p className="font-bold uppercase tracking-wide text-[10px] text-slate-500">{section.heading}</p>
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

      {/* Required Initials */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-amber-900">Required Initials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-amber-800">
            Please initial each of the three clauses below to acknowledge you understand them.
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
                <p className="text-sm font-bold text-slate-900">{a.label}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{a.text}</p>
                <div className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Your Initials</p>
                  <div className="relative">
                    <div
                      className={`w-full rounded border-2 bg-slate-50 overflow-hidden ${
                        url ? "border-emerald-400" : "border-dashed border-amber-400"
                      }`}
                    >
                      <SignatureCanvas
                        ref={(el: any) => {
                          initialsRefs.current[a.key] = el;
                        }}
                        penColor="#0f172a"
                        canvasProps={{
                          className: "w-full touch-manipulation",
                          style: { width: "100%", height: "80px" },
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
                    className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-red-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Signature */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            label="Printed Name *"
            value={printedName}
            onChange={(e) => setPrintedName(e.target.value)}
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Sign Here *</p>
            <div
              className={`w-full rounded border-2 bg-slate-50 overflow-hidden ${
                hasSigned ? "border-emerald-400" : "border-dashed border-slate-300"
              }`}
            >
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="#0f172a"
                canvasProps={{
                  className: "w-full touch-manipulation",
                  style: { width: "100%", height: "180px" },
                }}
                onEnd={handleSignEnd}
              />
            </div>
            <button
              type="button"
              onClick={handleClearSig}
              className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-red-600"
            >
              Clear signature
            </button>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => setHasConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#00929C]"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I agree to sign this contract electronically and understand that my electronic signature
              has the same legal effect as a handwritten signature.
            </span>
          </label>

          {!canSubmit && (hasSigned || hasConsented) && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              {missingAcks.length > 0 && <span>Missing initials: {missingAcks.map((a) => a.label).join(", ")}.</span>}
              {!hasSigned && <span> Please sign above.</span>}
              {!hasConsented && <span> Please check the consent box.</span>}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Submitting…" : "Submit Signed Contract"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
