"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type {
  WorkbookDeal,
  WorkbookDealOverride,
} from "@/lib/show-sales/workbook-deal";
import { NUMERIC_OVERRIDE_FIELDS } from "@/lib/show-sales/workbook-deal";

const STATUS_OPTIONS = ["OK", "Cancelled", "Low Deposit", "Contingent", "Financing Pending"] as const;
const YES_NO_OPTIONS = ["", "YES", "NO"] as const;
const DAY_OPTIONS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

function customerName(d: WorkbookDeal): string {
  const f = d.auto.customer_first_name ?? "";
  const l = d.auto.customer_last_name ?? "";
  return `${f} ${l}`.trim() || "(unnamed customer)";
}

function effectiveStatus(d: WorkbookDeal): string {
  if (d.override.status_override) return d.override.status_override;
  if (d.auto.contract_status === "cancelled") return "Cancelled";
  return "OK";
}

const STATUS_COLOR: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
  "Low Deposit": "bg-amber-100 text-amber-700",
  Contingent: "bg-indigo-100 text-indigo-700",
  "Financing Pending": "bg-sky-100 text-sky-700",
};

const NUMERIC = new Set<string>(NUMERIC_OVERRIDE_FIELDS as readonly string[]);

export default function WorkbookClient({
  showId,
  initialDeals,
  canEdit,
}: {
  showId: string;
  initialDeals: WorkbookDeal[];
  canEdit: boolean;
}) {
  const [deals, setDeals] = useState<WorkbookDeal[]>(initialDeals);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  // Per-(deal,field) debounce timers so users can keep typing without losing keystrokes
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const totals = useMemo(() => {
    let sales = 0;
    let deposits = 0;
    let financed = 0;
    for (const d of deals) {
      if (effectiveStatus(d) === "Cancelled") continue;
      sales += d.auto.sale_price;
      deposits += d.auto.deposits_total;
      financed += d.auto.financed_amount;
    }
    return { sales, deposits, financed };
  }, [deals]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const persist = useCallback(
    async (contractId: string, field: keyof WorkbookDealOverride, value: string | number | null) => {
      setSaveStates((s) => ({ ...s, [contractId]: "saving" }));
      try {
        const res = await fetch(`/api/shows/${showId}/deals/${contractId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) throw new Error(await res.text());
        setSaveStates((s) => ({ ...s, [contractId]: "saved" }));
        // Drop the "saved" indicator after a moment
        setTimeout(() => {
          setSaveStates((s) => (s[contractId] === "saved" ? { ...s, [contractId]: "idle" } : s));
        }, 1500);
      } catch (err) {
        console.error("Workbook save failed", err);
        setSaveStates((s) => ({ ...s, [contractId]: "error" }));
      }
    },
    [showId],
  );

  const updateField = (
    contractId: string,
    field: keyof WorkbookDealOverride,
    rawValue: string,
  ) => {
    // Optimistic local update
    setDeals((prev) =>
      prev.map((d) => {
        if (d.auto.contract_id !== contractId) return d;
        const next = { ...d.override };
        let v: string | number | null = rawValue === "" ? null : rawValue;
        if (v !== null && NUMERIC.has(field as string)) {
          const n = parseFloat(rawValue);
          v = Number.isFinite(n) ? n : null;
        }
        (next as Record<string, unknown>)[field] = v;
        return { ...d, override: next };
      }),
    );

    // Debounce per-field save so typing one cost doesn't fire on every keystroke.
    const key = `${contractId}:${field}`;
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      let toSend: string | number | null = rawValue === "" ? null : rawValue;
      if (toSend !== null && NUMERIC.has(field as string)) {
        const n = parseFloat(rawValue);
        toSend = Number.isFinite(n) ? n : null;
      }
      void persist(contractId, field, toSend);
      timersRef.current.delete(key);
    }, 600);
    timersRef.current.set(key, timer);
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <Card>
        <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-[#00929C]">{formatCurrency(totals.sales)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sales (excl. cancelled)</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.deposits)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Deposits collected</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-700">{formatCurrency(totals.financed)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Financed</p>
          </div>
        </CardContent>
      </Card>

      {deals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            No contracts on this show yet. Start one from the show detail page and it&apos;ll
            appear here as an editable row.
          </CardContent>
        </Card>
      ) : (
        deals.map((d) => {
          const isOpen = expanded.has(d.auto.contract_id);
          const status = effectiveStatus(d);
          const saveState = saveStates[d.auto.contract_id] ?? "idle";
          return (
            <Card key={d.auto.contract_id}>
              <CardContent className="p-0">
                {/* Header row — always visible */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(d.auto.contract_id)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100"
                  aria-expanded={isOpen}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{customerName(d)}</p>
                      <span
                        className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${STATUS_COLOR[status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {d.override.day_of_week ?? d.auto.default_day_of_week} ·{" "}
                      {d.auto.model || "—"} · {d.auto.sales_rep_name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(d.auto.sale_price)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Dep {formatCurrency(d.auto.deposits_total)}
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    {/* Save indicator */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Contract <span className="font-mono">{d.auto.contract_number}</span>
                      </span>
                      <span
                        className={
                          saveState === "saved"
                            ? "text-emerald-600"
                            : saveState === "saving"
                              ? "text-slate-500"
                              : saveState === "error"
                                ? "text-red-600"
                                : "text-slate-400"
                        }
                      >
                        {saveState === "saving"
                          ? "Saving…"
                          : saveState === "saved"
                            ? "Saved ✓"
                            : saveState === "error"
                              ? "Save failed — retry editing"
                              : "Auto-saves on blur"}
                      </span>
                    </div>

                    {!canEdit && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        You can view this deal but only admins, managers, and bookkeepers can
                        edit the workbook.
                      </p>
                    )}

                    {/* From-contract (read-only) snapshot */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-500 select-none">
                        From contract (read-only)
                      </summary>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-slate-600">
                        <dt className="text-slate-400">Customer</dt>
                        <dd>{customerName(d)}</dd>
                        <dt className="text-slate-400">Address</dt>
                        <dd className="truncate">
                          {[d.auto.customer_address, d.auto.customer_city, d.auto.customer_state, d.auto.customer_zip]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </dd>
                        <dt className="text-slate-400">Sales rep</dt>
                        <dd>{d.auto.sales_rep_name ?? "—"}</dd>
                        <dt className="text-slate-400">Model</dt>
                        <dd>{d.auto.model || "—"}</dd>
                        <dt className="text-slate-400">Sale price</dt>
                        <dd>{formatCurrency(d.auto.sale_price)}</dd>
                        <dt className="text-slate-400">Tax rate</dt>
                        <dd>{(d.auto.sales_tax_rate * 100).toFixed(2)}%</dd>
                        <dt className="text-slate-400">Deposits</dt>
                        <dd>{formatCurrency(d.auto.deposits_total)}</dd>
                        <dt className="text-slate-400">Financed</dt>
                        <dd>{formatCurrency(d.auto.financed_amount)}</dd>
                      </dl>
                    </details>

                    {/* Editable sections */}
                    <FieldGroup label="Row status & weekday">
                      <SelectField
                        label="Status"
                        value={d.override.status_override ?? ""}
                        placeholder={d.auto.contract_status === "cancelled" ? "Cancelled" : "OK"}
                        options={["", ...STATUS_OPTIONS]}
                        disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "status_override", v)}
                      />
                      <SelectField
                        label="Day"
                        value={d.override.day_of_week ?? ""}
                        placeholder={d.auto.default_day_of_week}
                        options={DAY_OPTIONS}
                        disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "day_of_week", v)}
                      />
                    </FieldGroup>

                    <FieldGroup label="Multi-rep splits">
                      <TextField label="Salesman 2" value={d.override.salesman_2 ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "salesman_2", v)} />
                      <TextField label="Salesman 3" value={d.override.salesman_3 ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "salesman_3", v)} />
                      <TextField label="Salesman 4" value={d.override.salesman_4 ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "salesman_4", v)} />
                    </FieldGroup>

                    <FieldGroup label="Spa identification">
                      <TextField label="Color" value={d.override.color ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "color", v)} />
                      <NumberField label="Color cost" value={d.override.color_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "color_cost", v)} />
                      <TextField label="Cabinet" value={d.override.cabinet ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "cabinet", v)} />
                      <NumberField label="Cabinet cost" value={d.override.cabinet_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "cabinet_cost", v)} />
                      <TextField label="Serial number" value={d.override.serial_number ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "serial_number", v)} />
                    </FieldGroup>

                    <FieldGroup label="Options & add-ons">
                      <SelectField label="MasterPur" value={d.override.masterpur ?? ""} disabled={!canEdit}
                        options={YES_NO_OPTIONS}
                        onChange={(v) => updateField(d.auto.contract_id, "masterpur", v)} />
                      <NumberField label="MasterPur cost" value={d.override.masterpur_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "masterpur_cost", v)} />
                      <SelectField label="Floor system" value={d.override.floor_system ?? ""} disabled={!canEdit}
                        options={YES_NO_OPTIONS}
                        onChange={(v) => updateField(d.auto.contract_id, "floor_system", v)} />
                      <NumberField label="Floor sys cost" value={d.override.floor_system_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "floor_system_cost", v)} />
                      <TextField label="Other option 1" value={d.override.other_options_1 ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "other_options_1", v)} />
                      <NumberField label="Other 1 cost" value={d.override.other_options_1_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "other_options_1_cost", v)} />
                      <TextField label="Other option 2" value={d.override.other_options_2 ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "other_options_2", v)} />
                      <NumberField label="Other 2 cost" value={d.override.other_options_2_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "other_options_2_cost", v)} />
                      <NumberField label="Other spa costs" value={d.override.other_spa_costs} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "other_spa_costs", v)} />
                      <SelectField label="Step" value={d.override.step ?? ""} disabled={!canEdit}
                        options={YES_NO_OPTIONS}
                        onChange={(v) => updateField(d.auto.contract_id, "step", v)} />
                    </FieldGroup>

                    <FieldGroup label="Delivery costs">
                      <NumberField label="Freight" value={d.override.freight_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "freight_cost", v)} />
                      <NumberField label="Delivery" value={d.override.delivery_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "delivery_cost", v)} />
                      <NumberField label="Crane" value={d.override.crane_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "crane_cost", v)} />
                      <NumberField label="Removal" value={d.override.removal_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "removal_cost", v)} />
                      <TextField label="Cover lift type" value={d.override.cover_lift_type ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "cover_lift_type", v)} />
                      <NumberField label="Lift count" value={d.override.cover_lift_count} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "cover_lift_count", v)} />
                    </FieldGroup>

                    <FieldGroup label="Commission & spiffs">
                      <TextField label="Override reason" value={d.override.override_reason ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "override_reason", v)} />
                      <NumberField label="Commission rate" value={d.override.commission_rate} disabled={!canEdit}
                        step={0.0001}
                        onChange={(v) => updateField(d.auto.contract_id, "commission_rate", v)} />
                      <TextField label="Spiff reason" value={d.override.spiff_reason ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "spiff_reason", v)} />
                      <NumberField label="Spiff amount" value={d.override.spiff_amount} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "spiff_amount", v)} />
                      <SelectField label="Spiff payable" value={d.override.spiff_payable ?? ""} disabled={!canEdit}
                        options={YES_NO_OPTIONS}
                        onChange={(v) => updateField(d.auto.contract_id, "spiff_payable", v)} />
                    </FieldGroup>

                    <FieldGroup label="Financing & delivery date">
                      <TextField label="Plan #" value={d.override.plan_number ?? ""} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "plan_number", v)} />
                      <NumberField label="Financing cost" value={d.override.financing_cost} disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "financing_cost", v)} />
                      <TextField label="Approx delivery" value={d.override.approx_delivery_date ?? ""}
                        disabled={!canEdit} placeholder="e.g. 6/10/26"
                        onChange={(v) => updateField(d.auto.contract_id, "approx_delivery_date", v)} />
                    </FieldGroup>

                    <FieldGroup label="Notes" cols={1}>
                      <TextAreaField label="Marketing feedback" value={d.override.marketing_feedback ?? ""}
                        disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "marketing_feedback", v)} />
                      <TextAreaField label="Comments" value={d.override.comments ?? ""}
                        disabled={!canEdit}
                        onChange={(v) => updateField(d.auto.contract_id, "comments", v)} />
                    </FieldGroup>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function FieldGroup({ label, cols = 2, children }: { label: string; cols?: 1 | 2; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <div className={cols === 1 ? "space-y-2" : "grid grid-cols-2 gap-2"}>{children}</div>
    </div>
  );
}

function TextField({
  label, value, placeholder, disabled, onChange,
}: {
  label: string; value: string; placeholder?: string; disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/50 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}

function NumberField({
  label, value, disabled, step = 0.01, onChange,
}: {
  label: string; value: number | null; disabled?: boolean; step?: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#00929C]/50 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}

function SelectField({
  label, value, options, placeholder, disabled, onChange,
}: {
  label: string; value: string; options: readonly string[]; placeholder?: string;
  disabled?: boolean; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/50 disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "" ? (placeholder ? `— ${placeholder} —` : "—") : opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label, value, disabled, onChange,
}: {
  label: string; value: string; disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/50 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
      />
    </label>
  );
}
