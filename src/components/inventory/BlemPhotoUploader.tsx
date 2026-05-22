"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface BlemPhoto {
  id?: string;            // present once persisted to inventory_blem_photos
  photo_url: string;
  caption?: string;
  sort_order?: number;
  // Set true on optimistically-inserted rows that are still uploading;
  // consumer can render a spinner / disable the form Save button.
  uploading?: boolean;
  // Local key for React list rendering when id is not yet assigned
  client_key: string;
}

interface Props {
  photos: BlemPhoto[];
  onChange: (next: BlemPhoto[]) => void;
  // When true, photos are uploaded to the `blem-photos` bucket immediately.
  // When false, the bytes are kept as data URLs in memory and the parent
  // is expected to upload them after some other entity (e.g. a freshly
  // created inventory unit) is created.
  uploadImmediately?: boolean;
  // Used as the object-key prefix in the bucket when uploadImmediately
  // is true. Pass the inventory_unit_id once known.
  unitId?: string;
  // Limits how many photos can be added (defaults to 12 — matches the
  // 4-thumbnail PDF embed cap plus reasonable buffer).
  maxPhotos?: number;
  // If true, the on-disk file is read but NOT uploaded; just stored as a
  // data URL on the photo object. Useful for the AddInventoryUnitForm
  // flow where the unit doesn't have an id until POST returns.
  stageOnly?: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 10 * 1024 * 1024;

export function BlemPhotoUploader({
  photos,
  onChange,
  uploadImmediately = false,
  unitId,
  maxPhotos = 12,
  stageOnly = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function newClientKey(): string {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadOne(file: File, key: string): Promise<string> {
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const objectKey = `${unitId ?? "staging"}/${key}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("blem-photos")
      .upload(objectKey, file, { upsert: false, contentType: file.type });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage
      .from("blem-photos")
      .getPublicUrl(objectKey);
    return pub.publicUrl;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      setError(`Maximum ${maxPhotos} photos.`);
      return;
    }
    const accepted = Array.from(files).slice(0, remaining);
    for (const f of accepted) {
      if (f.size > MAX_BYTES) {
        setError(`${f.name} exceeds 10 MB.`);
        continue;
      }
      const client_key = newClientKey();
      // Optimistic insert with a data URL preview so the rep sees the
      // thumbnail immediately while the upload runs in the background.
      const dataUrl = await readAsDataUrl(f).catch(() => "");
      const optimistic: BlemPhoto = {
        client_key,
        photo_url: dataUrl,
        caption: "",
        sort_order: photos.length,
        uploading: !stageOnly && uploadImmediately,
      };
      const nextOptimistic = [...photos, optimistic];
      onChange(nextOptimistic);

      if (stageOnly) {
        // Keep as data URL; parent will upload after creating the parent unit.
        continue;
      }
      if (uploadImmediately) {
        try {
          const url = await uploadOne(f, client_key);
          // Re-look up because the parent prop could have been swapped
          // out while the upload was running; using the prop directly
          // would clobber concurrent uploads.
          const settled = nextOptimistic.map((p) =>
            p.client_key === client_key
              ? { ...p, photo_url: url, uploading: false }
              : p
          );
          onChange(settled);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Upload failed";
          setError(errMsg);
          // Remove the optimistic entry on failure so the rep can retry.
          onChange(nextOptimistic.filter((p) => p.client_key !== client_key));
        }
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function updateCaption(client_key: string, caption: string) {
    onChange(photos.map((p) => (p.client_key === client_key ? { ...p, caption } : p)));
  }

  function removePhoto(client_key: string) {
    onChange(photos.filter((p) => p.client_key !== client_key));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {photos.length} of {maxPhotos} · JPG / PNG / HEIC up to 10 MB each
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= maxPhotos}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00929C] text-white hover:bg-[#007a82] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Photos
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l5-5a3 3 0 014 0l5 5m-2-2l1-1a3 3 0 014 0l2 2M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
          </svg>
          <p className="text-sm text-slate-500">No photos yet. Add at least one photo of the blemish so the customer can see it at sign.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((p) => (
            <li
              key={p.client_key}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <div className="relative aspect-square bg-slate-100">
                {/* Plain img is intentional — Next/Image needs configured domains, and
                    blem-photos URLs are arbitrary Supabase Storage public URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.photo_url}
                  alt={p.caption || "Blem photo"}
                  className="w-full h-full object-cover"
                />
                {p.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Uploading…</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(p.client_key)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 text-red-600 hover:bg-red-50 shadow flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={p.caption ?? ""}
                  onChange={(e) => updateCaption(p.client_key, e.target.value)}
                  placeholder="Caption (optional, e.g. 'scratch on right corner')"
                  className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#00929C]/40"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
