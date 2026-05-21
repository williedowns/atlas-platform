"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface NotesEditorProps {
  contractId: string;
  notes: string | null;
  externalNotes: string | null;
  canEdit: boolean;
}

export default function NotesEditor({
  contractId,
  notes,
  externalNotes,
  canEdit,
}: NotesEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [internalDraft, setInternalDraft] = useState<string>(notes ?? "");
  const [externalDraft, setExternalDraft] = useState<string>(externalNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canEdit) return null;

  const internalDirty = internalDraft !== (notes ?? "");
  const externalDirty = externalDraft !== (externalNotes ?? "");
  const dirty = internalDirty || externalDirty;

  function save() {
    setError(null);
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: internalDraft.trim().length === 0 ? null : internalDraft,
          external_notes: externalDraft.trim().length === 0 ? null : externalDraft,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.error ?? `Update failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setInternalDraft(notes ?? "");
    setExternalDraft(externalNotes ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#010F21]">Notes</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal notes stay staff-only. External notes print on the contract PDF.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Internal (staff-only)
            </p>
            {notes && notes.trim().length > 0 ? (
              <p className="text-sm text-slate-900 whitespace-pre-wrap mt-1">{notes}</p>
            ) : (
              <p className="text-sm italic text-slate-400 mt-1">No internal notes</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              External (printed on contract PDF)
            </p>
            {externalNotes && externalNotes.trim().length > 0 ? (
              <p className="text-sm text-slate-900 whitespace-pre-wrap mt-1">{externalNotes}</p>
            ) : (
              <p className="text-sm italic text-slate-400 mt-1">No external notes</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Internal Notes (staff-only)
            </label>
            <textarea
              value={internalDraft}
              onChange={(e) => setInternalDraft(e.target.value)}
              rows={4}
              placeholder="Notes only staff can see"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            />
          </div>

          <div className="space-y-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900">
                Changes here re-archive the signed PDF
              </p>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              External Notes (printed on contract PDF)
            </label>
            <textarea
              value={externalDraft}
              onChange={(e) => setExternalDraft(e.target.value)}
              rows={4}
              placeholder="Notes the customer will see on the contract PDF"
              className="w-full px-3 py-2 rounded-xl border-2 border-[#00929C]/40 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00929C] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#007a82] touch-manipulation"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
