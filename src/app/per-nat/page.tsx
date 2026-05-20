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

interface LineItemMaybe {
  product_name?: string;
  color?: string;
  skirt?: string;
  inventory_unit_id?: string;
}

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

  // ── Query contracts ─────────────────────────────────────────────────────
  let query = supabase
    .from("contracts")
    .select(`
      id,
      contract_number,
      status,
      is_per_nat,
      per_nat_reason,
      delivery_timeframe,
      total,
      deposit_paid,
      balance_due,
      created_at,
      notes,
      external_notes,
      line_items,
      financing,
      customer:customers ( id, first_name, last_name, phone ),
      sales_rep:profiles!contracts_sales_rep_id_fkey ( id, full_name ),
      location:locations ( id, name )
    `)
    .order("delivery_timeframe", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (status === "active") {
    query = query.eq("is_per_nat", true).not("status", "in", "(delivered,cancelled)");
  } else if (status === "completed") {
    query = query.eq("status", "delivered").or("is_per_nat.eq.true,delivery_timeframe.not.is.null");
  } else {
    query = query.eq("status", "cancelled").eq("is_per_nat", true);
  }

  if (salespersonId) {
    query = query.eq("sales_rep_id", salespersonId);
  }

  const { data: contracts } = await query;

  // ── Fetch open inventory_unit assignments ───────────────────────────────
  const contractIds = (contracts ?? []).map((c) => c.id);
  const unitsByContract = new Map<string, {
    inventory_unit_id: string;
    serial_number: string | null;
    model: string | null;
    stock_assigned_at: string | null;
  }>();

  if (contractIds.length > 0) {
    const { data: units } = await supabase
      .from("inventory_units")
      .select(`id, serial_number, contract_id, stock_assigned_at, product:products ( name )`)
      .in("contract_id", contractIds);
    for (const u of units ?? []) {
      if (!u.contract_id) continue;
      const productAny = u.product as { name?: string } | { name?: string }[] | null | undefined;
      const productName: string | null = Array.isArray(productAny)
        ? (productAny[0]?.name ?? null)
        : (productAny?.name ?? null);
      unitsByContract.set(u.contract_id, {
        inventory_unit_id: u.id,
        serial_number: u.serial_number ?? null,
        model: productName,
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

  // ── Group rows by target month ──────────────────────────────────────────
  type Row = {
    contract_id: string;
    contract_number: string;
    customer_name: string;
    sales_rep_name: string;
    model: string | null;
    color: string | null;
    skirt: string | null;
    timeframe_raw: string | null;
    notes: string | null;
    external_notes: string | null;
    created_at: string;
    is_low_deposit: boolean;
    has_stock_unit: boolean;
    serial_number: string | null;
    days_held: number | null;
    per_nat_reason: string | null;
    bucket_key: string;
    bucket_label: string;
    bucket_sort: number;
    total: number;
    deposit_paid: number;
    balance_due: number;
  };

  const rows: Row[] = (contracts ?? []).map((c) => {
    const firstLine: LineItemMaybe = Array.isArray(c.line_items) && c.line_items.length > 0
      ? (c.line_items[0] as LineItemMaybe)
      : {};
    const unit = unitsByContract.get(c.id) ?? null;
    const bucket = parseDeliveryTimeframeToBucket(c.delivery_timeframe);
    const customerArr = c.customer as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null | undefined;
    const customer = Array.isArray(customerArr) ? customerArr[0] : customerArr;
    const salesArr = c.sales_rep as { full_name?: string } | { full_name?: string }[] | null | undefined;
    const salesRep = Array.isArray(salesArr) ? salesArr[0] : salesArr;
    return {
      contract_id: c.id,
      contract_number: c.contract_number,
      customer_name: customer
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
        : "—",
      sales_rep_name: salesRep?.full_name ?? "—",
      model: firstLine.product_name ?? unit?.model ?? null,
      color: firstLine.color ?? null,
      skirt: firstLine.skirt ?? null,
      timeframe_raw: c.delivery_timeframe ?? null,
      notes: c.notes ?? null,
      external_notes: c.external_notes ?? null,
      created_at: c.created_at,
      is_low_deposit: c.per_nat_reason === "low_deposit",
      has_stock_unit: !!unit,
      serial_number: unit?.serial_number ?? null,
      days_held: daysHeld(unit?.stock_assigned_at ?? null),
      per_nat_reason: c.per_nat_reason ?? null,
      bucket_key: bucket.key,
      bucket_label: bucket.label,
      bucket_sort: bucket.sortKey,
      total: Number(c.total ?? 0),
      deposit_paid: Number(c.deposit_paid ?? 0),
      balance_due: Number(c.balance_due ?? 0),
    };
  });

  // Group by bucket
  const buckets = new Map<string, { label: string; sort: number; rows: Row[] }>();
  for (const r of rows) {
    const b = buckets.get(r.bucket_key) ?? { label: r.bucket_label, sort: r.bucket_sort, rows: [] };
    b.rows.push(r);
    buckets.set(r.bucket_key, b);
  }
  const sortedBuckets = [...buckets.values()].sort((a, b) => a.sort - b.sort);

  // ── Tab links ───────────────────────────────────────────────────────────
  const tabHref = (s: Status) => {
    const next = new URLSearchParams();
    next.set("status", s);
    if (salespersonId) next.set("salesperson_id", salespersonId);
    return `/per-nat?${next.toString()}`;
  };

  // ── Status tab counts ───────────────────────────────────────────────────
  // Cheap: a single count() head query per tab.
  const [activeCount, completedCount, cancelledCount] = await Promise.all([
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("is_per_nat", true)
      .not("status", "in", "(delivered,cancelled)"),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered")
      .or("is_per_nat.eq.true,delivery_timeframe.not.is.null"),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .eq("is_per_nat", true),
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
        subtitle={`${rows.length} ${rows.length === 1 ? "contract" : "contracts"}`}
      />

      <main className="pb-28 max-w-7xl mx-auto w-full px-4">
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
        </div>

        {sortedBuckets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            No Per Nat contracts in this view.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedBuckets.map((b) => (
              <section key={b.label}>
                {/* Month divider — matches the XLSX blue divider rows */}
                <div className="bg-[#010F21] text-white px-4 py-2 rounded-t-lg font-semibold text-sm tracking-wide">
                  {b.label}
                  <span className="ml-2 text-white/70 font-normal">
                    · {b.rows.length} {b.rows.length === 1 ? "contract" : "contracts"}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-b-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Sale date</th>
                        <th className="text-left px-3 py-2 font-semibold">Timeframe</th>
                        <th className="text-left px-3 py-2 font-semibold">Customer</th>
                        <th className="text-left px-3 py-2 font-semibold">Serial / Order #</th>
                        <th className="text-left px-3 py-2 font-semibold">Model</th>
                        <th className="text-left px-3 py-2 font-semibold">Color</th>
                        <th className="text-left px-3 py-2 font-semibold">Skirt</th>
                        <th className="text-left px-3 py-2 font-semibold">Salesperson</th>
                        <th className="text-left px-3 py-2 font-semibold">Notes</th>
                        <th className="text-right px-3 py-2 font-semibold">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r) => (
                        <PerNatRow key={r.contract_id} row={r} />
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
    contract_id: string;
    customer_name: string;
    sales_rep_name: string;
    model: string | null;
    color: string | null;
    skirt: string | null;
    timeframe_raw: string | null;
    notes: string | null;
    created_at: string;
    is_low_deposit: boolean;
    has_stock_unit: boolean;
    serial_number: string | null;
    days_held: number | null;
    balance_due: number;
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
    <tr className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.created_at)}</td>
      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{row.timeframe_raw ?? "—"}</td>
      <td className={cn("px-3 py-2 font-medium", customerCellBg)}>
        <Link href={`/contracts/${row.contract_id}`} className="text-[#00929C] hover:underline">
          {row.customer_name}
        </Link>
        {row.is_low_deposit && (
          <span className="block text-[10px] font-bold uppercase tracking-wide text-orange-700 mt-0.5">
            Low deposit
          </span>
        )}
      </td>
      <td className={cn("px-3 py-2 whitespace-nowrap text-slate-700", serialCellBg)}>
        {row.serial_number ?? "—"}
        {row.has_stock_unit && row.days_held !== null && (
          <span className={cn("ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border", heldChip)}>
            {row.days_held}d
          </span>
        )}
      </td>
      <td className="px-3 py-2">{row.model ?? "—"}</td>
      <td className="px-3 py-2">{row.color ?? "—"}</td>
      <td className="px-3 py-2">{row.skirt ?? "—"}</td>
      <td className="px-3 py-2 text-slate-700">{row.sales_rep_name}</td>
      <td className="px-3 py-2 text-slate-600 text-xs max-w-[200px] truncate" title={row.notes ?? ""}>
        {row.notes ?? "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm whitespace-nowrap">
        {formatCurrency(row.balance_due)}
      </td>
    </tr>
  );
}
