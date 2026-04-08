"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/layout/AppShell";

interface Customer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  contract_count: number;
}

export default function AdminCustomersPage() {
  const [profile, setProfile] = useState<{ role: string; full_name: string; orgPerms: any } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("role, full_name, organization:organizations(role_permissions)")
        .eq("id", user.id)
        .single();

      if (!p || !["admin", "manager"].includes(p.role)) {
        window.location.href = "/dashboard";
        return;
      }

      setProfile({ role: p.role, full_name: p.full_name, orgPerms: (p.organization as any)?.role_permissions ?? null });

      // Fetch all customers
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone, city, state")
        .order("last_name", { ascending: true });

      if (!customerData) { setLoading(false); return; }

      // Fetch contract counts per customer
      const { data: contractCounts } = await supabase
        .from("contracts")
        .select("customer_id")
        .not("status", "in", '("draft","cancelled")');

      const countMap: Record<string, number> = {};
      for (const c of contractCounts ?? []) {
        if (c.customer_id) countMap[c.customer_id] = (countMap[c.customer_id] ?? 0) + 1;
      }

      setCustomers(customerData.map((c) => ({ ...c, contract_count: countMap[c.id] ?? 0 })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
    return name.includes(q) || (c.email ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00929C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell role={profile.role} userName={profile.full_name} orgPerms={profile.orgPerms}>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
            <p className="text-sm text-slate-500 mt-1">
              {loading ? "Loading…" : `${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="w-6 h-6 border-2 border-[#00929C] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-500 font-medium">{search ? "No customers match that search." : "No customers yet."}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/contracts?customer_id=${c.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-600">
                      {((c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "")).toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors truncate">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {c.email}
                      {(c.city || c.state) && <span> · {[c.city, c.state].filter(Boolean).join(", ")}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.contract_count > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C] text-xs font-semibold">
                      {c.contract_count} contract{c.contract_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {search && filtered.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-center">{filtered.length} of {customers.length} customers</p>
        )}
      </div>
    </AppShell>
  );
}
