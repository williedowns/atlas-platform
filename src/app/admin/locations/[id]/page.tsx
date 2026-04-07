"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type QBOAccount = { id: string; name: string; account_type: string; account_number?: string };
type QBODepartment = { id: string; name: string; fully_qualified_name: string };

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function EditLocationPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    type: "store" as "store" | "show",
    address: "",
    city: "",
    state: "TX",
    zip: "",
    phone: "",
    cc_surcharge_enabled: false,
    cc_surcharge_rate: 3.5,
    floor_price_enabled: true,
    active: true,
    qbo_deposit_account_id: "",
    qbo_deposit_account_name: "",
    qbo_department_id: "",
    qbo_department_name: "",
  });
  const [qboAccounts, setQboAccounts] = useState<QBOAccount[]>([]);
  const [qboLoading, setQboLoading] = useState(false);
  const [qboDepartments, setQboDepartments] = useState<QBODepartment[]>([]);
  const [qboDeptLoading, setQboDeptLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    supabase
      .from("locations")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError("Location not found.");
        } else {
          setForm({
            name: data.name,
            type: data.type,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            phone: data.phone ?? "",
            cc_surcharge_enabled: data.cc_surcharge_enabled,
            cc_surcharge_rate: Math.round(data.cc_surcharge_rate * 100 * 10) / 10,
            floor_price_enabled: data.floor_price_enabled,
            active: data.active,
            qbo_deposit_account_id: data.qbo_deposit_account_id ?? "",
            qbo_deposit_account_name: data.qbo_deposit_account_name ?? "",
            qbo_department_id: data.qbo_department_id ?? "",
            qbo_department_name: data.qbo_department_name ?? "",
          });
        }
        setLoading(false);

        // Load QBO accounts (non-blocking)
        setQboLoading(true);
        fetch("/api/qbo/accounts")
          .then((r) => r.json())
          .then((d) => { if (d.accounts) setQboAccounts(d.accounts); })
          .catch(() => {})
          .finally(() => setQboLoading(false));

        // Load QBO departments/locations (non-blocking)
        setQboDeptLoading(true);
        fetch("/api/qbo/departments")
          .then((r) => r.json())
          .then((d) => { if (d.departments) setQboDepartments(d.departments); })
          .catch(() => {})
          .finally(() => setQboDeptLoading(false));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/admin/locations/${params.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Delete failed. Try again.");
      setDeleting(false);
      setConfirmDelete(false);
    } else {
      router.push("/admin");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("locations")
      .update({
        name: form.name,
        type: form.type,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone || null,
        cc_surcharge_enabled: form.cc_surcharge_enabled,
        cc_surcharge_rate: form.cc_surcharge_rate / 100,
        floor_price_enabled: form.floor_price_enabled,
        active: form.active,
        qbo_deposit_account_id: form.qbo_deposit_account_id || null,
        qbo_deposit_account_name: form.qbo_deposit_account_name || null,
        qbo_department_id: form.qbo_department_id || null,
        qbo_department_name: form.qbo_department_name || null,
      })
      .eq("id", params.id);

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      router.push("/admin");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">Edit Location</h1>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Location Details</h2>

              <Input
                label="Location Name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value as "store" | "show")}
                  className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                >
                  <option value="store">Store</option>
                  <option value="show">Show Venue</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Address</h2>

              <Input
                label="Street Address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">State</label>
                  <select
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                  >
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                label="ZIP Code"
                value={form.zip}
                onChange={(e) => set("zip", e.target.value)}
                required
              />

              <Input
                label="Phone (optional)"
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(555) 555-5555"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Settings</h2>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-900">Credit Card Surcharge</p>
                  <p className="text-xs text-slate-500">Add surcharge to CC payments</p>
                </div>
                <button
                  type="button"
                  onClick={() => set("cc_surcharge_enabled", !form.cc_surcharge_enabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    form.cc_surcharge_enabled ? "bg-[#00929C]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      form.cc_surcharge_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {form.cc_surcharge_enabled && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Surcharge Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={form.cc_surcharge_rate}
                    onChange={(e) => set("cc_surcharge_rate", parseFloat(e.target.value))}
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                  />
                </div>
              )}

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-900">Floor Price Enforcement</p>
                  <p className="text-xs text-slate-500">Block discounts below floor price</p>
                </div>
                <button
                  type="button"
                  onClick={() => set("floor_price_enabled", !form.floor_price_enabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    form.floor_price_enabled ? "bg-[#00929C]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      form.floor_price_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-900">Active</p>
                  <p className="text-xs text-slate-500">Show in location selectors</p>
                </div>
                <button
                  type="button"
                  onClick={() => set("active", !form.active)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    form.active ? "bg-[#00929C]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      form.active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* QuickBooks Account Mapping */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-slate-700">QuickBooks Deposit Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Payments from this location will post to this QBO bank account</p>
              </div>

              {qboLoading ? (
                <p className="text-sm text-slate-400">Loading QBO accounts…</p>
              ) : qboAccounts.length === 0 ? (
                <p className="text-sm text-slate-400">
                  QuickBooks not connected, or no bank accounts found.{" "}
                  <Link href="/admin" className="text-[#00929C] underline">Connect QBO</Link>
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Deposit Account</label>
                  <select
                    value={form.qbo_deposit_account_id}
                    onChange={(e) => {
                      const selected = qboAccounts.find((a) => a.id === e.target.value);
                      set("qbo_deposit_account_id", e.target.value);
                      set("qbo_deposit_account_name", selected?.name ?? "");
                    }}
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                  >
                    <option value="">— Use default account —</option>
                    {qboAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_number ? `${a.account_number} ` : ""}{a.name}
                      </option>
                    ))}
                  </select>
                  {form.qbo_deposit_account_id && (
                    <p className="text-xs text-emerald-600">
                      ✓ Payments will post to: <strong>{form.qbo_deposit_account_name}</strong>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* QuickBooks Location (Department) Mapping */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-slate-700">QuickBooks Location (Tax Allocation)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Revenue from this location will be tagged to this QBO Location for tax and P&amp;L reporting</p>
              </div>

              {qboDeptLoading ? (
                <p className="text-sm text-slate-400">Loading QBO locations…</p>
              ) : qboDepartments.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No QBO Locations found. Set up Locations in QuickBooks under Company Settings → Advanced → Locations.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">QBO Location</label>
                  <select
                    value={form.qbo_department_id}
                    onChange={(e) => {
                      const selected = qboDepartments.find((d) => d.id === e.target.value);
                      set("qbo_department_id", e.target.value);
                      set("qbo_department_name", selected?.fully_qualified_name ?? selected?.name ?? "");
                    }}
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                  >
                    <option value="">— No location tag —</option>
                    {qboDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fully_qualified_name}
                      </option>
                    ))}
                  </select>
                  {form.qbo_department_id && (
                    <p className="text-xs text-emerald-600">
                      ✓ Transactions tagged to: <strong>{form.qbo_department_name}</strong>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <Button type="submit" size="xl" className="w-full" loading={saving}>
            Save Changes
          </Button>

          {/* Delete */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full py-3 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              Delete Location
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">Delete "{form.name}"?</p>
              <p className="text-xs text-red-600">This cannot be undone. Contracts linked to this location will keep their reference but the location will be gone.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, Delete"}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
