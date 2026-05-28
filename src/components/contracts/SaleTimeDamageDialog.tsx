"use client";

import { useEffect, useRef, useState } from "react";
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
  // Hidden file inputs: one camera-first (capture="environment" hints the
  // device's rear camera so the rep snaps a quick shot of the damage) and
  // one regular gallery picker. Both feed the same `files` state — the
  // visible buttons just trigger whichever modality the rep prefers.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
                {/* Two visible buttons — one drives the camera-first hidden
                    input, the other opens the gallery picker. Both append
                    to the same `files` state so the rep can mix camera
                    shots and library uploads in a single submission. */}
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-300 bg-red-100 text-red-800 text-xs font-semibold hover:bg-red-200 transition-colors touch-manipulation"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors touch-manipulation"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload from Library
                  </button>
                </div>
                {/* Hidden camera input — capture="environment" hints rear
                    camera on iOS/Android. accept="image/*" keeps it to
                    photos only. */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const incoming = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...incoming]);
                    e.target.value = "";
                  }}
                />
                {/* Hidden gallery input — no capture attr, multi-select. */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const incoming = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...incoming]);
                    e.target.value = "";
                  }}
                />
                {files.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1.5">{files.length} photo(s) selected</p>
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
