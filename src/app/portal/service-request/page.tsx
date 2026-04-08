"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Equipment = { id: string; product_name: string; serial_number: string | null };

export default function ServiceRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [form, setForm] = useState({
    equipment_id: searchParams.get("equipment_id") ?? "",
    description: "",
    urgency: "routine",
    contact_method: "phone",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEquipment() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("email", user.email ?? "")
        .maybeSingle();
      if (!customer) return;
      const { data } = await supabase
        .from("equipment")
        .select("id, product_name, serial_number")
        .eq("customer_id", customer.id)
        .order("product_name");
      setEquipment(data ?? []);
    }
    loadEquipment();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/portal/service-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push("/portal/dashboard?service_requested=1");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/portal/dashboard" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Request Service</h1>
            <p className="text-white/60 text-xs">Submit a service or repair request</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          {equipment.length > 0 && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Product (optional)</label>
              <select
                value={form.equipment_id}
                onChange={(e) => setForm((f) => ({ ...f, equipment_id: e.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              >
                <option value="">Select a product…</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.product_name}{eq.serial_number ? ` — S/N: ${eq.serial_number}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Describe the issue <span className="text-red-500">*</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="Please describe the problem in as much detail as possible…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Urgency</label>
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Best way to reach you</label>
              <select
                value={form.contact_method}
                onChange={(e) => setForm((f) => ({ ...f, contact_method: e.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#00929C] text-white font-semibold text-sm hover:bg-[#007a82] transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </main>
    </div>
  );
}
