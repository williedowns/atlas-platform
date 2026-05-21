export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { getViewAsContext } from "@/lib/view-as";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  parseDeliveryTimeframeToBucket,
  daysHeld,
  holdSeverity,
} from "@/lib/per-nat";
import type { RolePermissions } from "@/lib/permissions";
import SalespersonFilter from "@/components/per-nat/SalespersonFilter";

type Status = "active" | "completed" | "cancelled";

// Section header colors mirror Natalie's XLSX so the page reads as the same
// document:
//   blue   = month divider (Jan-April 2026, May 2026, ...)
//   orange = "Owner to Notifiy YYYY" (Natalie owns followup)
//   black  = "List below that William wanted to mark as stock..."
//   red    = "HOT ONES THAT WE CAN'T GET A HOLD OF..."
const SECTION_HEADER_CLS: Record<"month" | "owner_notify" | "stock_held" | "hot" | "other", string> = {
  month:        "bg-[#010F21] text-white",                // navy (matches our brand)
  owner_notify: "bg-orange-600 text-white",
  stock_held:   "bg-slate-900 text-white",                // near-black
  hot:          "bg-red-700 text-white",
  other:        "bg-slate-700 text-white",
};

export default async function PerNatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const status: Status =
    params.status === "completed" ? "completed" :
    params.status === "cancelled" ? "cancelled" : "active";
  const salespersonId: string | null = params.salesperson_id ?? null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const viewAs = await getViewAsContext();
  const effectiveRole = viewAs.effectiveRole ?? profile?.role;

  if (!["admin", "manager"].includes(effectiveRole ?? "")) {
    redirect("/dashboard");
  }

  // ── Query per_nat_entries ───────────────────────────────────────────────
  // Source of truth for the Per Nat list. Each entry optionally links to a
  // contract; XLSX-imported entries with no matching contract have
  // contract_id IS NULL but still render on the list.
  let query = supabase
    .from("per_nat_entries")
    .select(`
      id,
      contract_id,
      source,
      sale_date,
      customer_name,
      model,
      color,
      skirt,
      serial_number,
      salesperson_name,
      timeframe_text,
      notes,
      fierce_notes,
      status,
      reason,
      section_label,
      section_kind,
      section_order,
      contract:contracts (
        id,
        contract_number,
        status,
        total,
        deposit_paid,
        balance_due,
        delivery_timeframe,
        customer:customers ( first_name, last_name ),
        sales_rep:profiles!contracts_sales_rep_id_fkey ( id, full_name )
      )
    `)
    .eq("status", status)
    .order("section_order", { ascending: true, nullsFirst: false })
    .order("sale_date", { ascending: false, nullsFirst: false });

  // Salesperson filter — works on either the linked sales_rep_id or the
  // denormalized salesperson_name text. UI sends the rep's profile id.
  if (salespersonId) {
    // Two-pass: fetch contracts for that sales_rep first, then OR with
    // matching entry.salesperson_name.
    const { data: repRow } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", salespersonId)
      .maybeSingle();
    const repName = repRow?.full_name ?? null;
    if (repName) {
      query = query.or(
        `salesperson_name.ilike.%${repName}%,contract.sales_rep_id.eq.${salespersonId}`
      );
    } else {
      // Unknown rep id — fall back to id-only filter on the contract side.
      query = query.eq("contract.sales_rep_id", salespersonId);
    }
  }

  const { data: entries } = await query;

  // ── Fetch open inventory_unit assignments for linked contracts ──────────
  const contractIds = (entries ?? [])
    .map((e) => e.contract_id)
    .filter((id): id is string => !!id);

  const unitsByContract = new Map<string, {
    serial_number: string | null;
    stock_assigned_at: string | null;
  }>();

  if (contractIds.length > 0) {
    const { data: units } = await supabase
      .from("inventory_units")
      .select(`serial_number, contract_id, stock_assigned_at`)
      .in("contract_id", contractIds);
    for (const u of units ?? []) {
      if (!u.contract_id) continue;
      unitsByContract.set(u.contract_id, {
        serial_number: u.serial_number ?? null,
        stock_assigned_at: u.stock_assigned_at ?? null,
      });
    }
  }

  // ── Salesperson dropdown options ────────────────────────────────────────
  const { data: reps } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["sales_rep", "manager", "admin", "show_manager"])
    .order("full_name", { ascending: true });
  const repOptions = (reps ?? []).map((r) => ({ id: r.id, name: r.full_name ?? "—" }));

  // ── Build display rows ──────────────────────────────────────────────────
  type SectionKind = "month" | "owner_notify" | "stock_held" | "hot" | "other";
  type Row = {
    entry_id: string;
    contract_id: string | null;
    contract_number: string | null;
    customer_name: string;
    sales_rep_name: string;
    model: string | null;
    color: string | null;
    skirt: string | null;
    timeframe_raw: string | null;
    notes: string | null;
    fierce_notes: string | null;
    sale_date: string | null;
    is_low_deposit: boolean;
    has_stock_unit: boolean;
    serial_number: string | null;
    days_held: number | null;
    reason: string | null;
    section_label: string;
    section_kind: SectionKind;
    section_order: number;
    balance_due: number;
    total: number;
    deposit_paid: number;
    is_xlsx_only: boolean;
  };

  const rows: Row[] = (entries ?? []).map((e) => {
    const contractAny = e.contract as
      | { id?: string; contract_number?: string; status?: string; total?: number; deposit_paid?: number; balance_due?: number; delivery_timeframe?: string; customer?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null; sales_rep?: { id?: string; full_name?: string } | { id?: string; full_name?: string }[] | null }
      | null
      | undefined;
    const contract = Array.isArray(contractAny) ? contractAny[0] : contractAny;
    const customerJoin = contract?.customer;
    const customer = Array.isArray(customerJoin) ? customerJoin[0] : customerJoin;
    const salesJoin = contract?.sales_rep;
    const salesRep = Array.isArray(salesJoin) ? salesJoin[0] : salesJoin;
    const unit = e.contract_id ? unitsByContract.get(e.contract_id) ?? null : null;

    const customerName = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : e.customer_name;
    const timeframeText = e.timeframe_text ?? contract?.delivery_timeframe ?? null;
    const serial = unit?.serial_number ?? e.serial_number ?? null;
    const hasStock = !!serial;

    // Fall back to a parsed-month bucket only when the entry has no XLSX
    // section assigned (entries created via the Modify Contract card go this
    // path so they don't get dropped on the floor).
    let sectionLabel = e.section_label as string | null;
    let sectionKind = (e.section_kind ?? null) as SectionKind | null;
    let sectionOrder = (e.section_order ?? null) as number | null;
    if (!sectionLabel) {
      const fallback = parseDeliveryTimeframeToBucket(timeframeText || e.sale_date);
      sectionLabel = fallback.label;
      sectionKind = "month";
      sectionOrder = 9000 + fallback.sortKey; // sort after XLSX-assigned sections
    }

    return {
      entry_id: e.id,
      contract_id: e.contract_id ?? null,
      contract_number: contract?.contract_number ?? null,
      customer_name: customerName || "—",
      sales_rep_name: salesRep?.full_name ?? e.salesperson_name ?? "—",
      model: e.model ?? null,
      color: e.color ?? null,
      skirt: e.skirt ?? null,
      timeframe_raw: timeframeText,
      notes: e.notes ?? null,
      fierce_notes: e.fierce_notes ?? null,
      sale_date: e.sale_date ?? null,
      is_low_deposit: e.reason === "low_deposit",
      has_stock_unit: hasStock,
      serial_number: serial,
      days_held: daysHeld(unit?.stock_assigned_at ?? null),
      reason: e.reason ?? null,
      section_label: sectionLabel,
      section_kind: (sectionKind ?? "other") as SectionKind,
      section_order: sectionOrder ?? 99999,
      balance_due: Number(contract?.balance_due ?? 0),
      total: Number(contract?.total ?? 0),
      deposit_paid: Number(contract?.deposit_paid ?? 0),
      is_xlsx_only: !e.contract_id,
    };
  });

  // Group by section in XLSX source order
  const sections = new Map<string, { label: string; kind: SectionKind; sort: number; rows: Row[] }>();
  for (const r of rows) {
    const key = `${r.section_order}::${r.section_label}`;
    const s = sections.get(key) ?? { label: r.section_label, kind: r.section_kind, sort: r.section_order, rows: [] };
    s.rows.push(r);
    sections.set(key, s);
  }
  const sortedSections = [...sections.values()].sort((a, b) => a.sort - b.sort);

  // ── Tab links ───────────────────────────────────────────────────────────
  const tabHref = (s: Status) => {
    const next = new URLSearchParams();
    next.set("status", s);
    if (salespersonId) next.set("salesperson_id", salespersonId);
    return `/per-nat?${next.toString()}`;
  };

  // ── Status tab counts ───────────────────────────────────────────────────
  const [activeCount, completedCount, cancelledCount] = await Promise.all([
    supabase.from("per_nat_entries").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("per_nat_entries").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("per_nat_entries").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
  ]);

  return (
    <AppShell
      role={effectiveRole}
      userName={profile?.full_name}
      orgPerms={(profile?.organization as { role_permissions?: RolePermissions } | null)?.role_permissions ?? null}
      realRole={profile?.role}
      viewAsUser={viewAs.viewAsUser}
      isImpersonatingRole={viewAs.isImpersonatingRole}
      isImpersonatingUser={viewAs.isImpersonatingUser}
    >
      <AppHeader
        title="Per Nat"
        subtitle={`${rows.length} ${rows.length === 1 ? "deal" : "deals"}`}
      />

      <main className="pb-28 max-w-[1500px] mx-auto w-full px-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
          {([
            ["active", "Active", activeCount.count ?? 0],
            ["completed", "Completed", completedCount.count ?? 0],
            ["cancelled", "Cancelled", cancelledCount.count ?? 0],
          ] as const).map(([key, label, count]) => {
            const isActive = status === key;
            return (
              <Link
                key={key}
                href={tabHref(key)}
                className={cn(
                  "px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
                  isActive
                    ? "border-[#00929C] text-[#00929C]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                {label}
                <span className="ml-2 inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <SalespersonFilter options={repOptions} current={salespersonId} />
        </div>

        {/* Legend */}
        <div className="text-xs text-slate-600 mb-3 flex flex-wrap gap-3">
          <LegendChip className="bg-[#FCE5CD]" label="Low deposit (peach)" />
          <LegendChip className="bg-[#EAD1DC]" label="Stock unit assigned (pink)" />
          <LegendChip className="bg-amber-100" label="Held 60-89 days" />
          <LegendChip className="bg-red-100" label="Held 90+ days — 90-day rule violation" />
          <LegendChip className="bg-slate-100" label="XLSX-only (no Salta contract yet)" />
        </div>

        {sortedSections.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            No Per Nat deals in this view.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedSections.map((b) => (
              <section key={`${b.sort}::${b.label}`}>
                <div className={cn(
                  "px-4 py-2 rounded-t-lg font-semibold text-sm tracking-wide",
                  SECTION_HEADER_CLS[b.kind]
                )}>
                  {b.label}
                  <span className="ml-2 opacity-70 font-normal">
                    · {b.rows.length} {b.rows.length === 1 ? "deal" : "deals"}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-b-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Sale date</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Timeframe</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Customer</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Serial / Order #</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Model</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Color</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Skirt</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Salesperson</th>
                        <th className="text-left px-3 py-2 font-semibold">Notes</th>
                        <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Fierce / Delivery</th>
                        <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r) => (
                        <PerNatRow key={r.entry_id} row={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function LegendChip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block w-3 h-3 rounded-sm border border-slate-300", className)} />
      {label}
    </span>
  );
}

interface PerNatRowProps {
  row: {
    entry_id: string;
    contract_id: string | null;
    contract_number: string | null;
    customer_name: string;
    sales_rep_name: string;
    model: string | null;
    color: string | null;
    skirt: string | null;
    timeframe_raw: string | null;
    notes: string | null;
    fierce_notes: string | null;
    sale_date: string | null;
    is_low_deposit: boolean;
    has_stock_unit: boolean;
    serial_number: string | null;
    days_held: number | null;
    balance_due: number;
    is_xlsx_only: boolean;
  };
}

function PerNatRow({ row }: PerNatRowProps) {
  const severity = holdSeverity(row.days_held);
  const customerCellBg = row.is_low_deposit ? "bg-[#FCE5CD]" : "";
  const serialCellBg = row.has_stock_unit ? "bg-[#EAD1DC]" : "";
  const heldChip =
    severity === "critical"
      ? "bg-red-100 text-red-800 border-red-300"
      : severity === "warn"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <tr className={cn(
      "border-t border-slate-100 hover:bg-slate-50/60 transition-colors",
      row.is_xlsx_only && "bg-slate-50/40"
    )}>
      <td className="px-3 py-2 whitespace-nowrap">
        {row.sale_date ? formatDate(row.sale_date) : "—"}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{row.timeframe_raw ?? "—"}</td>
      <td className={cn("px-3 py-2 font-medium", customerCellBg)}>
        {row.contract_id ? (
          <Link href={`/contracts/${row.contract_id}`} className="text-[#00929C] hover:underline">
            {row.customer_name}
          </Link>
        ) : (
          <span className="text-slate-900">{row.customer_name}</span>
        )}
        {row.is_low_deposit && (
          <span className="block text-[10px] font-bold uppercase tracking-wide text-orange-700 mt-0.5">
            Low deposit
          </span>
        )}
        {row.is_xlsx_only && (
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-0.5">
            XLSX only
          </span>
        )}
      </td>
      <td className={cn("px-3 py-2 whitespace-nowrap text-slate-700 font-mono text-xs", serialCellBg)}>
        {row.serial_number ?? "—"}
        {row.has_stock_unit && row.days_held !== null && (
          <span className={cn("ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border", heldChip)}>
            {row.days_held}d
          </span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{row.model ?? "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.color ?? "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.skirt ?? "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{row.sales_rep_name}</td>
      <td className="px-3 py-2 text-slate-600 text-xs max-w-[280px]">
        <div className="line-clamp-3 whitespace-pre-wrap" title={row.notes ?? ""}>
          {row.notes ?? "—"}
        </div>
      </td>
      <td className="px-3 py-2 text-cyan-700 text-xs max-w-[180px]" title={row.fierce_notes ?? ""}>
        {row.fierce_notes ?? "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm whitespace-nowrap">
        {row.balance_due > 0 ? formatCurrency(row.balance_due) : "—"}
      </td>
    </tr>
  );
}
