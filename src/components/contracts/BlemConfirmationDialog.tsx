"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface BlemDialogPayload {
  unitLabel: string;          // human-readable header e.g. "TS 8.25 · Serial 2603888"
  blem_description: string;
  blem_photo_urls: string[];
  // Optional captions, parallel array to photo_urls
  captions?: (string | null | undefined)[];
}

interface Props {
  open: boolean;
  payload: BlemDialogPayload | null;
  // Fired when the customer has tapped every photo AND confirmed.
  // Receives the timestamp the gate was completed.
  onConfirm: (viewedAt: string) => void;
  onCancel: () => void;
  // When true, force a full-screen modal styled for handing the iPad to
  // the customer. This is the path for "Show to Customer" at the kiosk.
  // When false, this is a lighter "Preview blem details" view for the
  // salesperson before they hand the iPad over.
  kioskMode?: boolean;
}

/**
 * Show-to-Customer gate. Customer must tap every photo before the confirm
 * button enables. The tap-through is what proves the customer actually
 * looked at each blemish — the resulting timestamp is recorded in
 * signature_metadata.blem_photos_viewed_at and is the legal record that
 * defends against future "I wasn't told about the damage" disputes.
 */
export function BlemConfirmationDialog({
  open,
  payload,
  onConfirm,
  onCancel,
  kioskMode = false,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewed, setViewed] = useState<Set<number>>(new Set([0]));

  if (!open || !payload) return null;

  const photos = payload.blem_photo_urls;
  const total = photos.length;
  const allViewed = total === 0 || viewed.size >= total;

  function goTo(i: number) {
    setActiveIndex(i);
    setViewed((s) => new Set([...s, i]));
  }

  function handleConfirm() {
    onConfirm(new Date().toISOString());
  }

  return (
    // Stop click propagation on the backdrop so taps inside this dialog
    // (notably thumbnail "tap to view" interactions) don't bubble up to any
    // ancestor modal whose backdrop also has onClick=onClose — that would
    // unmount the parent flow and lose form state.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold">!</span>
              <div>
                <h2 className="text-lg font-black text-red-900">
                  {kioskMode ? "Please Review — This Unit Has Blemishes" : "Blem Unit — Confirm with Customer"}
                </h2>
                <p className="text-xs text-red-700/80">{payload.unitLabel}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-red-100"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
          {kioskMode && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                This product is being sold AS-IS with the existing damage shown below.
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Please tap each photo to view it. After reviewing every photo and the description, tap "I have reviewed all photos" to continue.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Damage Description
            </p>
            <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
              {payload.blem_description || "(No description provided)"}
            </p>
          </div>

          {/* Featured photo viewer */}
          {total > 0 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                Photos ({viewed.size} of {total} viewed)
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-100 overflow-hidden">
                <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photos[activeIndex]}
                    alt={payload.captions?.[activeIndex] ?? `Blem photo ${activeIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                  {payload.captions?.[activeIndex] && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 text-center">
                      {payload.captions[activeIndex]}
                    </div>
                  )}
                </div>
              </div>
              {/* Thumbnails — tap to view, marks viewed */}
              <ul className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                {photos.map((url, i) => {
                  const isViewed = viewed.has(i);
                  const isActive = i === activeIndex;
                  return (
                    <li key={url + i}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                          isActive ? "border-[#00929C]" : isViewed ? "border-emerald-400" : "border-slate-300"
                        }`}
                        aria-label={`View photo ${i + 1}${isViewed ? " (viewed)" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {isViewed && !isActive && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900">No photos attached to this blem unit. Please add photos before selling.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white space-y-2 sticky bottom-0">
          {!allViewed && total > 0 && (
            <p className="text-xs text-amber-700 text-center">
              Tap each remaining photo ({total - viewed.size} of {total} not yet viewed) to continue.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              size="lg"
              className="flex-1"
              disabled={!allViewed}
              onClick={handleConfirm}
            >
              {kioskMode ? "I have reviewed all photos" : "Confirm & Add to Contract"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
