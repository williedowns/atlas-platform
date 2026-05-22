"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserEmailEditor({
  userId,
  currentEmail,
  currentUserId,
}: {
  userId: string;
  currentEmail: string | null;
  currentUserId: string;
}) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = userId === currentUserId;

  if (isSelf) {
    return <p className="text-xs text-slate-500 truncate">{email}</p>;
  }

  function startEdit() {
    setDraft(email);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(email);
    setError(null);
    setEditing(false);
  }

  async function save() {
    const trimmed = draft.trim().toLowerCase();
    if (trimmed === email) {
      setEditing(false);
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError("Invalid email format");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update email");
      return;
    }

    setEmail(trimmed);
    setEditing(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={saving}
            autoFocus
            className="flex-1 min-w-0 text-xs border border-[#00929C] rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-xs font-semibold text-[#00929C] hover:text-[#007a82] disabled:opacity-50 px-1.5"
            title="Save"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50 px-1.5"
            title="Cancel"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to edit email"
      className="group inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#00929C] max-w-full"
    >
      <span className="truncate">{email || <span className="italic text-slate-400">No email</span>}</span>
      <svg
        className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  );
}
