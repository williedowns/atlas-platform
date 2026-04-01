"use client";

import { useState, useEffect } from "react";
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

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
}

export default function NewShowPage() {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);

  const [form, setForm] = useState({
    name: "",
    location_id: "",
    venue_name: "",
    address: "",
    city: "",
    state: "TX",
    zip: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    supabase
      .from("locations")
      .select("id, name, city, state")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setLocations(data);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Auto-fill address when a location is selected
  async function handleLocationChange(locationId: string) {
    set("location_id", locationId);
    if (!locationId) return;

    const { data } = await supabase
      .from("locations")
      .select("address, city, state, zip, venue_name")
      .eq("id", locationId)
      .single();

    if (data) {
      setForm((f) => ({
        ...f,
        location_id: locationId,
        city: data.city ?? f.city,
        state: data.state ?? f.state,
        zip: (data as { zip?: string }).zip ?? f.zip,
        address: (data as { address?: string }).address ?? f.address,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.end_date < form.start_date) {
      setError("End date must be on or after start date.");
      return;
    }

    setSaving(true);
    setError("");

    const { error } = await supabase.from("shows").insert({
      name: form.name,
      location_id: form.location_id || null,
      venue_name: form.venue_name,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
      start_date: form.start_date,
      end_date: form.end_date,
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
          <h1 className="text-lg font-bold">New Show</h1>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Show Details</h2>

              <Input
                label="Show Name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Houston Home Show Spring 2026"
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Linked Location <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  value={form.location_id}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                >
                  <option value="">— None —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} · {loc.city}, {loc.state}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Venue Name"
                value={form.venue_name}
                onChange={(e) => set("venue_name", e.target.value)}
                placeholder="e.g. NRG Center"
                required
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-slate-700">Venue Address</h2>

              <Input
                label="Street Address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="1 NRG Park"
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
                placeholder="77054"
                required
              />
            </CardContent>
          </Card>

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
