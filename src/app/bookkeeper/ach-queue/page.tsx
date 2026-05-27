export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { getViewAsContext } from "@/lib/view-as";
import AchQueueTable, { type AchQueueRow } from "@/components/bookkeeper/AchQueueTable";

// ACH Queue — Phase 1 of replacing Lindy's Google Sheet "ACH Atlas Log".
//
// Surfaces every office-processed pending ACH (method=ach AND status=pending
// AND ach_routing_number IS NOT NULL — exactly the rows the "Save for Office
// Processing" fallback creates from Step 8 / CollectPaymentForm). Lindy marks
// each one ran from this page; admins / managers can do the same.
//
// Sales reps land here too but see only ACHs tied to contracts they wrote —
// it's read-only for them (no "Mark as Ran" button).

const OFFICE_ROLES = ["admin", "manager", "bookkeeper"];
const ALL_ALLOWED_ROLES = [...OFFICE_ROLES, "sales_rep"];

export default async function AchQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const viewAs = await getViewAsContext();
  const effectiveRole = viewAs.effectiveRole ?? profile?.role ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgPerms = (profile?.organization as any)?.role_permissions;

  if (!ALL_ALLOWED_ROLES.includes(effectiveRole)) {
    redirect("/dashboard");
  }

  const isOfficeRole = OFFICE_ROLES.includes(effectiveRole);
  const filterUserId = viewAs.isImpersonatingUser ? viewAs.effectiveUserId : user.id;

  // ── For sales reps, narrow the query to contracts they wrote ─────────────
  // Done in two passes since Supabase nested filtering on joined columns is
  // restrictive — fetch their contract ids first, then filter payments by them.
  let contractIdFilter: string[] | null = null;
  if (!isOfficeRole) {
    const { data: myContracts } = await supabase
      .from("contracts")
      .select("id")
      .eq("sales_rep_id", filterUserId);
    contractIdFilter = (myContracts ?? []).map((c) => c.id);
    if (contractIdFilter.length === 0) contractIdFilter = ["00000000-0000-0000-0000-000000000000"];
  }

  const baseSelect = `
    id, amount, method, status, created_at, processed_at,
    ach_routing_number, ach_account_number, ach_account_type, ach_account_holder_name,
    notes, processed_by,
    contract:contracts!inner(
      id, contract_number, total, deposit_paid, balance_due, created_at,
      sales_rep_id, line_items,
      customer:customers(first_name, last_name, phone, email),
      sales_rep:profiles!contracts_sales_rep_id_fkey(id, full_name)
    ),
    processor:profiles!payments_processed_by_fkey(id, full_name)
  `;

  // ── Active tab: pending office-processed ACHs ────────────────────────────
  let activeQuery = supabase
    .from("payments")
    .select(baseSelect)
    .eq("method", "ach")
    .eq("status", "pending")
    .not("ach_routing_number", "is", null)
    .order("created_at", { ascending: true }); // oldest first — Lindy works oldest down
  if (contractIdFilter) activeQuery = activeQuery.in("contract_id", contractIdFilter);
  const { data: activeRows } = await activeQuery;

  // ── Completed tab: last 30 days of marked-ran rows ───────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let completedQuery = supabase
    .from("payments")
    .select(baseSelect)
    .eq("method", "ach")
    .eq("status", "completed")
    .not("ach_routing_number", "is", null)
    .gte("processed_at", thirtyDaysAgo)
    .order("processed_at", { ascending: false });
  if (contractIdFilter) completedQuery = completedQuery.in("contract_id", contractIdFilter);
  const { data: completedRows } = await completedQuery;

  const toRow = (p: unknown): AchQueueRow => {
    const r = p as Record<string, unknown>;
    const contract = (Array.isArray(r.contract) ? r.contract[0] : r.contract) as Record<string, unknown> | null;
    const customer = (contract?.customer && (Array.isArray(contract.customer) ? contract.customer[0] : contract.customer)) as Record<string, unknown> | null;
    const salesRep = (contract?.sales_rep && (Array.isArray(contract.sales_rep) ? contract.sales_rep[0] : contract.sales_rep)) as Record<string, unknown> | null;
    const processor = (r.processor && (Array.isArray(r.processor) ? r.processor[0] : r.processor)) as Record<string, unknown> | null;
    const lineItems = (Array.isArray(contract?.line_items) ? contract.line_items : []) as { product_name?: string; quantity?: number }[];
    const productSummary = lineItems.length
      ? lineItems.map((li) => `${li.product_name ?? "Item"}${li.quantity && li.quantity > 1 ? ` (${li.quantity})` : ""}`).join(", ")
      : "—";
    return {
      payment_id: String(r.id),
      contract_id: String(contract?.id ?? ""),
      contract_number: String(contract?.contract_number ?? ""),
      amount: Number(r.amount ?? 0),
      customer_name: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "—",
      customer_phone: (customer?.phone ?? null) as string | null,
      sales_rep_name: (salesRep?.full_name ?? null) as string | null,
      sale_date: String(contract?.created_at ?? r.created_at ?? ""),
      product_summary: productSummary,
      routing_number: (r.ach_routing_number ?? null) as string | null,
      account_number: (r.ach_account_number ?? null) as string | null,
      account_type: (r.ach_account_type ?? null) as string | null,
      account_holder_name: (r.ach_account_holder_name ?? null) as string | null,
      notes: (r.notes ?? null) as string | null,
      processed_at: (r.processed_at ?? null) as string | null,
      processed_by_name: (processor?.full_name ?? null) as string | null,
    };
  };

  const activeList: AchQueueRow[] = (activeRows ?? []).map(toRow);
  const completedList: AchQueueRow[] = (completedRows ?? []).map(toRow);

  return (
    <AppShell
      role={effectiveRole}
      userName={profile?.full_name}
      orgPerms={orgPerms}
      realRole={profile?.role}
      viewAsUser={viewAs.viewAsUser}
      isImpersonatingRole={viewAs.isImpersonatingRole}
      isImpersonatingUser={viewAs.isImpersonatingUser}
    >
      <AppHeader
        title="ACH Queue"
        subtitle={
          isOfficeRole
            ? `${activeList.length} pending · ${completedList.length} completed in last 30 days`
            : `${activeList.length} of your contracts have an ACH waiting on the office`
        }
        backHref="/bookkeeper"
      />
      <main className="px-4 py-5 max-w-5xl mx-auto pb-24">
        <AchQueueTable
          active={activeList}
          completed={completedList}
          canMarkRan={isOfficeRole}
        />
      </main>
    </AppShell>
  );
}
