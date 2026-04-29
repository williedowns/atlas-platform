"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<string, string> = {
  drivers_license: "Driver's License (Primary)",
  drivers_license_secondary: "Driver's License (Co-Borrower)",
  proof_of_homeownership: "Proof of Homeownership",
  permit_receipt: "Permit Receipt",
  survey: "Survey",
  hoa_approval: "HOA Approval",
  income_verification: "Income Verification",
  ach_voided_check: "ACH / Voided Check",
  wet_signature_contract: "Wet-Signature Contract",
  photo: "Photo",
  other: "Other",
};

interface CustomerFile {
  id: string;
  customer_id: string;
  contract_id: string | null;
  category: keyof typeof CATEGORY_LABELS;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  internal_notes: string | null;
  signed_url: string | null;
  created_at: string;
}

interface Props {
  customerId: string;
  contractId?: string;
  /** Compact mode hides notes input; default false */
  compact?: boolean;
  /** Called whenever the file list changes */
  onFilesChange?: (files: CustomerFile[]) => void;
}

export default function CustomerFileVault({ customerId, contractId, compact = false, onFilesChange }: Props) {
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string>("drivers_license");
  const [pendingNotes, setPendingNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`/api/customer-files?customer_id=${customerId}`);
    if (!r.ok) {
      setError("Couldn't load files");
      setLoading(false);
      return;
    }
    const data = await r.json();
    setFiles(data.files ?? []);
    onFilesChange?.(data.files ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!customerId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function handleUpload() {
    if (!pendingFile || !pendingCategory) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", pendingFile);
    fd.append("customer_id", customerId);
    fd.append("category", pendingCategory);
    if (contractId) fd.append("contract_id", contractId);
    if (pendingNotes) fd.append("internal_notes", pendingNotes);

    const r = await fetch("/api/customer-files", { method: "POST", body: fd });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Upload failed");
      setUploading(false);
      return;
    }
    setPendingFile(null);
    setPendingNotes("");
    setUploading(false);
    refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Customer Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Upload form */}
        <div className="space-y-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
              <select
                value={pendingCategory}
                onChange={(e) => setPendingCategory(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">File</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                className="h-10 w-full text-sm"
              />
            </div>
          </div>
          {!compact && (
            <input
              type="text"
              value={pendingNotes}
              onChange={(e) => setPendingNotes(e.target.value)}
              placeholder="Optional internal note (e.g. 'expires 2027')"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
          )}
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={!pendingFile || uploading}
            onClick={handleUpload}
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>

        {/* Existing files */}
        {loading ? (
          <p className="text-sm text-slate-400">Loading files…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-slate-400">No files uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{f.filename}</p>
                  <p className="text-xs text-slate-500">
                    {CATEGORY_LABELS[f.category] ?? f.category} · {new Date(f.created_at).toLocaleDateString()}
                  </p>
                </div>
                {f.signed_url && (
                  <a
                    href={f.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#00929C] hover:underline whitespace-nowrap"
                  >
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
