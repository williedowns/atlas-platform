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
  is_contingent?: boolean | null;
  total: number;
  deposit_paid: number;
  balance_due: number;
  created_at: string;
  customer: { first_name: string; last_name: string } | null;
  show: { name: string } | null;
  location: { name: string } | null;
};

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  quote: "secondary",
  draft: "secondary",
  pending_signature: "warning",
  signed: "default",
  deposit_collected: "success",
  in_production: "default",
  ready_for_delivery: "warning",
  delivered: "success",
  cancelled: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  quote: "Quote",
  draft: "Draft",
  pending_signature: "Pending Sig.",
  signed: "Signed",
  deposit_collected: "Deposit Paid",
  in_production: "In Production",
  ready_for_delivery: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

type FilterType = "all" | "contracts" | "contingent" | "quote" | "deposit_collected" | "delivered";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Contracts", value: "contracts" },
  { label: "Contingent", value: "contingent" },
  { label: "Quotes", value: "quote" },
  { label: "Deposit Paid", value: "deposit_collected" },
  { label: "Delivered", value: "delivered" },
];

function isConfirmedContract(c: ContractRow): boolean {
  return !c.is_contingent && c.status !== "quote" && c.status !== "draft" && c.status !== "cancelled";
}

function isContingentContract(c: ContractRow): boolean {
  return !!c.is_contingent && c.status !== "cancelled";
}

function isQuote(c: ContractRow): boolean {
  return c.status === "quote";
}

export function ContractsList({
  contracts,
  initialFilter = "all",
}: {
  contracts: ContractRow[];
  initialFilter?: FilterType;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>(initialFilter);

  const matchesSearch = (c: ContractRow) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.contract_number.toLowerCase().includes(q) ||
      `${c.customer?.first_name} ${c.customer?.last_name}`.toLowerCase().includes(q)
    );
  };

  // For non-"all" filters, flat list
  const filtered = contracts.filter((c) => {
    if (!matchesSearch(c)) return false;
    if (filter === "contracts") return isConfirmedContract(c);
    if (filter === "contingent") return isContingentContract(c);
    if (filter === "quote") return isQuote(c);
    if (filter === "deposit_collected") return c.status === "deposit_collected";
    if (filter === "delivered") return c.status === "delivered";
    return true; // "all"
  });

  // For "all" filter, split into sections
  const confirmedList = contracts.filter((c) => matchesSearch(c) && isConfirmedContract(c));
  const contingentList = contracts.filter((c) => matchesSearch(c) && isContingentContract(c));
  const quoteList = contracts.filter((c) => matchesSearch(c) && isQuote(c));

  function ContractItem({ c }: { c: ContractRow }) {
    const href = isQuote(c) ? `/quotes/${c.id}` : `/contracts/${c.id}`;
    return (
      <li>
        <Link
          href={href}
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
            <div className="flex items-center gap-1">
              {!!c.is_contingent && (
                <Badge variant="warning" className="text-xs">Contingent</Badge>
              )}
              <Badge variant={STATUS_COLORS[c.status] ?? "secondary"}>
                {STATUS_LABELS[c.status] ?? c.status.replace(/_/g, " ")}
              </Badge>
            </div>
            {c.balance_due > 0 && (
              <p className="text-xs text-amber-600">
                Balance: {formatCurrency(c.balance_due)}
              </p>
            )}
          </div>
        </Link>
      </li>
    );
  }

  function Section({
    title,
    items,
    emptyMsg,
  }: {
    title: string;
    items: ContractRow[];
    emptyMsg: string;
  }) {
    return (
      <div>
        <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
          {title} <span className="text-slate-400 font-normal normal-case">({items.length})</span>
        </p>
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-400">{emptyMsg}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((c) => <ContractItem key={c.id} c={c} />)}
          </ul>
        )}
      </div>
    );
  }

  const showSections = filter === "all";

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

      {/* Content */}
      {showSections ? (
        <div className="divide-y divide-slate-200">
          <Section
            title="Contracts"
            items={confirmedList}
            emptyMsg="No confirmed contracts."
          />
          <Section
            title="Contingent Contracts"
            items={contingentList}
            emptyMsg="No contingent contracts."
          />
          <Section
            title="Quotes"
            items={quoteList}
            emptyMsg="No quotes."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 px-4">
          <p className="text-lg">No results found.</p>
          {search && <p className="text-sm mt-1">Try a different search.</p>}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((c) => <ContractItem key={c.id} c={c} />)}
        </ul>
      )}
    </div>
  );
}
