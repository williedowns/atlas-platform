"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// react-signature-canvas types are incompatible with Next.js dynamic — cast.
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

// Atlas seller block — locked values that Texas auditors look for on Form 01-339.
const SELLER = {
  name: "Atlas Spas and Swim Spas",
  street: "5511 Hwy 31 W",
  cityStateZip: "Tyler, TX 75709",
};

// Signature image overlay position on page 2 (612 x 792 PDF points).
// pdf-lib origin is bottom-left. Derived from the Title field's widget
// rectangle (x=279 y=121 w=194 h=23) — the Purchaser column runs to its
// left at the same y/height. The "sign here" arrow occupies x≈43–72.
const SIG_OVERLAY = { x: 78, y: 123, width: 195, height: 20 };

interface ExemptionCertSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };
  onComplete: (cert: { dataUrl: string; filename: string; mime: string }) => void;
}

function formatToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function ExemptionCertSignModal({
  isOpen,
  onClose,
  customer,
  onComplete,
}: ExemptionCertSignModalProps) {
  const sigRef = useRef<any>(null);
  const [printedName, setPrintedName] = useState("");
  const [title, setTitle] = useState("Owner");
  const [hasSigned, setHasSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => formatToday(), []);
  const purchaserName = useMemo(
    () => `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
    [customer.first_name, customer.last_name],
  );
  const purchaserCityStateZip = useMemo(
    () => `${customer.city ?? ""}, ${customer.state ?? ""} ${customer.zip ?? ""}`.trim(),
    [customer.city, customer.state, customer.zip],
  );

  useEffect(() => {
    if (isOpen) {
      setPrintedName(purchaserName);
      setTitle("Owner");
      setHasSigned(false);
      setError(null);
    }
  }, [isOpen, purchaserName]);

  if (!isOpen) return null;

  function handleSignEnd() {
    const empty = !!sigRef.current && sigRef.current.isEmpty?.();
    setHasSigned(!empty);
  }

  function handleClearSignature() {
    sigRef.current?.clear?.();
    setHasSigned(false);
  }

  async function handleSubmit() {
    if (!sigRef.current || sigRef.current.isEmpty?.()) {
      setError("Please sign before submitting.");
      return;
    }
    if (!printedName.trim()) {
      setError("Printed name is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sigDataUrl: string = sigRef.current.toDataURL("image/png");

      // Lazy-load pdf-lib so it doesn't bloat the initial Step 5 bundle.
      const { PDFDocument } = await import("pdf-lib");

      const templateBytes = await fetch("/forms/tx-01-339.pdf").then((r) => {
        if (!r.ok) throw new Error(`Could not load form template (${r.status})`);
        return r.arrayBuffer();
      });

      const pdf = await PDFDocument.load(templateBytes);
      const form = pdf.getForm();

      // Page 2 is the Exemption Certification. AcroForm field names verified
      // via scripts/inspect-tx-01-339.mjs.
      form.getTextField("Exemption purchaser").setText(printedName);
      form.getTextField("Exemption purchaser street").setText(customer.address ?? "");
      form.getTextField("Exemption purchaser phone").setText(customer.phone ?? "");
      form.getTextField("Exemption purchaser city").setText(purchaserCityStateZip);

      form.getTextField("Exempt seller").setText(SELLER.name);
      form.getTextField("Exempt seller street").setText(SELLER.street);
      form.getTextField("Exempt seller city").setText(SELLER.cityStateZip);

      form.getTextField("Exempt item description").setText("Hot tub or swim spa");
      form.getTextField("Exemption reason").setText("Hydrotherapy");

      form.getTextField("Exempt purchaser title").setText(title);
      form.getTextField("Exempt purchaser sig date").setText(today);

      // Embed signature PNG into the Purchaser box on page 2.
      const sigBytes = dataUrlToUint8(sigDataUrl);
      const sigImage = await pdf.embedPng(sigBytes);
      const page2 = pdf.getPage(1);
      page2.drawImage(sigImage, SIG_OVERLAY);

      // Flatten so the field text becomes part of the page content. Prevents
      // editing the cert after the customer signs.
      form.flatten();

      // Drop the unused Resale Certificate front page — only the Exemption
      // Certification (page 2) is filled out and signed.
      pdf.removePage(0);

      const merged = await pdf.save();

      // Build a data URL the existing Step 7 upload pipeline can hand off.
      let binary = "";
      for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
      const dataUrl = `data:application/pdf;base64,${btoa(binary)}`;

      onComplete({
        dataUrl,
        filename: "tx-01-339-signed.pdf",
        mime: "application/pdf",
      });
      onClose();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[ExemptionCertSignModal] generate failed", e);
      setError(e?.message ?? "Could not generate certificate. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-[#010F21]">
            Texas Tax Exemption Certificate (Form 01-339)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review the prefilled fields, sign below, then submit. The signed PDF is
            saved with the contract.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Seller block (locked) */}
          <section className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
              Seller
            </p>
            <p className="text-sm text-slate-800">{SELLER.name}</p>
            <p className="text-sm text-slate-800">{SELLER.street}</p>
            <p className="text-sm text-slate-800">{SELLER.cityStateZip}</p>
          </section>

          {/* Purchaser block (locked, from customer record) */}
          <section className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
              Purchaser
            </p>
            <p className="text-sm text-slate-800">{purchaserName || "—"}</p>
            <p className="text-sm text-slate-800">{customer.address || "—"}</p>
            <p className="text-sm text-slate-800">{purchaserCityStateZip || "—"}</p>
            {customer.phone && (
              <p className="text-sm text-slate-800">{customer.phone}</p>
            )}
          </section>

          {/* Items + Reason (locked) */}
          <section className="grid grid-cols-1 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Items to be purchased
              </p>
              <p className="text-sm text-slate-800">Hot tub or swim spa</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Reason for exemption
              </p>
              <p className="text-sm text-slate-800">Hydrotherapy</p>
            </div>
          </section>

          {/* Printed name + Title + Date */}
          <section className="space-y-3">
            <Input
              label="Printed Name"
              type="text"
              value={printedName}
              onChange={(e) => setPrintedName(e.target.value)}
              placeholder="Customer full name"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Owner"
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date
                </label>
                <div className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-800">
                  {today}
                </div>
              </div>
            </div>
          </section>

          {/* Signature canvas */}
          <section>
            <p className="text-xs font-semibold text-slate-700 mb-2">Signature</p>
            <div className="relative">
              <div className="w-full rounded-lg border-2 border-slate-300 bg-white overflow-hidden">
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#1a1a1a"
                  canvasProps={{
                    className: "w-full touch-manipulation",
                    style: { width: "100%", height: "180px" },
                  }}
                  onEnd={handleSignEnd}
                />
              </div>
              {!hasSigned && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-slate-300 text-base italic">Sign here</span>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleClearSignature}
                className="text-xs font-semibold text-slate-500 hover:text-red-600"
              >
                Clear Signature
              </button>
            </div>
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white">
          <Button variant="ghost" onClick={onClose} disabled={submitting} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !hasSigned}
            className="flex-1 bg-[#00939B] hover:bg-[#007e85] text-white"
          >
            {submitting ? "Generating…" : "Sign & Generate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
