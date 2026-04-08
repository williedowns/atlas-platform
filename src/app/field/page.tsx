export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};
const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800", in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800", cancelled: "bg-slate-100 text-slate-600",
};
const JOB_TYPE_LABELS: Record<string, string> = {
  maintenance: "Maintenance", repair: "Repair", warranty: "Warranty",
  install: "Install", follow_up: "Follow-up", other: "Other",
};

function formatDay(dateStr: string | null) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const tab = params.tab === "service" ? "service" : "deliveries";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "field_crew" && profile?.role !== "admin") redirect("/dashboard");

  const firstName = profile?.full_name?.split(" ")[0] ?? "Crew";

  // Fetch deliveries
  const { data: allOrders } = await supabase
    .from("delivery_work_orders")
    .select(`id, scheduled_date, status, notes, contract:contracts(id, contract_number, customer:customers(first_name, last_name))`)
    .contains("assigned_crew_ids", [user.id])
    .order("scheduled_date", { ascending: true });

  const upcoming = allOrders?.filter(o => o.status !== "completed" && o.status !== "cancelled") ?? [];
  const completedDeliveries = allOrders?.filter(o => o.status === "completed").slice(0, 5) ?? [];

  // Fetch service jobs assigned to this tech
  const { data: serviceJobs } = await supabase
    .from("service_jobs")
    .select("id, title, job_type, status, scheduled_date, scheduled_time_start, customer:customers(first_name,last_name)")
    .eq("assigned_tech_id", user.id)
    .not("status", "in", '("completed","cancelled")')
    .order("scheduled_date", { ascending: true });

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold">Field App</h1>
            <p className="text-white/60 text-xs mt-0.5">Hi, {firstName}</p>
          </div>
          <Link href="/profile" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          <Link href="/field?tab=deliveries">
            <button className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "deliveries" ? "border-[#00929C] text-[#00929C]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              Deliveries {upcoming.length > 0 && <span className="ml-1 bg-slate-200 text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{upcoming.length}</span>}
            </button>
          </Link>
          <Link href="/field?tab=service">
            <button className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "service" ? "border-[#00929C] text-[#00929C]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              Service Jobs {(serviceJobs?.length ?? 0) > 0 && <span className="ml-1 bg-slate-200 text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{serviceJobs?.length}</span>}
            </button>
          </Link>
        </div>

        {/* Deliveries Tab */}
        {tab === "deliveries" && (
          <>
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Upcoming ({upcoming.length})</h2>
              {upcoming.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <p className="text-slate-500 font-medium">No upcoming work orders</p>
                  <p className="text-slate-400 text-sm mt-1">Check back when your crew is assigned a delivery.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((order) => {
                    const customer = (order.contract as any)?.customer;
                    const contractId = (order.contract as any)?.id;
                    const contractNumber = (order.contract as any)?.contract_number;
                    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown Customer";
                    return (
                      <li key={order.id}>
                        <Link href={contractId ? `/contracts/${contractId}/delivery-diagram` : "#"}
                          className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#00929C]/50 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base font-bold text-slate-900">{formatDay(order.scheduled_date)}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status] ?? STATUS_BADGE.scheduled}`}>
                                  {STATUS_LABEL[order.status] ?? order.status}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-800">{customerName}</p>
                              {contractNumber && <p className="text-xs text-slate-500 mt-0.5">#{contractNumber}</p>}
                              {order.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{order.notes}</p>}
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

            {completedDeliveries.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recently Completed ({completedDeliveries.length})</h2>
                <ul className="space-y-2">
                  {completedDeliveries.map((order) => {
                    const customer = (order.contract as any)?.customer;
                    const contractId = (order.contract as any)?.id;
                    const contractNumber = (order.contract as any)?.contract_number;
                    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown Customer";
                    return (
                      <li key={order.id}>
                        <Link href={contractId ? `/contracts/${contractId}/delivery-diagram` : "#"}
                          className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-slate-300 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-slate-700">{customerName}</p>
                            <p className="text-xs text-slate-400">{formatDay(order.scheduled_date)}{contractNumber ? ` · #${contractNumber}` : ""}</p>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Done</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Service Jobs Tab */}
        {tab === "service" && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              My Service Jobs ({serviceJobs?.length ?? 0})
            </h2>
            {(serviceJobs?.length ?? 0) === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <p className="text-slate-500 font-medium">No service jobs assigned</p>
                <p className="text-slate-400 text-sm mt-1">Jobs assigned to you will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {(serviceJobs ?? []).map((job) => {
                  const customer = (job as any).customer;
                  return (
                    <li key={job.id}>
                      <Link href={`/field/service/${job.id}`}
                        className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#00929C]/50 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-slate-900">{job.title}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status] ?? "bg-slate-100 text-slate-600"}`}>
                                {STATUS_LABEL[job.status] ?? job.status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700">{customer?.first_name} {customer?.last_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span>{JOB_TYPE_LABELS[job.job_type] ?? job.job_type}</span>
                              {job.scheduled_date && <><span>·</span><span>{formatDay(job.scheduled_date)}</span></>}
                              {job.scheduled_time_start && <><span>·</span><span>{job.scheduled_time_start.slice(0,5)}</span></>}
                            </div>
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
        )}
      </main>
    </AppShell>
  );
}
