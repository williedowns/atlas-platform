export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  maintenance: "Maint", repair: "Repair", warranty: "Warranty",
  install: "Install", follow_up: "Follow-up", other: "Other",
};

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

function getMondayOfWeek(ref: Date) {
  const day = ref.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(ref, diff);
}

export default async function ServiceCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const offset = parseInt(params.offset ?? "0", 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/dashboard");

  const today = new Date();
  const baseMonday = getMondayOfWeek(today);
  const weekMonday = addDays(baseMonday, offset * 7);
  const weekSunday = addDays(weekMonday, 6);

  const startDate = toISO(weekMonday);
  const endDate = toISO(weekSunday);

  const { data: jobs } = await supabase
    .from("service_jobs")
    .select("id, title, job_type, status, scheduled_date, scheduled_time_start, customer:customers(first_name,last_name), assigned_tech:profiles(full_name)")
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .order("scheduled_time_start", { ascending: true, nullsFirst: false });

  // Group jobs by date string
  const jobsByDate: Record<string, typeof jobs> = {};
  for (let i = 0; i < 7; i++) {
    const d = toISO(addDays(weekMonday, i));
    jobsByDate[d] = [];
  }
  for (const job of jobs ?? []) {
    if (job.scheduled_date && jobsByDate[job.scheduled_date]) {
      jobsByDate[job.scheduled_date]!.push(job as any);
    }
  }

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayStr = toISO(today);

  const weekLabel = `${weekMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekSunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <AppShell role={profile?.role} userName={(profile as any)?.full_name}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-lg font-bold">Dispatch Calendar</h1>
          <Link href={`/service/jobs/new`}>
            <button className="bg-[#00929C] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#007a82] transition-colors">
              + New Job
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 pb-24">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link href={`/service/calendar?offset=${offset - 1}`}>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Prev
            </button>
          </Link>
          <div className="text-center">
            <p className="font-semibold text-slate-900">{weekLabel}</p>
            {offset !== 0 && (
              <Link href="/service/calendar" className="text-xs text-[#00929C] hover:underline">Back to this week</Link>
            )}
          </div>
          <Link href={`/service/calendar?offset=${offset + 1}`}>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </Link>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((dayName, i) => {
            const dateStr = toISO(addDays(weekMonday, i));
            const date = addDays(weekMonday, i);
            const dayJobs = jobsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className={`min-h-[160px] rounded-xl border ${isToday ? "border-[#00929C] bg-[#00929C]/5" : "border-slate-200 bg-white"}`}>
                {/* Day header */}
                <div className={`px-2 py-2 border-b ${isToday ? "border-[#00929C]/30" : "border-slate-100"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-[#00929C]" : "text-slate-500"}`}>{dayName}</p>
                  <p className={`text-sm font-bold ${isToday ? "text-[#00929C]" : "text-slate-800"}`}>
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <Link href={`/service/jobs/new?date=${dateStr}`} className="mt-1 block text-xs text-slate-400 hover:text-[#00929C] font-medium">+ Add</Link>
                </div>

                {/* Jobs */}
                <div className="p-1.5 space-y-1">
                  {dayJobs.length === 0 && (
                    <p className="text-xs text-slate-300 text-center py-3">—</p>
                  )}
                  {dayJobs.map((job: any) => {
                    const customer = job.customer;
                    return (
                      <Link key={job.id} href={`/service/jobs/${job.id}`} className="block">
                        <div className="rounded-lg px-2 py-1.5 bg-white border border-slate-100 hover:border-[#00929C]/40 hover:shadow-sm transition-all cursor-pointer">
                          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                            {customer?.first_name} {customer?.last_name}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-400">{JOB_TYPE_LABELS[job.job_type] ?? job.job_type}</span>
                            {job.scheduled_time_start && (
                              <span className="text-xs text-slate-400">· {job.scheduled_time_start.slice(0, 5)}</span>
                            )}
                          </div>
                          <span className={`inline-block mt-1 text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[job.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {job.status.replace("_", " ")}
                          </span>
                          {job.assigned_tech?.full_name && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">{job.assigned_tech.full_name.split(" ")[0]}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
