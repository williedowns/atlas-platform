"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function EditShowPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    venue_name: "",
    address: "",
    city: "",
    state: "TX",
    zip: "",
    start_date: "",
    end_date: "",
    qbo_deposit_account_id: "",
    qbo_deposit_account_name: "",
    qbo_department_id: "",
    qbo_department_name: "",
    qbo_deposit_income_item_id: "",
    qbo_deposit_income_item_name: "",
    qbo_deposit_liability_item_id: "",
    qbo_deposit_liability_item_name: "",
  });

  const [qboAccounts, setQboAccounts] = useState<QBOAccount[]>([]);
  const [qboLoading, setQboLoading] = useState(false);
  const [qboDepartments, setQboDepartments] = useState<QBODepartment[]>([]);
  const [qboDeptLoading, setQboDeptLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    supabase
      .from("shows")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            name: data.name ?? "",
            venue_name: data.venue_name ?? "",
            address: data.address ?? "",
            city: data.city ?? "",
            state: data.state ?? "TX",
            zip: data.zip ?? "",
            start_date: data.start_date ?? "",
            end_date: data.end_date ?? "",
            qbo_deposit_account_id: (data as any).qbo_deposit_account_id ?? "",
            qbo_deposit_account_name: (data as any).qbo_deposit_account_name ?? "",
            qbo_department_id: (data as any).qbo_department_id ?? "",
            qbo_department_name: (data as any).qbo_department_name ?? "",
            qbo_deposit_income_item_id: (data as any).qbo_deposit_income_item_id ?? "",
            qbo_deposit_income_item_name: (data as any).qbo_deposit_income_item_name ?? "",
            qbo_deposit_liability_item_id: (data as any).qbo_deposit_liability_item_id ?? "",
            qbo_deposit_liability_item_name: (data as any).qbo_deposit_liability_item_name ?? "",
          });
        }
        setLoading(false);
      });

    // Load QBO accounts
    setQboLoading(true);
    fetch("/api/qbo/accounts")
      .then((r) => r.json())
      .then((d) => { if (d.accounts) setQboAccounts(d.accounts); })
      .catch(() => {})
      .finally(() => setQboLoading(false));

    // Load QBO departments/locations
    setQboDeptLoading(true);
    fetch("/api/qbo/departments")
      .then((r) => r.json())
      .then((d) => { if (d.departments) setQboDepartments(d.departments); })
      .catch(() => {})
      .finally(() => setQboDeptLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.end_date < form.start_date) {
      setError("End date must be on or after start date.");
      return;
    }
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("shows")
      .update({
        name: form.name,
        venue_name: form.venue_name,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        start_date: form.start_date,
        end_date: form.end_date,
        qbo_deposit_account_id: form.qbo_deposit_account_id || null,
        qbo_deposit_account_name: form.qbo_deposit_account_name || null,
        qbo_department_id: form.qbo_department_id || null,
        qbo_department_name: form.qbo_department_name || null,
        qbo_deposit_income_item_id: form.qbo_deposit_income_item_id || null,
        qbo_deposit_income_item_name: form.qbo_deposit_income_item_name || null,
        qbo_deposit_liability_item_id: form.qbo_deposit_liability_item_id || null,
        qbo_deposit_liability_item_name: form.qbo_deposit_liability_item_name || null,
      } as Record<string, unknown>)
      .eq("id", params.id);

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      router.push("/shows");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/shows" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">Edit Show</h1>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Show Details */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Show Details</h2>
              <Input
                label="Show Name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
              <Input
                label="Venue Name"
                value={form.venue_name}
                onChange={(e) => set("venue_name", e.target.value)}
                required
              />
            </CardContent>
          </Card>

          {/* Venue Address */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Venue Address</h2>
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
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <Input
                label="ZIP Code"
                value={form.zip}
                onChange={(e) => set("zip", e.target.value)}
                required
              />
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Dates</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* QBO Deposit Account */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-slate-700">QuickBooks Deposit Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Payments from this expo will post to this QBO bank account</p>
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

          {/* QBO Location (Department) */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-slate-700">QuickBooks Location (Tax Allocation)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Revenue from this expo will be tagged to this QBO Location for tax and P&amp;L reporting</p>
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
                      <option key={d.id} value={d.id}>{d.fully_qualified_name}</option>
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

          {/* QBO Deposit Item IDs — income vs liability mode */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-slate-700">QuickBooks Deposit Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Salta posts deposits through one of these QBO Items based on <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">QBO_DEPOSIT_MODE</code> env var.
                  Configure both so flipping the flag requires no show changes.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Income Item ID <span className="text-slate-400 font-normal">(used when mode=income — Lori's current workflow)</span>
                </label>
                <Input
                  value={form.qbo_deposit_income_item_id}
                  onChange={(e) => set("qbo_deposit_income_item_id", e.target.value)}
                  placeholder="e.g. 42 (QBO Item ID, numeric)"
                />
                <Input
                  label="Income Item Name (for reference)"
                  value={form.qbo_deposit_income_item_name}
                  onChange={(e) => set("qbo_deposit_income_item_name", e.target.value)}
                  placeholder="e.g. Shows Sales - Hot Tub Deposit"
                />
                <p className="text-xs text-slate-500">
                  Must be a QBO Item mapped to an <strong>Income</strong> account.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-3 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Liability Item ID <span className="text-slate-400 font-normal">(used when mode=liability — accrual workflow)</span>
                </label>
                <Input
                  value={form.qbo_deposit_liability_item_id}
                  onChange={(e) => set("qbo_deposit_liability_item_id", e.target.value)}
                  placeholder="e.g. 57 (QBO Item ID, numeric)"
                />
                <Input
                  label="Liability Item Name (for reference)"
                  value={form.qbo_deposit_liability_item_name}
                  onChange={(e) => set("qbo_deposit_liability_item_name", e.target.value)}
                  placeholder="e.g. Deposit - Shows"
                />
                <p className="text-xs text-slate-500">
                  Must be a QBO Item mapped to the <strong>Customer Deposits - Shows</strong> liability account.
                </p>
              </div>

              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                💡 <strong>Where to find Item IDs:</strong> In QBO, go to Sales → Products &amp; Services, click the item,
                and copy the number from the URL (<code className="text-[11px]">…/app/item?id=<strong>42</strong></code>).
              </p>
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <Button type="submit" size="xl" className="w-full" loading={saving}>
            Save Show
          </Button>
        </form>
      </main>
    </div>
  );
}
