"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BlemConfirmationDialog } from "@/components/contracts/BlemConfirmationDialog";

interface SaleTimeDamageDialogProps {
  /** Controls visibility. When false the dialog unmounts and resets state. */
  open: boolean;
  /** Display label pinned at the top of the sheet, e.g. "Twilight Series 6.2 · Serial #N1822X". */
  unitLabel: string;
  /**
   * Fires after the customer has tapped through every photo in the
   * Show-to-Customer gate and confirmed. The caller is responsible for
   * mutating the contract (adding the unit as a blem line, flipping an
   * existing line's unit_type to 'blem', etc.) using the description +
   * uploaded photo URLs + viewedAt timestamp.
   */
  onConfirm: (description: string, photo_urls: string[], viewed_at: string) => void;
  onCancel: () => void;
}

/**
 * Sale-time damage capture for a unit that's already been selected.
 *
 * Used in two places today:
 *  - InventoryUnitPicker — "+ Report new damage" on a stock/floor/wet
 *    inventory row before the unit is added to the contract.
 *  - Step5Review — "+ Report new damage" on a line item that was already
 *    added without damage being noticed.
 *
 * Flow:
 *  1. Rep enters damage description + attaches photos (camera or library)
 *  2. Submit → photos upload to the `blem-photos` Supabase bucket
 *  3. BlemConfirmationDialog (kiosk mode) shows the customer the photos
 *     they must tap through every one before confirming
 *  4. onConfirm fires with description + photo URLs + ISO viewed-at timestamp
 *
 * State is local; resets cleanly on close.
 */
export function SaleTimeDamageDialog({ open, unitLabel, onConfirm, onCancel }: SaleTimeDamageDialogProps) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<{
    urls: string[];
    captions: string[];
  } | null>(null);

  // Reset internal state every time the dialog opens so stale data from a
  // prior capture doesn't leak forward.
  useEffect(() => {
    if (open) {
      setDescription("");
      setFiles([]);
      setError(null);
      setPendingReview(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!description.trim()) {
      setError("Please describe the damage before continuing.");
      return;
    }
    if (files.length === 0) {
      setError("Please attach at least one photo of the damage.");
      return;
    }
    setError(null);
    try {
      const supabase = createClient();
      const urls: string[] = [];
      for (const f of files) {
        const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
        const key = `sale-time/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("blem-photos")
          .upload(key, f, { upsert: false, contentType: f.type });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from("blem-photos").getPublicUrl(key);
        urls.push(pub.publicUrl);
      }
      setPendingReview({
        urls,
        captions: files.map((f) => f.name),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function handleCustomerConfirm(viewedAt: string) {
    if (!pendingReview) return;
    onConfirm(description.trim(), pendingReview.urls, viewedAt);
    // Don't reset here — parent will set open=false which triggers the
    // useEffect reset on next open.
  }

  if (!open) return null;

  return (
    <>
      {!pendingReview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/60"
          onClick={onCancel}
        >
          <div
            className="mt-auto bg-white rounded-t-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/40">
              <div>
                <h2 className="text-lg font-bold text-red-900">Report New Damage</h2>
                <p className="text-xs text-red-700/80 mt-0.5">{unitLabel}</p>
              </div>
              <button onClick={onCancel} className="p-2 rounded-lg hover:bg-red-100">
                <svg className="w-5 h-5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-slate-600 leading-snug">
                Captures damage that appeared <em>after</em> this unit was added to inventory. Customer reviews the photos and signs off before the contract is finalized.
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-700">Damage Description <span className="text-red-600">*</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe where the damage is and what it looks like."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-red-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Photos <span className="text-red-600">*</span></label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const incoming = Array.from(e.target.files ?? []);
                    // Append rather than replace so multiple camera shots stick.
                    setFiles((prev) => [...prev, ...incoming]);
                    e.target.value = "";
                  }}
                  className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-red-100 file:text-red-700 file:font-semibold"
                />
                {files.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">{files.length} photo(s) selected</p>
                )}
              </div>
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
            </div>
            <div className="px-5 pb-6">
              <Button
                onClick={handleSubmit}
                variant="accent"
                size="lg"
                className="w-full"
              >
                Upload Photos & Show to Customer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show-to-Customer photo gate. Customer must tap through every
          photo before the acknowledgment finalizes. */}
      <BlemConfirmationDialog
        open={!!pendingReview}
        payload={pendingReview ? {
          unitLabel,
          blem_description: description,
          blem_photo_urls: pendingReview.urls,
          captions: pendingReview.captions,
        } : null}
        onConfirm={handleCustomerConfirm}
        onCancel={() => setPendingReview(null)}
        kioskMode
      />
    </>
  );
}
