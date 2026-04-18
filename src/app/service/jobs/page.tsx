export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_TABS = ["scheduled", "in_progress", "completed", "cancelled"];
const STATUS_COLORS: Record<string, "default" | "warning" | "success" | "destructive" | "secondary"> = {
  draft: "secondary",
  scheduled: "default",
  in_progress: "warning",
  completed: "success",
  cancelled: "destructive",
};
const JOB_TYPE_LABELS: Record<string, string> = {
  maintenance: "Maintenance", repair: "Repair", warranty: "Warranty",
  install: "Install", follow_up: "Follow-up", other: "Other",
};

function formatDate(d: string | null) {
  if (!d) return "TBD";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ServiceJobsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const statusFilter = STATUS_TABS.includes(params.status ?? "") ? params.status : "scheduled";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/dashboard");

  let query = supabase
    .from("service_jobs")
    .select("id, job_type, title, status, scheduled_date, customer:customers(first_name,last_name), assigned_tech:profiles(full_name)")
    .order("scheduled_date", { ascending: true });

  if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);

  const { data: jobs } = await query;

  return (
    <AppShell role={profile?.role} userName={(profile as any)?.full_name}>
      <AppHeader
        title="Service Jobs"
        subtitle={statusFilter === "scheduled" ? "Scheduled · Pending dispatch" : undefined}
        actions={
          <Link href="/service/jobs/new">
            <Button variant="accent" size="sm" className="font-bold">
              + New Job
            </Button>
          </Link>
        }
      />

      <main className="max-w-4xl mx-auto px-4 py-5 pb-24 space-y-4">
        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((s) => (
            <Link key={s} href={`/service/jobs?status=${s}`}>
              <button className={`flex-shrink-0 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors border ${
                statusFilter === s ? "bg-[#010F21] text-white border-[#010F21]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}>
                {s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            </Link>
          ))}
        </div>

        {(jobs ?? []).length === 0 ? (
          <Card>
            <EmptyState
              title={`No ${statusFilter.replace("_", " ")} jobs`}
              description={
                statusFilter === "scheduled"
                  ? "When a job is dispatched to a technician, it shows up here."
                  : undefined
              }
              action={{ label: "+ New Job", href: "/service/jobs/new" }}
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {(jobs ?? []).map((job) => {
              const customer = (job as any).customer;
              const tech = (job as any).assigned_tech;
              return (
                <Link key={job.id} href={`/service/jobs/${job.id}`} className="block">
                  <Card className="hover:border-[#00929C]/40 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-slate-900 truncate">{job.title}</p>
                            <Badge variant={STATUS_COLORS[job.status] ?? "secondary"}>{job.status.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-sm text-slate-600">{customer?.first_name} {customer?.last_name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span>{JOB_TYPE_LABELS[job.job_type] ?? job.job_type}</span>
                            <span>·</span>
                            <span>{formatDate(job.scheduled_date)}</span>
                            {tech && <><span>·</span><span>{tech.full_name}</span></>}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
