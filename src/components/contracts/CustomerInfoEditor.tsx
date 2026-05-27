"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CustomerInfo {
  id: string;
  first_name: string;
  last_name: string;
  co_buyer_first_name?: string | null;
  co_buyer_last_name?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface CustomerInfoEditorProps {
  contractId: string;
  customer: CustomerInfo;
  canEdit: boolean;
}

interface FormState {
  first_name: string;
  last_name: string;
  co_buyer_first_name: string;
  co_buyer_last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

function toForm(c: CustomerInfo): FormState {
  return {
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    co_buyer_first_name: c.co_buyer_first_name ?? "",
    co_buyer_last_name: c.co_buyer_last_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    zip: c.zip ?? "",
  };
}

export default function CustomerInfoEditor({
  contractId,
  customer,
  canEdit,
}: CustomerInfoEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(customer));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canEdit) return null;

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function cancel() {
    setForm(toForm(customer));
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/customer-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          co_buyer_first_name: form.co_buyer_first_name,
          co_buyer_last_name: form.co_buyer_last_name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
        }),
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
          <p className="text-sm font-bold text-[#010F21]">Customer Info</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Edits to name or address archive the signed PDF and regenerate on next view.
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
        <div className="space-y-1 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {customer.first_name} {customer.last_name}
            {(customer.co_buyer_first_name || customer.co_buyer_last_name) && (
              <span className="font-normal text-slate-500">
                {" & "}
                {[customer.co_buyer_first_name, customer.co_buyer_last_name]
                  .filter(Boolean)
                  .join(" ")}
              </span>
            )}
          </p>
          <p>{customer.email}</p>
          <p>{customer.phone}</p>
          {(customer.address || customer.city || customer.state || customer.zip) && (
            <p className="text-slate-600">
              {customer.address}
              {customer.address && (customer.city || customer.state || customer.zip) ? ", " : ""}
              {customer.city}
              {customer.city && (customer.state || customer.zip) ? ", " : ""}
              {customer.state} {customer.zip}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">First name</span>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Last name</span>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Co-buyer first name</span>
              <input
                type="text"
                value={form.co_buyer_first_name}
                onChange={(e) => update("co_buyer_first_name", e.target.value)}
                placeholder="optional"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Co-buyer last name</span>
              <input
                type="text"
                value={form.co_buyer_last_name}
                onChange={(e) => update("co_buyer_last_name", e.target.value)}
                placeholder="optional"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Address</span>
              <input
                type="text"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">City</span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">State</span>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">ZIP</span>
                <input
                  type="text"
                  value={form.zip}
                  onChange={(e) => update("zip", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                />
              </label>
            </div>
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
