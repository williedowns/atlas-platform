"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

type ContractRow = Record<string, any>;

const STATUS_LABELS: Record<string, string> = {
  pending_signature: "Awaiting Sig.",
  signed: "Signed",
  deposit_collected: "Pending Prod.",
  in_production: "In Production",
  ready_for_delivery: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending_signature: "bg-amber-100 text-amber-700",
  signed: "bg-slate-100 text-slate-600",
  deposit_collected: "bg-blue-100 text-blue-700",
  in_production: "bg-blue-100 text-blue-700",
  ready_for_delivery: "bg-amber-100 text-amber-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  ach: "ACH",
  cash: "Cash",
  financing: "Financing",
};

const PAYMENT_COLORS: Record<string, string> = {
  credit_card: "bg-purple-100 text-purple-700",
  debit_card: "bg-indigo-100 text-indigo-700",
  ach: "bg-sky-100 text-sky-700",
  cash: "bg-emerald-100 text-emerald-700",
  financing: "bg-orange-100 text-orange-700",
};

interface EventGroup {
  id: string;
  name: string;
  type: "show" | "location";
  contracts: ContractRow[];
}

function buildGroups(contracts: ContractRow[]): EventGroup[] {
  const map = new Map<string, EventGroup>();

  for (const c of contracts) {
    if (c.show?.id) {
      const key = `show-${c.show.id}`;
      if (!map.has(key)) {
        map.set(key, { id: key, name: c.show.name, type: "show", contracts: [] });
      }
      map.get(key)!.contracts.push(c);
    } else if (c.location?.id) {
      const key = `loc-${c.location.id}`;
      if (!map.has(key)) {
        map.set(key, { id: key, name: c.location.name, type: "location", contracts: [] });
      }
      map.get(key)!.contracts.push(c);
    }
  }

  // Sort groups: shows first (by recent activity), then locations
  return [...map.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === "show" ? -1 : 1;
    const latestA = Math.max(...a.contracts.map((c) => new Date(c.created_at).getTime()));
    const latestB = Math.max(...b.contracts.map((c) => new Date(c.created_at).getTime()));
    return latestB - latestA;
  });
}

function getLineItems(c: ContractRow): string[] {
  if (!Array.isArray(c.line_items)) return [];
  return c.line_items
    .filter((item: any) => !item.waived)
    .map((item: any) => item.product_name ?? item.name ?? "Unknown")
    .filter(Boolean);
}

function ContractDetail({ c }: { c: ContractRow }) {
  const items = getLineItems(c);
  const payColor = PAYMENT_COLORS[c.payment_method ?? ""] ?? "bg-slate-100 text-slate-500";
  const payLabel = PAYMENT_LABELS[c.payment_method ?? ""] ?? "—";
  const statusColor = STATUS_COLORS[c.status ?? ""] ?? "bg-slate-100 text-slate-500";
  const statusLabel = STATUS_LABELS[c.status ?? ""] ?? c.status ?? "—";

  return (
    <Link
      href={`/contracts/${c.id}`}
      className="block px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: customer + products */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">
              {c.customer?.first_name} {c.customer?.last_name}
            </p>
            {c.customer?.phone && (
              <p className="text-xs text-slate-400">{c.customer.phone}</p>
            )}
          </div>
          {items.length > 0 ? (
            <p className="text-sm text-slate-600 mt-0.5 truncate">{items.join(", ")}</p>
          ) : (
            <p className="text-sm text-slate-400 mt-0.5 italic">No products</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {c.sales_rep?.full_name && (
              <span className="text-xs text-slate-400">Rep: {c.sales_rep.full_name}</span>
            )}
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
          </div>
        </div>

        {/* Right: financials + badges */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="text-right">
            <p className="font-bold text-slate-900">{formatCurrency(c.total)}</p>
            {c.deposit_paid > 0 && (
              <p className="text-xs text-emerald-600">Dep: {formatCurrency(c.deposit_paid)}</p>
            )}
            {c.balance_due > 0 && (
              <p className="text-xs text-amber-600">Bal: {formatCurrency(c.balance_due)}</p>
            )}
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {c.payment_method && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payColor}`}>
                {payLabel}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EventGroupCard({ group }: { group: EventGroup }) {
  const [open, setOpen] = useState(true);
  const total = group.contracts.reduce((s, c) => s + (c.total ?? 0), 0);
  const deposits = group.contracts.reduce((s, c) => s + (c.deposit_paid ?? 0), 0);
  const balance = group.contracts.reduce((s, c) => s + (c.balance_due ?? 0), 0);
  const deliveredCount = group.contracts.filter((c) => c.status === "delivered").length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {group.type === "show" ? (
              <span className="bg-[#00929C]/10 text-[#00929C] text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                Event
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                Store
              </span>
            )}
            <p className="font-bold text-slate-900 truncate">{group.name}</p>
          </div>
          <svg className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform mt-0.5 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Summary stats row */}
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-slate-500">{group.contracts.length} sale{group.contracts.length !== 1 ? "s" : ""}</span>
          <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
          {deposits > 0 && <span className="text-emerald-600 text-xs">+{formatCurrency(deposits)} dep</span>}
          {balance > 0 && <span className="text-amber-600 text-xs">{formatCurrency(balance)} bal</span>}
          <span className="text-slate-400 text-xs ml-auto">{deliveredCount}/{group.contracts.length} delivered</span>
        </div>
      </button>

      {/* Contract rows */}
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {group.contracts.map((c) => (
            <ContractDetail key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesByEventList({ contracts }: { contracts: ContractRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? contracts.filter((c) => {
        const q = search.toLowerCase();
        return (
          `${c.customer?.first_name} ${c.customer?.last_name}`.toLowerCase().includes(q) ||
          (c.show?.name ?? "").toLowerCase().includes(q) ||
          (c.location?.name ?? "").toLowerCase().includes(q) ||
          (c.contract_number ?? "").toLowerCase().includes(q) ||
          (Array.isArray(c.line_items) && c.line_items.some((i: any) => (i.product_name ?? "").toLowerCase().includes(q)))
        );
      })
    : contracts;

  const groups = buildGroups(filtered);

  return (
    <div className="space-y-3">
      {/* Section title + search */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900">Sales by Location / Event</h2>
        <span className="text-xs text-slate-400">{contracts.length} total</span>
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Filter by customer, product, or event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 h-10 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
        />
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-8 text-center text-slate-400 text-sm">
          {search ? "No results for this search." : "No sales to display."}
        </div>
      ) : (
        groups.map((g) => <EventGroupCard key={g.id} group={g} />)
      )}
    </div>
  );
}
