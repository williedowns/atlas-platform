"use client";

import { useState, useTransition, useRef } from "react";
import { createTask, type TaskType, type TaskPriority } from "./taskActions";

interface TaskQuickAddProps {
  contactId?: string | null;
  opportunityId?: string | null;
  /** Compact variant for embedded use (no big card padding). */
  compact?: boolean;
}

const TYPES: Array<{ value: TaskType; label: string }> = [
  { value: "follow_up", label: "Follow up" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "meeting", label: "Meeting" },
  { value: "custom", label: "Custom" },
];

const PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function isoWithHourOffset(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function isoTodayEOD(): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function isoTomorrowMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function isoNextWeekMonday(): string {
  const d = new Date();
  const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

const DUE_PRESETS = [
  { label: "Today", iso: isoTodayEOD },
  { label: "Tomorrow", iso: isoTomorrowMorning },
  { label: "+3 days", iso: () => isoWithHourOffset(72) },
  { label: "Next Mon", iso: isoNextWeekMonday },
];

export default function TaskQuickAdd({ contactId, opportunityId, compact = false }: TaskQuickAddProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("follow_up");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [duePreset, setDuePreset] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;

    const preset = DUE_PRESETS.find((p) => p.label === duePreset);
    const dueAt = preset ? preset.iso() : null;

    startTransition(async () => {
      const result = await createTask({
        title,
        type,
        priority,
        dueAt,
        contactId,
        opportunityId,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to create task.");
        return;
      }
      setTitle("");
      setDuePreset(null);
      inputRef.current?.focus();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-slate-50/50 border-b border-slate-100 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-400 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="+ Add a task — e.g. Call Bob about financing"
          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="px-3 py-2 rounded-lg bg-[#00929C] hover:bg-[#007a82] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          {pending ? "…" : "Add"}
        </button>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
          className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00929C]"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00929C]"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label} priority</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Due:</span>
          {DUE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDuePreset(duePreset === p.label ? null : p.label)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                duePreset === p.label
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-600 mt-2">{error}</p>
      )}
    </form>
  );
}
