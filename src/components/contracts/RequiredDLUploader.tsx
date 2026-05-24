"use client";

import { useEffect, useState } from "react";

// Vercel caps serverless request bodies at 4.5MB. iPad/iPhone photos at full
// resolution routinely exceed that and the upload fails with a generic error.
// Downscale large images client-side before sending — keeps text legible on a
// driver's license while staying well under the limit.
const COMPRESS_THRESHOLD_BYTES = 1_500_000;
const MAX_DIMENSION_PX = 2000;
const JPEG_QUALITY = 0.85;

async function downscaleImage(f: File): Promise<File> {
  if (!f.type.startsWith("image/")) return f;
  if (f.size < COMPRESS_THRESHOLD_BYTES) return f;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image decode failed"));
      i.src = dataUrl;
    });
    const longest = Math.max(img.width, img.height);
    const scale = longest > MAX_DIMENSION_PX ? MAX_DIMENSION_PX / longest : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return f;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= f.size) return f;
    const baseName = f.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return f;
  }
}

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
    const toSend = await downscaleImage(f);
    const fd = new FormData();
    fd.append("file", toSend);
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
            <label className="text-xs font-semibold text-slate-500 hover:text-[#00929C] cursor-pointer">
              Retake
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
            <label className="text-xs font-semibold text-slate-500 hover:text-[#00929C] cursor-pointer">
              Replace file
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-[#00929C] bg-[#00929C] text-white text-xs font-semibold hover:bg-[#007279] cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {uploading ? "Uploading…" : "Take Photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          <label className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-50 cursor-pointer">
            {uploading ? "Uploading…" : "Choose File"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
