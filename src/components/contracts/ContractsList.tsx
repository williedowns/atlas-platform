"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractRow = Record<string, any>;

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

type FilterType = "all" | "contracts" | "contingent" | "quote" | "deposit_collected" | "delivered" | "cancelled";
type DateFilter = "all" | "today" | "week" | "month";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Contracts", value: "contracts" },
  { label: "Contingent", value: "contingent" },
  { label: "Quotes", value: "quote" },
  { label: "Deposit Paid", value: "deposit_collected" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const DATE_FILTERS: { label: string; value: DateFilter }[] = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

function getDateFilterStart(df: DateFilter): Date | null {
  if (df === "all") return null;
  const now = new Date();
  if (df === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (df === "week") {
    const day = now.getDay(); // 0 = Sunday
    const diff = now.getDate() - day;
    return new Date(now.getFullYear(), now.getMonth(), diff);
  }
  if (df === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [cancelledExpanded, setCancelledExpanded] = useState(false);

  const matchesSearch = (c: ContractRow) => {
    if (!search) return true;
    const q = search.toLowerCase();
    // Strip currency symbols and punctuation for money matching
    const qMoney = q.replace(/[$,.\s]/g, "");
    // Strip non-digits for phone matching
    const qPhone = q.replace(/\D/g, "");

    const has = (val: unknown) =>
      val != null && String(val).toLowerCase().includes(q);
    const hasMoney = (val: unknown) =>
      val != null && qMoney.length > 0 && String(val).replace(/[$,.]/g, "").includes(qMoney);
    const hasPhone = (val: unknown) =>
      qPhone.length >= 3 && val != null && String(val).replace(/\D/g, "").includes(qPhone);

    return (
      has(c.contract_number) ||
      has(`${c.customer?.first_name} ${c.customer?.last_name}`) ||
      has(c.customer?.phone) ||
      hasPhone(c.customer?.phone) ||
      has(c.customer?.email) ||
      has(c.customer?.address) ||
      has(c.customer?.city) ||
      has(c.customer?.state) ||
      has(c.customer?.zip) ||
      has(c.show?.name) ||
      has(c.location?.name) ||
      has(c.notes) ||
      has(c.payment_method?.replace(/_/g, " ")) ||
      has(STATUS_LABELS[c.status] ?? c.status) ||
      hasMoney(c.total) ||
      hasMoney(c.subtotal) ||
      hasMoney(c.deposit_paid) ||
      hasMoney(c.balance_due) ||
      hasMoney(c.discount_total) ||
      // Search product names inside line items JSONB
      (Array.isArray(c.line_items) &&
        c.line_items.some((item: Record<string, unknown>) => has(item.product_name)))
    );
  };

  const dateStart = getDateFilterStart(dateFilter);
  const matchesDate = (c: ContractRow) => {
    if (!dateStart) return true;
    return c.created_at && new Date(c.created_at) >= dateStart;
  };

  // For non-"all" filters, flat list
  const filtered = contracts.filter((c) => {
    if (!matchesSearch(c)) return false;
    if (!matchesDate(c)) return false;
    if (filter === "contracts") return isConfirmedContract(c);
    if (filter === "contingent") return isContingentContract(c);
    if (filter === "quote") return isQuote(c);
    if (filter === "deposit_collected") return c.status === "deposit_collected";
    if (filter === "delivered") return c.status === "delivered";
    if (filter === "cancelled") return c.status === "cancelled";
    return true; // "all"
  });

  // For "all" filter, split into sections
  const confirmedList = contracts.filter((c) => matchesSearch(c) && matchesDate(c) && isConfirmedContract(c));
  const contingentList = contracts.filter((c) => matchesSearch(c) && matchesDate(c) && isContingentContract(c));
  const quoteList = contracts.filter((c) => matchesSearch(c) && matchesDate(c) && isQuote(c));
  const cancelledList = contracts.filter((c) => matchesSearch(c) && matchesDate(c) && c.status === "cancelled");

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
          placeholder="Search by name, phone, email, amount, product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-slate-100 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              f.value === "cancelled"
                ? filter === "cancelled"
                  ? "bg-red-500 text-white"
                  : "bg-slate-100 text-red-500"
                : filter === f.value
                  ? "bg-[#00929C] text-white"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Date quick filter chips */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-white border-b border-slate-100 scrollbar-hide">
        <span className="text-xs text-slate-400 font-medium self-center whitespace-nowrap">Date:</span>
        {DATE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setDateFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              dateFilter === f.value
                ? "bg-[#010F21] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 200-row limit warning */}
      {contracts.length >= 200 && (
        <div className="mx-4 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-700">Showing the 200 most recent contracts. Older contracts may not be visible — use search to find them.</p>
        </div>
      )}

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
          {cancelledList.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setCancelledExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide bg-red-50 border-b border-red-100 text-red-700"
              >
                <span>
                  Cancelled{" "}
                  <span className="font-normal normal-case text-red-400">({cancelledList.length})</span>
                </span>
                <svg
                  className={`w-4 h-4 text-red-400 transition-transform ${cancelledExpanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {cancelledExpanded && (
                <ul className="divide-y divide-slate-100">
                  {cancelledList.map((c) => <ContractItem key={c.id} c={c} />)}
                </ul>
              )}
            </div>
          )}
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
