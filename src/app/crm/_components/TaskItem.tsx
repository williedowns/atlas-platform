"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { completeTask, snoozeTask, deleteTask } from "./taskActions";

interface TaskItemProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    due_at: string | null;
    contact_id: string | null;
    opportunity_id: string | null;
    contact: { id: string; first_name: string; last_name: string | null } | null;
    opportunity: { id: string; name: string } | null;
  };
  /** Hide parent-record links (when rendered ON the parent page already). */
  hideParentLinks?: boolean;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  call: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  sms: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  email: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  follow_up: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  meeting: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  custom: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-500",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

function relativeDueLabel(iso: string | null): { label: string; color: string } | null {
  if (!iso) return null;
  const due = new Date(iso).getTime();
  const now = Date.now();
  const diff = due - now;
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);

  if (diff < 0) {
    if (hours > -24) return { label: `Overdue ${Math.abs(hours)}h`, color: "text-red-600" };
    return { label: `Overdue ${Math.abs(days)}d`, color: "text-red-600" };
  }
  if (hours <= 1) return { label: "Due now", color: "text-red-600" };
  if (hours < 24) return { label: `Due in ${hours}h`, color: "text-amber-600" };
  if (days <= 7) return { label: `Due in ${days}d`, color: "text-slate-600" };
  return { label: new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-slate-500" };
}

export default function TaskItem({ task, hideParentLinks = false }: TaskItemProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const due = relativeDueLabel(task.due_at);
  const typeIcon = TYPE_ICON[task.type] ?? TYPE_ICON.custom;

  const contactName = task.contact
    ? [task.contact.first_name, task.contact.last_name].filter(Boolean).join(" ")
    : null;

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeTask(task.id);
      if (!result.ok) setError(result.error ?? "Failed to complete.");
    });
  }

  function handleSnooze(hours: number) {
    setError(null);
    const next = new Date();
    next.setHours(next.getHours() + hours);
    startTransition(async () => {
      const result = await snoozeTask(task.id, next.toISOString());
      if (!result.ok) setError(result.error ?? "Failed to snooze.");
    });
  }

  function handleDelete() {
    if (!confirm("Delete this task?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) setError(result.error ?? "Failed to delete.");
    });
  }

  return (
    <div className="px-4 py-3 group">
      <div className="flex items-start gap-3">
        {/* Complete checkbox */}
        <button
          type="button"
          onClick={handleComplete}
          disabled={pending}
          aria-label="Mark complete"
          className="w-5 h-5 mt-0.5 rounded border-2 border-slate-300 hover:border-[#00929C] flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {pending && (
            <span className="w-2 h-2 bg-[#00929C] rounded-full animate-pulse" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500">{typeIcon}</span>
            <p className="text-sm font-semibold text-slate-900 leading-snug">{task.title}</p>
            {task.priority !== "normal" && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.normal}`}>
                {task.priority}
              </span>
            )}
            {due && (
              <span className={`text-[11px] font-medium ${due.color}`}>· {due.label}</span>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{task.description}</p>
          )}

          {!hideParentLinks && (contactName || task.opportunity) && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {contactName && task.contact && (
                <Link
                  href={`/crm/contacts/${task.contact.id}`}
                  className="text-[11px] text-[#00929C] hover:underline font-medium"
                >
                  → {contactName}
                </Link>
              )}
              {task.opportunity && (
                <Link
                  href={`/crm/opportunities/${task.opportunity.id}`}
                  className="text-[11px] text-[#00929C] hover:underline font-medium truncate max-w-[200px]"
                >
                  💼 {task.opportunity.name}
                </Link>
              )}
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-600 mt-1">{error}</p>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            type="button"
            onClick={() => handleSnooze(24)}
            disabled={pending}
            aria-label="Snooze 1 day"
            className="px-2 py-1 rounded text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            +1d
          </button>
          <button
            type="button"
            onClick={() => handleSnooze(24 * 7)}
            disabled={pending}
            aria-label="Snooze 1 week"
            className="px-2 py-1 rounded text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            +1w
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            aria-label="Delete task"
            className="px-2 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
