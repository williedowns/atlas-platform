"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function NewLocationPage() {
  const router = useRouter();
  const supabase = createClient();

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
  });

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { error } = await supabase.from("locations").insert({
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
    });

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      router.push("/admin");
    }
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
          <h1 className="text-lg font-bold">New Location</h1>
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
                placeholder="e.g. Atlas Spas Katy"
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value as "store" | "show")}
                  className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                  required
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
                placeholder="123 Main St"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Houston"
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
                placeholder="77001"
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
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <Button type="submit" size="xl" className="w-full" loading={saving}>
            Save Location
          </Button>
        </form>
      </main>
    </div>
  );
}
