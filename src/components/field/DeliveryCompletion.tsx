"use client";

import React, { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[200px] rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
      <span className="text-slate-400">Loading…</span>
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

interface Props {
  dwoId: string;
  contractId: string;
  customerId: string | null;
  contractNumber: string;
  customerName: string;
  balanceDue: number;
}

export default function DeliveryCompletion({
  dwoId,
  contractId,
  customerId,
  contractNumber,
  customerName,
  balanceDue,
}: Props) {
  const router = useRouter();
  const sigRef = useRef<any>(null);
  const [hasSigned, setHasSigned] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needBalanceOverride, setNeedBalanceOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const handleSignEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) setHasSigned(true);
  }, []);

  async function uploadPhoto(file: File, category: "photo" = "photo") {
    if (!customerId) {
      setError("Customer ID missing — can't attach photo to file vault");
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("customer_id", customerId);
    fd.append("contract_id", contractId);
    fd.append("category", category);
    const r = await fetch("/api/customer-files", { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Photo upload failed");
      return;
    }
    setPhotoCount((c) => c + 1);
  }

  async function uploadSignatureAndComplete(override: boolean) {
    setSubmitting(true);
    setError(null);

    let signatureUrl: string | null = null;
    if (hasSigned && sigRef.current) {
      const dataUrl = sigRef.current.toDataURL("image/png");
      try {
        const blob = await fetch(dataUrl).then((r) => r.blob());
        const supabase = createClient();
        const path = `delivery-${dwoId}-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from("signatures")
          .upload(path, blob, { contentType: "image/png", upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(path);
          signatureUrl = urlData.publicUrl;
        } else {
          // Fallback: embed as data URL
          signatureUrl = dataUrl;
        }
      } catch {
        signatureUrl = dataUrl;
      }
    }

    const r = await fetch(`/api/deliveries/${dwoId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_signature_url: signatureUrl,
        override_balance: override,
        override_reason: override ? overrideReason : undefined,
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      if (r.status === 409 && b.can_override) {
        setNeedBalanceOverride(true);
        setError(b.error);
        return;
      }
      setError(b.error ?? "Couldn't complete delivery");
      return;
    }

    router.push(`/field?completed=${contractNumber}`);
  }

  const balanceClear = balanceDue <= 0.01;

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Delivery</p>
        <p className="text-lg font-bold text-slate-900">{customerName}</p>
        <p className="text-sm text-slate-500">#{contractNumber}</p>
        <div className="mt-2 flex justify-between items-center">
          <span className="text-sm text-slate-600">Balance due</span>
          <span className={`text-base font-bold ${balanceClear ? "text-emerald-700" : "text-amber-700"}`}>
            {formatCurrency(balanceDue)}
          </span>
        </div>
      </div>

      {/* Balance collection */}
      {!balanceClear && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-bold text-amber-900">Balance not yet collected</p>
          <p className="text-xs text-amber-800">
            Collect payment before delivering. Tap below to take a card, check, or cash.
          </p>
          <Link href={`/contracts/${contractId}/collect-payment`}>
            <Button variant="success" size="lg" className="w-full">
              Collect Balance ({formatCurrency(balanceDue)})
            </Button>
          </Link>
        </div>
      )}

      {/* Photo upload */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Photos</p>
          <p className="text-xs text-slate-500">Unit on truck, installed, any damage. {photoCount} uploaded.</p>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadPhoto(f);
            e.target.value = "";
          }}
          disabled={uploading}
          className="block w-full text-sm"
        />
        {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
      </div>

      {/* Signature */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-sm font-bold text-slate-900">Customer Signature</p>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
          <SignatureCanvas
            ref={sigRef}
            penColor="#0f172a"
            canvasProps={{ className: "w-full h-[180px]", style: { touchAction: "none" } }}
            onEnd={handleSignEnd}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sigRef.current?.clear();
            setHasSigned(false);
          }}
        >
          Clear
        </Button>
      </div>

      {needBalanceOverride && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-bold text-red-900">Override balance</p>
          <p className="text-xs text-red-800">A manager approved completing without balance? Enter reason.</p>
          <input
            type="text"
            placeholder="Why are you overriding?"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className="h-10 w-full rounded-lg border border-red-300 bg-white px-3 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting || !overrideReason.trim()}
            onClick={() => uploadSignatureAndComplete(true)}
          >
            Override and Mark Delivered
          </Button>
        </div>
      )}

      {error && !needBalanceOverride && <p className="text-sm text-red-700">{error}</p>}

      {/* Mark Delivered */}
      <Button
        variant="default"
        size="xl"
        className="w-full"
        disabled={submitting || (!balanceClear && !needBalanceOverride)}
        onClick={() => uploadSignatureAndComplete(false)}
      >
        {submitting ? "Completing…" : "Mark Delivered"}
      </Button>
    </div>
  );
}
