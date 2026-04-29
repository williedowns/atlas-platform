export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContractsList } from "@/components/contracts/ContractsList";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/button";
import { getViewAsContext } from "@/lib/view-as";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const initialFilter = (params.filter as any) ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  // Pull the view-as context — for admins this may swap effectiveRole/userId.
  // For non-admins this is a no-op (helper enforces admin gate internally).
  const viewAs = await getViewAsContext();

  // Redirect logic respects the effective role so admins can preview the
  // field-crew app by impersonating it.
  const effectiveRole = viewAs.effectiveRole ?? profile?.role;
  if (effectiveRole === "field_crew") redirect("/field");

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, effectiveRole, "contracts")) redirect("/dashboard");

  // Admin/manager/bookkeeper see all rows by default — but if they're
  // impersonating a specific user, filter by that user's id.
  const isAdminEffective =
    !viewAs.isImpersonatingUser &&
    ["admin", "manager", "bookkeeper"].includes(effectiveRole ?? "");

  const filterUserId = viewAs.isImpersonatingUser
    ? viewAs.effectiveUserId
    : user.id;

  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, status, is_contingent,
      total, subtotal, discount_total, tax_amount, deposit_paid, balance_due,
      payment_method, notes, line_items, created_at,
      customer:customers(first_name, last_name, phone, email, address, city, state, zip),
      show:shows(name),
      location:locations(name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdminEffective && filterUserId) {
    query = query.eq("sales_rep_id", filterUserId);
  }

  const { data: contracts } = await query;

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
        title="Contracts"
        subtitle={contracts?.length ? `${contracts.length} ${contracts.length === 1 ? "contract" : "contracts"}` : undefined}
        actions={
          <Link href="/contracts/new">
            <Button variant="accent" size="sm" className="font-bold">
              + New
            </Button>
          </Link>
        }
      />

      <main className="pb-28 max-w-4xl mx-auto w-full">
        <ContractsList contracts={(contracts ?? []) as any[]} initialFilter={initialFilter} />
      </main>

      {/* FAB — mobile only */}
      <div className="fixed bottom-6 right-6 z-20 md:hidden">
        <Link href="/contracts/new" aria-label="New contract">
          <Button variant="accent" size="xl" className="rounded-full w-14 h-14 text-2xl shadow-xl">
            +
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
