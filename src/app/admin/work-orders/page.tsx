export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppShell from "@/components/layout/AppShell";
import { evaluateReadiness, type ReadinessItem } from "@/lib/readiness";
import { groupByDay } from "@/lib/work-order-grouping";

const STATUS_BADGE: Record<string, "default" | "warning" | "success" | "destructive" | "secondary"> = {
  scheduled:   "default",
  in_progress: "warning",
  completed:   "success",
  cancelled:   "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:   "Scheduled",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

function formatDay(dateStr: string | null) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function AdminWorkOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/dashboard");

  const orgPerms = (profile?.organization as any)?.role_permissions ?? null;

  // All work orders with contract + customer info
  const { data: orders } = await supabase
    .from("delivery_work_orders")
    .select(`
      id, scheduled_date, scheduled_window, status, notes, assigned_crew_ids,
      contract:contracts(
        id, contract_number, balance_due,
        customer:customers(first_name, last_name),
        location:locations(name),
        show:shows(name)
      )
    `)
    .order("scheduled_date", { ascending: true, nullsFirst: false });

  const allOrders = (orders ?? []) as any[];

  const active = allOrders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const done   = allOrders.filter((o) => o.status === "completed" || o.status === "cancelled").slice(0, 20);
  const activeByDay = groupByDay(active);

  // Contracts without a work order yet (ready for delivery or signed with balance)
  const { data: readyContracts } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, balance_due, customer_id, financing,
      needs_permit, permit_status, needs_hoa, hoa_status,
      customer:customers(first_name, last_name),
      location:locations(name),
      show:shows(name)
    `)
    .in("status", ["ready_for_delivery", "deposit_collected", "in_production"])
    .not("id", "in",
      allOrders.map((o) => o.contract?.id).filter(Boolean).length > 0
        ? `(${allOrders.map((o) => o.contract?.id).filter(Boolean).map((id: string) => `"${id}"`).join(",")})`
        : '("00000000-0000-0000-0000-000000000000")'
    )
    .order("created_at");

  const pendingRaw = (readyContracts ?? []) as any[];

  // Batch-fetch which of these customers have a DL on file, so we can compute
  // per-contract readiness without N+1 queries.
  const customerIds = pendingRaw.map((c) => c.customer_id).filter(Boolean);
  const dlPresentByCustomer = new Map<string, boolean>();
  if (customerIds.length > 0) {
    const { data: dlRows } = await supabase
      .from("customer_files")
      .select("customer_id")
      .in("customer_id", customerIds)
      .eq("category", "drivers_license");
    for (const row of dlRows ?? []) {
      dlPresentByCustomer.set(row.customer_id, true);
    }
  }

  const pending = pendingRaw.map((c) => {
    const readiness = evaluateReadiness(c, dlPresentByCustomer.get(c.customer_id) ?? false);
    return { ...c, readiness };
  });

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Work Orders</h1>
              <p className="text-white/60 text-xs">Delivery scheduling & crew assignments</p>
            </div>
          </div>
          <Badge variant="default" className="bg-white/20 text-white border-white/30">
            {active.length} active
          </Badge>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24 space-y-6">

        {/* ── Contracts needing a work order ── */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              Ready to Schedule ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map((c) => {
                const blockerCount = c.readiness.blockers.length;
                return (
                  <Card key={c.id} className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">
                          {c.customer?.first_name} {c.customer?.last_name}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {c.contract_number} · {c.show?.name ?? c.location?.name ?? "—"}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {blockerCount === 0 ? (
                            <Badge variant="success" className="text-[10px]">Ready</Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">
                              {blockerCount} missing: {c.readiness.blockers.map((b: ReadinessItem) => b.label).join(", ")}
                            </Badge>
                          )}
                          {c.balance_due > 0 && (
                            <span className="text-xs text-amber-700 font-medium">
                              ${c.balance_due?.toLocaleString()} due
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/admin/work-orders/new?contract_id=${c.id}`}
                        className="text-xs px-3 py-1.5 bg-[#010F21] text-white rounded-lg font-semibold hover:bg-[#00929C] transition-colors shrink-0"
                      >
                        + Schedule
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Active work orders — grouped by day ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Active Orders ({active.length})
          </h2>
          {active.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-400 text-sm">
                No active work orders.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeByDay.map((day) => (
                <div key={day.dateKey} className="space-y-2">
                  <div className="sticky top-[72px] z-[5] -mx-1 px-1 py-1.5 bg-slate-50/95 backdrop-blur flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      {day.label}
                      <span className="ml-2 text-slate-400 font-medium normal-case">
                        · {day.orders.length} {day.orders.length === 1 ? "delivery" : "deliveries"}
                      </span>
                    </p>
                    {day.crewLoad > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">
                        {day.crewLoad} crew {day.crewLoad === 1 ? "assignment" : "assignments"}
                      </span>
                    )}
                  </div>
                  {day.orders.map((o: any) => (
                    <Link key={o.id} href={`/admin/work-orders/${o.id}`} className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900">
                                {o.contract?.customer?.first_name} {o.contract?.customer?.last_name}
                              </p>
                              <p className="text-sm text-slate-500 truncate">
                                {o.contract?.contract_number} · {o.contract?.show?.name ?? o.contract?.location?.name ?? "—"}
                              </p>
                              {o.notes && (
                                <p className="text-xs text-slate-400 mt-1 truncate">{o.notes}</p>
                              )}
                            </div>
                            <div className="text-right ml-3 space-y-1 shrink-0">
                              <Badge variant={STATUS_BADGE[o.status] ?? "secondary"}>
                                {STATUS_LABEL[o.status] ?? o.status}
                              </Badge>
                              {o.scheduled_window && (
                                <p className="text-xs font-semibold text-[#00929C]">{o.scheduled_window}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Completed ── */}
        {done.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Recent Completed / Cancelled
            </h2>
            <div className="space-y-2">
              {done.map((o) => (
                <Link key={o.id} href={`/admin/work-orders/${o.id}`} className="block opacity-60 hover:opacity-80">
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">
                          {o.contract?.customer?.first_name} {o.contract?.customer?.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{o.contract?.contract_number}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={STATUS_BADGE[o.status] ?? "secondary"} className="text-xs">
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                        <p className="text-xs text-slate-400 mt-1">{formatDay(o.scheduled_date)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>
    </AppShell>
  );
}
