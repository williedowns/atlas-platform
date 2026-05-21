"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type DiagramEntry = {
  scenario_id?: number;
  label?: string;
  fields?: Record<string, string>;
};

type DraftScenario = {
  scenario_id?: number;
  label: string;
  fieldRows: Array<{ key: string; value: string }>;
  newKey: string;
  newValue: string;
};

interface DeliveryDiagramEditorProps {
  contractId: string;
  deliveryDiagram: DiagramEntry[] | null;
  canEdit: boolean;
}

function toDraft(input: DiagramEntry[] | null): DraftScenario[] {
  const items = Array.isArray(input) ? input : [];
  return items.map((entry) => ({
    scenario_id: entry.scenario_id,
    label: entry.label ?? "",
    fieldRows: entry.fields
      ? Object.entries(entry.fields).map(([key, value]) => ({ key, value }))
      : [],
    newKey: "",
    newValue: "",
  }));
}

function draftToPayload(scenarios: DraftScenario[]): DiagramEntry[] {
  return scenarios.map((s) => {
    const entry: DiagramEntry = {};
    if (typeof s.scenario_id === "number") entry.scenario_id = s.scenario_id;
    if (s.label.trim().length > 0) entry.label = s.label;
    const fields: Record<string, string> = {};
    for (const row of s.fieldRows) {
      const trimmedKey = row.key.trim();
      if (trimmedKey.length === 0) continue;
      fields[trimmedKey] = row.value;
    }
    if (Object.keys(fields).length > 0) entry.fields = fields;
    return entry;
  });
}

export default function DeliveryDiagramEditor({
  contractId,
  deliveryDiagram,
  canEdit,
}: DeliveryDiagramEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [scenarios, setScenarios] = useState<DraftScenario[]>(() => toDraft(deliveryDiagram));
  const [newScenarioLabel, setNewScenarioLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canEdit) return null;

  const currentItems: DiagramEntry[] = Array.isArray(deliveryDiagram) ? deliveryDiagram : [];

  function updateLabel(idx: number, label: string) {
    setScenarios((prev) => prev.map((s, i) => (i === idx ? { ...s, label } : s)));
  }

  function updateFieldKey(idx: number, rowIdx: number, key: string) {
    setScenarios((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              fieldRows: s.fieldRows.map((row, r) => (r === rowIdx ? { ...row, key } : row)),
            }
          : s
      )
    );
  }

  function updateFieldValue(idx: number, rowIdx: number, value: string) {
    setScenarios((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              fieldRows: s.fieldRows.map((row, r) => (r === rowIdx ? { ...row, value } : row)),
            }
          : s
      )
    );
  }

  function removeField(idx: number, rowIdx: number) {
    setScenarios((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, fieldRows: s.fieldRows.filter((_, r) => r !== rowIdx) }
          : s
      )
    );
  }

  function updateNewKey(idx: number, key: string) {
    setScenarios((prev) => prev.map((s, i) => (i === idx ? { ...s, newKey: key } : s)));
  }

  function updateNewValue(idx: number, value: string) {
    setScenarios((prev) => prev.map((s, i) => (i === idx ? { ...s, newValue: value } : s)));
  }

  function addField(idx: number) {
    setScenarios((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const key = s.newKey.trim();
        if (key.length === 0) return s;
        return {
          ...s,
          fieldRows: [...s.fieldRows, { key, value: s.newValue }],
          newKey: "",
          newValue: "",
        };
      })
    );
  }

  function removeScenario(idx: number) {
    setScenarios((prev) => prev.filter((_, i) => i !== idx));
  }

  function addScenario() {
    const label = newScenarioLabel.trim();
    if (label.length === 0) return;
    setScenarios((prev) => [
      ...prev,
      { label, fieldRows: [], newKey: "", newValue: "" },
    ]);
    setNewScenarioLabel("");
  }

  function cancel() {
    setScenarios(toDraft(deliveryDiagram));
    setNewScenarioLabel("");
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    const payload = draftToPayload(scenarios);
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/delivery-diagram`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_diagram: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Update failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#010F21]">Delivery Diagram</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Scenarios and measurements the delivery crew uses on site.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setScenarios(toDraft(deliveryDiagram));
              setNewScenarioLabel("");
              setError(null);
              setEditing(true);
            }}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div>
          {currentItems.length === 0 ? (
            <p className="text-sm italic text-slate-400">No delivery scenarios recorded</p>
          ) : (
            <div className="space-y-3">
              {currentItems.map((entry, idx) => {
                const fieldEntries = entry.fields
                  ? Object.entries(entry.fields).filter(([, v]) => v)
                  : [];
                return (
                  <div key={`${entry.scenario_id ?? idx}`} className="space-y-1.5">
                    <p className="font-semibold text-[#010F21]">{entry.label ?? "—"}</p>
                    {fieldEntries.length > 0 ? (
                      <ul className="text-sm text-slate-600 space-y-0.5">
                        {fieldEntries.map(([k, v]) => (
                          <li key={k}>
                            <span className="capitalize text-slate-500">{k.replace(/_/g, " ")}:</span>{" "}
                            <span className="font-medium">{v}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400">No measurements recorded</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {scenarios.length === 0 ? (
            <p className="text-sm italic text-slate-400">No scenarios yet — add one below.</p>
          ) : (
            scenarios.map((s, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Scenario label
                    </label>
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) => updateLabel(idx, e.target.value)}
                      placeholder="e.g. Backyard via side gate"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeScenario(idx)}
                    className="mt-6 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5 flex-shrink-0 touch-manipulation"
                    title="Remove this scenario"
                  >
                    Remove
                  </button>
                </div>

                {s.fieldRows.length > 0 && (
                  <div className="space-y-2">
                    {s.fieldRows.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => updateFieldKey(idx, rowIdx, e.target.value)}
                          placeholder="key"
                          className="w-1/3 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                        />
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => updateFieldValue(idx, rowIdx, e.target.value)}
                          placeholder="value"
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                        />
                        <button
                          type="button"
                          onClick={() => removeField(idx, rowIdx)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg w-7 h-7 flex items-center justify-center flex-shrink-0 touch-manipulation"
                          title="Remove field"
                          aria-label="Remove field"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <input
                    type="text"
                    value={s.newKey}
                    onChange={(e) => updateNewKey(idx, e.target.value)}
                    placeholder="new field key"
                    className="w-1/3 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                  <input
                    type="text"
                    value={s.newValue}
                    onChange={(e) => updateNewValue(idx, e.target.value)}
                    placeholder="value"
                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                  <button
                    type="button"
                    onClick={() => addField(idx)}
                    disabled={s.newKey.trim().length === 0}
                    className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 touch-manipulation"
                  >
                    Add field
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="rounded-xl border border-dashed border-[#00929C]/40 bg-white p-3 flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                New scenario label
              </label>
              <input
                type="text"
                value={newScenarioLabel}
                onChange={(e) => setNewScenarioLabel(e.target.value)}
                placeholder="e.g. Front yard crane lift"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </div>
            <button
              type="button"
              onClick={addScenario}
              disabled={newScenarioLabel.trim().length === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00929C] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#007a82] flex-shrink-0 touch-manipulation"
            >
              Add scenario
            </button>
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
              disabled={saving}
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
