"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { logActivity, type ActivityType } from "./activityActions";

interface LogActivityFormProps {
  contactId?: string | null;
  opportunityId?: string | null;
  householdId?: string | null;
}

const TYPES: Array<{
  value: ActivityType;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  needsDirection?: boolean;
}> = [
  {
    value: "note",
    label: "Note",
    placeholder: "Add a note — anything important to remember.",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    value: "call",
    label: "Call",
    placeholder: "Call summary — what did you discuss? Next steps?",
    needsDirection: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    value: "sms",
    label: "SMS",
    placeholder: "Text message — what was sent or received?",
    needsDirection: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    value: "email",
    label: "Email",
    placeholder: "Email summary — subject, key points, next steps.",
    needsDirection: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: "meeting",
    label: "Meeting",
    placeholder: "Meeting notes — attendees, agenda, outcomes.",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function LogActivityForm({ contactId, opportunityId, householdId }: LogActivityFormProps) {
  const [type, setType] = useState<ActivityType>("note");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeType = TYPES.find((t) => t.value === type) ?? TYPES[0];

  // Keyboard shortcut: press "N" anywhere on the detail page to focus the log form.
  // Skips when user is already typing in an input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      e.preventDefault();
      textareaRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    if (!body.trim()) return;

    startTransition(async () => {
      const result = await logActivity({
        type,
        body,
        contactId,
        opportunityId,
        householdId,
        direction: activeType.needsDirection ? direction : null,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to log activity.");
        return;
      }
      if ((result as any).warning) {
        setWarning((result as any).warning);
      }
      setBody("");
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) {
      e.preventDefault();
      (e.target as HTMLTextAreaElement).form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-slate-100 bg-slate-50/50">
      {/* Type pills */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              type === t.value
                ? "bg-[#00929C] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-[#00929C] hover:text-[#00929C]"
            }`}
          >
            <span className={type === t.value ? "text-white" : "text-slate-500"}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Direction toggle (call/sms/email only) */}
      {activeType.needsDirection && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] text-slate-500">Direction:</span>
          {(["outbound", "inbound"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                direction === d
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400"
              }`}
            >
              {d === "outbound" ? "→ Outbound" : "← Inbound"}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={activeType.placeholder}
        rows={2}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C] resize-y"
      />

      {error && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}
      {warning && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          ⚠️ {warning}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-slate-400">
          Press <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white text-slate-600 font-mono text-[10px]">N</kbd> to focus ·{" "}
          <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white text-slate-600 font-mono text-[10px]">⌘ Enter</kbd> to submit
        </p>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="px-3 py-1.5 rounded-lg bg-[#00929C] hover:bg-[#007a82] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          {pending ? "Logging…" : `Log ${activeType.label.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}
