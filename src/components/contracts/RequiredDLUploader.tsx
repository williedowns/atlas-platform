"use client";

import { useEffect, useState } from "react";
import CameraCaptureModal from "@/components/contracts/CameraCaptureModal";

interface CustomerFile {
  id: string;
  filename: string;
  category: string;
  signed_url: string | null;
  created_at: string;
}

interface Props {
  customerId: string;
  contractId?: string;
  /** "drivers_license" for primary, "drivers_license_secondary" for co-borrower */
  category: "drivers_license" | "drivers_license_secondary";
  /** Title shown above the widget — "Primary Borrower DL" / "Co-Borrower DL" */
  label: string;
  /** Required name shown when no DL is on file (so the salesperson knows whose DL to upload) */
  borrowerName?: string;
  /** Called whenever a new DL is uploaded successfully */
  onUploaded?: () => void;
}

export default function RequiredDLUploader({ customerId, contractId, category, label, borrowerName, onUploaded }: Props) {
  const [file, setFile] = useState<CustomerFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function refresh() {
    if (!customerId) return;
    setLoading(true);
    const r = await fetch(`/api/customer-files?customer_id=${customerId}&category=${category}`);
    if (!r.ok) {
      setError("Couldn't load DL");
      setLoading(false);
      return;
    }
    const data = await r.json();
    const files = (data.files ?? []) as CustomerFile[];
    setFile(files[0] ?? null); // most recent — the API orders by created_at desc
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, category]);

  async function uploadFile(f: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("customer_id", customerId);
    fd.append("category", category);
    if (contractId) fd.append("contract_id", contractId);
    const r = await fetch("/api/customer-files", { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Upload failed");
      return;
    }
    await refresh();
    onUploaded?.();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset input
    if (!f) return;
    await uploadFile(f);
  }

  const ok = !!file;

  return (
    <div className={`rounded-lg border-2 px-3 py-2 ${ok ? "border-emerald-200 bg-emerald-50/40" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{label}</p>
          {borrowerName && (
            <p className="text-[11px] text-slate-500">{borrowerName}</p>
          )}
        </div>
        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border whitespace-nowrap ${
          ok ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
        }`}>
          {ok ? "✓ Uploaded" : "✗ Missing"}
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 mt-1">Loading…</p>
      ) : file ? (
        <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
          <p className="text-xs text-slate-600 truncate flex-1 min-w-0">{file.filename}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {file.signed_url && (
              <a href={file.signed_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#00929C] hover:underline">
                View
              </a>
            )}
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={uploading}
              className="text-xs font-semibold text-slate-500 hover:text-[#00929C] disabled:opacity-50"
            >
              Retake
            </button>
            <label className="text-xs font-semibold text-slate-500 hover:text-[#00929C] cursor-pointer">
              Replace file
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={uploading}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-[#00929C] bg-[#00929C] text-white text-xs font-semibold hover:bg-[#007279] disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take Photo
          </button>
          <label className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-50 cursor-pointer">
            {uploading ? "Uploading…" : "Choose File"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}

      {cameraOpen && (
        <CameraCaptureModal
          title={`Take Photo — ${label}`}
          filename={`dl-${category}-${Date.now()}.jpg`}
          onCapture={async (f) => {
            await uploadFile(f);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
