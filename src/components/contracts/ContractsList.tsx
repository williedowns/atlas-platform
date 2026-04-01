"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

type ContractRow = {
  id: string;
  contract_number: string;
  status: string;
  total: number;
  deposit_paid: number;
  balance_due: number;
  created_at: string;
  customer: { first_name: string; last_name: string } | null;
  show: { name: string } | null;
  location: { name: string } | null;
};

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  pending_signature: "warning",
  signed: "default",
  deposit_collected: "success",
  in_production: "default",
  ready_for_delivery: "warning",
  delivered: "success",
  cancelled: "destructive",
};

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Signed", value: "signed" },
  { label: "Deposit Collected", value: "deposit_collected" },
  { label: "Delivered", value: "delivered" },
];

export function ContractsList({ contracts }: { contracts: ContractRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = contracts.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.contract_number.toLowerCase().includes(q) ||
      `${c.customer?.first_name} ${c.customer?.last_name}`.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div>
      {/* Search */}
      <div className="p-4 bg-white border-b border-slate-200">
        <Input
          placeholder="Search by name or contract #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-slate-100 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.value
                ? "bg-[#00929C] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 px-4">
          <p className="text-lg">No contracts found.</p>
          {search && <p className="text-sm mt-1">Try a different search.</p>}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}`}
                className="flex items-center justify-between px-4 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {c.customer?.first_name} {c.customer?.last_name}
                  </p>
                  <p className="text-sm text-slate-500 truncate">
                    {c.contract_number} · {c.show?.name ?? c.location?.name ?? ""}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-3">
                  <p className="font-bold text-slate-900">{formatCurrency(c.total)}</p>
                  <Badge variant={STATUS_COLORS[c.status] ?? "secondary"}>
                    {c.status.replace(/_/g, " ")}
                  </Badge>
                  {c.balance_due > 0 && (
                    <p className="text-xs text-amber-600">
                      Balance: {formatCurrency(c.balance_due)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
