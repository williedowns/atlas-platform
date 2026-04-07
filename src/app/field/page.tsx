export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-600",
};

function formatDay(dateStr: string | null) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function FieldPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Only field_crew can access — admins can preview
  if (profile?.role !== "field_crew" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: allOrders } = await supabase
    .from("delivery_work_orders")
    .select(`
      id, scheduled_date, status, notes,
      contract:contracts(
        id, contract_number,
        customer:customers(first_name, last_name)
      )
    `)
    .contains("assigned_crew_ids", [user.id])
    .order("scheduled_date", { ascending: true });

  const upcoming = allOrders?.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled"
  ) ?? [];

  const completed = allOrders?.filter((o) => o.status === "completed").slice(0, 5) ?? [];

  const firstName = profile?.full_name?.split(" ")[0] ?? "Crew";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold">Work Orders</h1>
            <p className="text-white/60 text-xs mt-0.5">Hi, {firstName}</p>
          </div>
          <Link
            href="/profile"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">

        {/* Upcoming */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Upcoming ({upcoming.length})
          </h2>

          {upcoming.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <p className="text-slate-500 font-medium">No upcoming work orders</p>
              <p className="text-slate-400 text-sm mt-1">Check back when your crew is assigned a delivery.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((order) => {
                const customer = (order.contract as any)?.customer;
                const contractId = (order.contract as any)?.id;
                const contractNumber = (order.contract as any)?.contract_number;
                const customerName = customer
                  ? `${customer.first_name} ${customer.last_name}`
                  : "Unknown Customer";

                return (
                  <li key={order.id}>
                    <Link
                      href={contractId ? `/contracts/${contractId}/delivery-diagram` : "#"}
                      className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#00929C]/50 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-bold text-slate-900">
                              {formatDay(order.scheduled_date)}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status] ?? STATUS_BADGE.scheduled}`}>
                              {STATUS_LABEL[order.status] ?? order.status}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800">{customerName}</p>
                          {contractNumber && (
                            <p className="text-xs text-slate-500 mt-0.5">#{contractNumber}</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{order.notes}</p>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Recently Completed ({completed.length})
            </h2>
            <ul className="space-y-2">
              {completed.map((order) => {
                const customer = (order.contract as any)?.customer;
                const contractId = (order.contract as any)?.id;
                const contractNumber = (order.contract as any)?.contract_number;
                const customerName = customer
                  ? `${customer.first_name} ${customer.last_name}`
                  : "Unknown Customer";

                return (
                  <li key={order.id}>
                    <Link
                      href={contractId ? `/contracts/${contractId}/delivery-diagram` : "#"}
                      className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-slate-300 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">{customerName}</p>
                        <p className="text-xs text-slate-400">{formatDay(order.scheduled_date)}{contractNumber ? ` · #${contractNumber}` : ""}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Done
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

      </main>
    </AppShell>
  );
}
