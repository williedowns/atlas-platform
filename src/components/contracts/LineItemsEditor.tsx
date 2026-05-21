"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import type { ContractLineItem } from "@/types";

interface LineItemsEditorProps {
  contractId: string;
  lineItems: ContractLineItem[];
  canEdit: boolean;
}

interface DraftItem {
  product_id: string;
  product_name: string;
  sell_price: number;
  quantity: number;
  shell_color: string;
  cabinet_color: string;
  msrp: number;
  inventory_unit_id?: string;
  serial_number?: string;
  unit_type?: ContractLineItem["unit_type"];
  line?: string;
  model_code?: string;
  waived?: boolean;
  linked_spa_product_id?: string;
}

function toDraft(item: ContractLineItem): DraftItem {
  return {
    product_id: item.product_id,
    product_name: item.product_name,
    sell_price: Number(item.sell_price ?? 0),
    quantity: Number(item.quantity ?? 1),
    shell_color: item.shell_color ?? "",
    cabinet_color: item.cabinet_color ?? "",
    msrp: Number(item.msrp ?? 0),
    inventory_unit_id: item.inventory_unit_id,
    serial_number: item.serial_number,
    unit_type: item.unit_type,
    line: item.line,
    model_code: item.model_code,
    waived: item.waived,
    linked_spa_product_id: item.linked_spa_product_id,
  };
}

function fromDraft(d: DraftItem): ContractLineItem {
  const out: ContractLineItem = {
    product_id: d.product_id,
    product_name: d.product_name,
    sell_price: d.sell_price,
    quantity: d.quantity,
    msrp: d.msrp,
  };
  if (d.shell_color.trim()) out.shell_color = d.shell_color.trim();
  if (d.cabinet_color.trim()) out.cabinet_color = d.cabinet_color.trim();
  if (d.inventory_unit_id) out.inventory_unit_id = d.inventory_unit_id;
  if (d.serial_number) out.serial_number = d.serial_number;
  if (d.unit_type) out.unit_type = d.unit_type;
  if (d.line) out.line = d.line;
  if (d.model_code) out.model_code = d.model_code;
  if (d.waived) out.waived = d.waived;
  if (d.linked_spa_product_id) out.linked_spa_product_id = d.linked_spa_product_id;
  return out;
}

export default function LineItemsEditor({
  contractId,
  lineItems,
  canEdit,
}: LineItemsEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[]>(() => lineItems.map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newPid, setNewPid] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQty, setNewQty] = useState("1");

  if (!canEdit) return null;

  function startEdit() {
    setDrafts(lineItems.map(toDraft));
    setError(null);
    setShowAddForm(false);
    setEditing(true);
  }

  function cancel() {
    setDrafts(lineItems.map(toDraft));
    setShowAddForm(false);
    setNewPid("");
    setNewName("");
    setNewPrice("");
    setNewQty("1");
    setError(null);
    setEditing(false);
  }

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setDrafts((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeAt(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function addNewLine() {
    setError(null);
    const pid = newPid.trim();
    const name = newName.trim();
    const price = Number(newPrice);
    const qty = Number(newQty);
    if (!pid) return setError("Product ID is required.");
    if (!name) return setError("Product name is required.");
    if (!Number.isFinite(price) || price < 0) return setError("Sell price must be a number >= 0.");
    if (!Number.isFinite(qty) || qty < 1) return setError("Quantity must be at least 1.");
    setDrafts((prev) => [
      ...prev,
      {
        product_id: pid,
        product_name: name,
        sell_price: price,
        quantity: qty,
        shell_color: "",
        cabinet_color: "",
        msrp: 0,
      },
    ]);
    setNewPid("");
    setNewName("");
    setNewPrice("");
    setNewQty("1");
    setShowAddForm(false);
  }

  function save() {
    setError(null);
    if (drafts.length === 0) {
      setError("A contract needs at least one line item.");
      return;
    }
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.product_id.trim()) {
        setError(`Row ${i + 1}: product ID is required.`);
        return;
      }
      if (!d.product_name.trim()) {
        setError(`Row ${i + 1}: product name is required.`);
        return;
      }
      if (!Number.isFinite(d.sell_price) || d.sell_price < 0) {
        setError(`Row ${i + 1}: sell price must be a number >= 0.`);
        return;
      }
      if (!Number.isFinite(d.quantity) || d.quantity < 1) {
        setError(`Row ${i + 1}: quantity must be at least 1.`);
        return;
      }
    }
    const payload = { line_items: drafts.map(fromDraft) };
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/line-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          <p className="text-sm font-bold text-slate-900">Edit Products (Admin)</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Changing items archives the signed PDF (regenerated on next view) and flags this
            contract for QBO resync.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            Edit Products
          </button>
        )}
      </div>

      {editing && (
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <p className="text-xs italic text-slate-400">No line items — add one below.</p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((d, i) => (
                <li
                  key={`${d.product_id}-${i}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#010F21] truncate">
                        {d.product_name || <span className="italic text-slate-400">(unnamed)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{d.product_id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      disabled={saving}
                      className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 touch-manipulation"
                      aria-label={`Remove ${d.product_name}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600">Qty</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={d.quantity}
                        onChange={(e) =>
                          updateDraft(i, { quantity: Number(e.target.value) })
                        }
                        className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600">Sell price</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.sell_price}
                        onChange={(e) =>
                          updateDraft(i, { sell_price: Number(e.target.value) })
                        }
                        className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600">Shell color</span>
                      <input
                        type="text"
                        value={d.shell_color}
                        onChange={(e) => updateDraft(i, { shell_color: e.target.value })}
                        className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600">Cabinet color</span>
                      <input
                        type="text"
                        value={d.cabinet_color}
                        onChange={(e) => updateDraft(i, { cabinet_color: e.target.value })}
                        className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Line total: {formatCurrency(d.sell_price * d.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {!showAddForm ? (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setError(null);
              }}
              disabled={saving}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-[#00929C] border border-dashed border-[#00929C]/40 hover:bg-[#00929C]/5 touch-manipulation"
            >
              + Add product
            </button>
          ) : (
            <div className="rounded-xl border border-[#00929C]/40 bg-[#00929C]/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-[#010F21]">New line item</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block col-span-2">
                  <span className="text-[11px] font-semibold text-slate-600">Product ID</span>
                  <input
                    type="text"
                    value={newPid}
                    onChange={(e) => setNewPid(e.target.value)}
                    placeholder="e.g. MS-LSX-880"
                    className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40 font-mono"
                  />
                </label>
                <label className="block col-span-2">
                  <span className="text-[11px] font-semibold text-slate-600">Product name</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. LSX 880"
                    className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-600">Sell price</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-600">Qty</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addNewLine}
                  disabled={saving}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[#00929C] text-white hover:bg-[#007a82] touch-manipulation"
                >
                  Add to list
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPid("");
                    setNewName("");
                    setNewPrice("");
                    setNewQty("1");
                  }}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
              {saving ? "Saving…" : "Save changes"}
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
