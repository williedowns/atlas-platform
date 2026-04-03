"use client";

import { useState } from "react";

interface CertUploadProps {
  contractId: string;
  certReceived: boolean;
  certReceivedAt: string | null;
}

export default function CertUpload({ contractId, certReceived: initialReceived, certReceivedAt }: CertUploadProps) {
  const [certReceived, setCertReceived] = useState(initialReceived);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractId", contractId);

      const res = await fetch("/api/portal/upload-cert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }

      setCertReceived(true);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (certReceived) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <p className="font-semibold text-emerald-800">Tax Exemption Certificate Received</p>
            {certReceivedAt && <p className="text-xs text-emerald-600 mt-0.5">Received {new Date(certReceivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="font-bold text-slate-900 mb-1">Texas Tax Exemption Certificate</h2>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed">
        If you qualify for a Texas sales tax exemption (e.g., hydrotherapy prescription), upload your completed Form 01-339 within 30 days of purchase. Our team will process your exemption and issue a refund of the tax amount paid.
      </p>

      {success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="font-semibold text-emerald-800">Certificate uploaded successfully!</p>
          <p className="text-sm text-emerald-600 mt-1">Our bookkeeper has been notified and will process your refund shortly.</p>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : "border-slate-300 hover:border-[#00929C] hover:bg-[#00929C]/5"}`}>
          <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="font-semibold text-slate-700 text-sm">{uploading ? "Uploading..." : "Upload Certificate"}</p>
          <p className="text-xs text-slate-400 mt-1">PDF, JPG, or PNG -- Max 10MB</p>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
