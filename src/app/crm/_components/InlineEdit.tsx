"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateOpportunity } from "../opportunities/actions";
import { updateContact } from "../contacts/actions";
import { updateHousehold } from "./householdActions";

type FieldType = "text" | "textarea" | "currency" | "date" | "select" | "number";
type RecordType = "opportunity" | "contact" | "household";

interface SelectOption {
  value: string;
  label: string;
}

interface InlineEditProps {
  recordType: RecordType;
  recordId: string;
  field: string;
  value: string | number | null;
  fieldType?: FieldType;
  options?: SelectOption[];
  placeholder?: string;
  /** Optional label rendered above the value. */
  label?: string;
  /** How the value should display when not editing. Defaults to raw value. */
  formatDisplay?: (v: string | number | null) => string;
  /** Allow value to be cleared (sends null). Defaults true. */
  allowClear?: boolean;
  /** Maximum width for the display state. */
  className?: string;
}

function defaultDisplay(v: string | number | null, type: FieldType, options?: SelectOption[]): string {
  if (v == null || v === "") return "—";
  if (type === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
  }
  if (type === "date") {
    return new Date(String(v)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (type === "select" && options) {
    return options.find((o) => o.value === String(v))?.label ?? String(v);
  }
  return String(v);
}

export default function InlineEdit({
  recordType,
  recordId,
  field,
  value,
  fieldType = "text",
  options,
  placeholder,
  label,
  formatDisplay,
  allowClear = true,
  className = "",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.select?.();
        }
      }
    }
  }, [editing]);

  const display = formatDisplay ? formatDisplay(value) : defaultDisplay(value, fieldType, options);
  const isEmpty = value == null || value === "";

  function save(nextValue: string | null) {
    setError(null);
    let payload: unknown = nextValue;
    if (fieldType === "currency" || fieldType === "number") {
      if (nextValue === null || nextValue.trim() === "") payload = null;
      else {
        const num = Number(nextValue.replace(/[^0-9.\-]/g, ""));
        if (isNaN(num)) {
          setError("Enter a valid number");
          return;
        }
        payload = num;
      }
    } else if (fieldType === "date") {
      payload = nextValue && nextValue.trim() !== "" ? nextValue : null;
    }

    startTransition(async () => {
      let result;
      const patch = { [field]: payload };
      if (recordType === "opportunity") {
        result = await updateOpportunity(recordId, patch);
      } else if (recordType === "contact") {
        result = await updateContact(recordId, patch);
      } else if (recordType === "household") {
        result = await updateHousehold(recordId, patch);
      } else {
        setError("Unknown record type");
        return;
      }
      if (!result.ok) {
        setError(result.error ?? "Save failed.");
        return;
      }
      setEditing(false);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save(draft.trim() === "" ? (allowClear ? null : draft) : draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(value == null ? "" : String(value));
      setError(null);
    }
    if (e.key === "Enter" && fieldType !== "textarea" && !e.shiftKey) {
      e.preventDefault();
      save(draft.trim() === "" ? (allowClear ? null : draft) : draft);
    }
  }

  if (!editing) {
    return (
      <div className={`group ${className}`}>
        {label && (
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left w-full mt-0.5 group/btn"
        >
          <span
            className={`text-sm font-medium ${isEmpty ? "text-slate-400 italic" : "text-slate-900"} group-hover/btn:bg-yellow-50 px-1 -mx-1 rounded transition-colors`}
          >
            {display}
          </span>
          <span className="ml-2 text-[10px] text-slate-400 opacity-0 group-hover/btn:opacity-100 transition-opacity">
            edit
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        {fieldType === "select" && options ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 bg-white border border-[#00929C] rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30"
          >
            {allowClear && <option value="">— None —</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : fieldType === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder={placeholder}
            className="flex-1 px-2 py-1 bg-white border border-[#00929C] rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-y"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={fieldType === "date" ? "date" : "text"}
            inputMode={fieldType === "currency" || fieldType === "number" ? "decimal" : "text"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-2 py-1 bg-white border border-[#00929C] rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30"
          />
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-2 py-1 rounded bg-[#00929C] hover:bg-[#007a82] disabled:bg-slate-300 text-white text-[11px] font-semibold"
        >
          {pending ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(value == null ? "" : String(value));
            setError(null);
          }}
          disabled={pending}
          className="px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-900"
        >
          Esc
        </button>
      </form>
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  );
}
