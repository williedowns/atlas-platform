export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import IntuitPaymentsTable from "@/components/bookkeeper/IntuitPaymentsTable";
import type { RolePermissions } from "@/lib/permissions";

export default async function IntuitPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    redirect("/dashboard");
  }

  // Default date range: last 30 days (Willie's choice 2026-05-20)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const initialFrom = fmt(thirtyDaysAgo);
  const initialTo = fmt(today);

  // Preload the contract → QBO invoice ID map so the client can join Salta
  // payments to QBO payments by invoice id without a second round trip.
  // Scope to contracts that have at least one QBO invoice. PostgREST caps at
  // 1000 rows; for this map we accept that scoping & paginate if it becomes
  // an issue.
  const { data: contractRows } = await supabase
    .from("contracts")
    .select("id, qbo_deposit_invoice_id, qbo_final_invoice_id")
    .or("qbo_deposit_invoice_id.not.is.null,qbo_final_invoice_id.not.is.null")
    .order("created_at", { ascending: false })
    .limit(5000);

  const invoiceIdsByContractId: Record<string, string[]> = {};
  for (const c of contractRows ?? []) {
    const ids = [c.qbo_deposit_invoice_id, c.qbo_final_invoice_id].filter(Boolean) as string[];
    if (ids.length > 0) invoiceIdsByContractId[c.id] = ids;
  }

  return (
    <AppShell
      role={profile?.role}
      userName={profile?.full_name}
      orgPerms={(profile?.organization as { role_permissions?: RolePermissions } | null)?.role_permissions ?? null}
      realRole={profile?.role}
    >
      <AppHeader
        title="Intuit Payments"
        subtitle="Every Intuit charge Salta has processed, with QBO reconciliation"
      />
      <main className="pb-28 max-w-7xl mx-auto w-full px-4">
        <IntuitPaymentsTable
          initialFrom={initialFrom}
          initialTo={initialTo}
          invoiceIdsByContractId={invoiceIdsByContractId}
        />
      </main>
    </AppShell>
  );
}
