export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { getViewAsContext } from "@/lib/view-as";

type CustomerJoin = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
} | null;

type ShowJoin = { name: string | null } | null;
type SalesRepJoin = { full_name: string | null } | null;

interface SiteVisitRow {
  id: string;
  contract_number: string | null;
  created_at: string | null;
  concrete_estimate_notes: string | null;
  customer: CustomerJoin;
  show: ShowJoin;
  sales_rep: SalesRepJoin;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function truncate(text: string | null, max: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + "…" : trimmed;
}

export default async function SiteVisitsPage() {
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
  if (effectiveRole === "field_crew") redirect("/field");

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as { role_permissions?: unknown } | null)?.role_permissions as
    | Parameters<typeof hasPermission>[0]
    | undefined;
  if (!hasPermission(orgPerms ?? null, effectiveRole, "contracts")) redirect("/dashboard");

  const isAdminEffective =
    !viewAs.isImpersonatingUser &&
    ["admin", "manager", "bookkeeper"].includes(effectiveRole ?? "");
  const filterUserId = viewAs.isImpersonatingUser ? viewAs.effectiveUserId : user.id;

  // Parents only — addon (child) contracts inherit nothing here; we want the
  // original sale that still needs a concrete site check.
  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, created_at, concrete_estimate_notes,
      customer:customers(first_name, last_name, phone, email),
      show:shows(name),
      sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)
    `)
    .eq("concrete_estimate_pending", true)
    .is("parent_contract_id", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (!isAdminEffective && filterUserId) {
    query = query.eq("sales_rep_id", filterUserId);
  }

  const { data: rowsRaw } = await query;
  const rows = (rowsRaw ?? []) as unknown as SiteVisitRow[];

  return (
    <AppShell
      role={effectiveRole}
      userName={profile?.full_name}
      orgPerms={orgPerms ?? null}
      realRole={profile?.role}
      viewAsUser={viewAs.viewAsUser}
      isImpersonatingRole={viewAs.isImpersonatingRole}
      isImpersonatingUser={viewAs.isImpersonatingUser}
    >
      <AppHeader
        title="Site Visits"
        subtitle={
          rows.length
            ? `${rows.length} pending ${rows.length === 1 ? "visit" : "visits"}`
            : undefined
        }
      />

      <main className="px-5 py-6 max-w-6xl mx-auto pb-24">
        <SectionCard
          title="Pending Concrete Estimates"
          subtitle="Parent contracts awaiting a site check before the concrete addon can be written."
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <EmptyState
              title="No pending site visits"
              description="Every customer who wanted a concrete estimate has already been visited."
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Show / Rep</th>
                      <th className="px-4 py-3 whitespace-nowrap">Days Pending</th>
                      <th className="px-4 py-3">Estimate Notes</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const days = daysSince(r.created_at);
                      const stale = days > 14;
                      const fullName = [r.customer?.first_name, r.customer?.last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "—";
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 align-top">
                            <Link
                              href={`/contracts/${r.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {fullName}
                            </Link>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {r.customer?.phone || ""}
                              {r.customer?.phone && r.customer?.email ? " · " : ""}
                              {r.customer?.email || ""}
                            </div>
                            {r.contract_number && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                {r.contract_number}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-slate-700">{r.show?.name || "—"}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {r.sales_rep?.full_name || "Unassigned"}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            <span
                              className={`font-bold tabular-nums ${
                                stale ? "text-red-600" : "text-slate-900"
                              }`}
                            >
                              {days}d
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top max-w-md">
                            <p className="text-xs text-slate-600 whitespace-pre-wrap">
                              {truncate(r.concrete_estimate_notes, 80) || (
                                <span className="italic text-slate-400">
                                  No notes — site check required.
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <Link
                              href={`/contracts/new?from_contract=${r.id}&type=concrete-addon`}
                              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 active:bg-amber-800 transition-colors whitespace-nowrap"
                            >
                              Create Concrete Contract
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile — same data, stacked cards */}
              <ul className="md:hidden divide-y divide-slate-100">
                {rows.map((r) => {
                  const days = daysSince(r.created_at);
                  const stale = days > 14;
                  const fullName = [r.customer?.first_name, r.customer?.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "—";
                  return (
                    <li key={r.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/contracts/${r.id}`}
                            className="font-semibold text-slate-900 hover:underline block truncate"
                          >
                            {fullName}
                          </Link>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {r.customer?.phone || ""}
                            {r.customer?.phone && r.customer?.email ? " · " : ""}
                            {r.customer?.email || ""}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {r.show?.name || "—"} · {r.sales_rep?.full_name || "Unassigned"}
                          </div>
                        </div>
                        <span
                          className={`font-bold tabular-nums text-sm flex-shrink-0 ${
                            stale ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {days}d
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">
                        {truncate(r.concrete_estimate_notes, 80) || (
                          <span className="italic text-slate-400">
                            No notes — site check required.
                          </span>
                        )}
                      </p>
                      <Link
                        href={`/contracts/new?from_contract=${r.id}&type=concrete-addon`}
                        className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 active:bg-amber-800 transition-colors w-full"
                      >
                        Create Concrete Contract
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </SectionCard>
      </main>
    </AppShell>
  );
}
