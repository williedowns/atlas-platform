export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import TaskList from "./_components/TaskList";
import RealtimeRefresher from "./_components/RealtimeRefresher";
import TeamActivityFeed from "./_components/TeamActivityFeed";

const SECTIONS = [
  {
    href: "/crm/contacts",
    title: "Contacts",
    accent: "#00929C",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/crm/pipeline",
    title: "Pipeline",
    accent: "#7c3aed",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M5 12h14M7 18h10" />
      </svg>
    ),
  },
  {
    href: "/crm/households",
    title: "Households",
    accent: "#f59e0b",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/crm/inbox",
    title: "Inbox",
    accent: "#10b981",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: "/crm/forecast",
    title: "Forecast",
    accent: "#ef4444",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CrmHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    redirect("/dashboard");
  }

  const orgPerms = (profile?.organization as any)?.role_permissions;

  // Pipeline pulse — open opps owned by current user (or all if no ownership)
  const { data: myOppsRaw } = await supabase
    .from("opportunities")
    .select("id, stage_id, value_estimate, status, expected_close_date, primary_contact_id")
    .eq("owner_id", user.id)
    .eq("status", "open")
    .limit(500);

  const myOpps = myOppsRaw ?? [];
  const myPipelineValue = myOpps.reduce((s, o) => s + (o.value_estimate ?? 0), 0);

  // Activity counts (last 7 days) — quick proxy for momentum
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { count: recentActivities } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .gte("occurred_at", sevenDaysAgo.toISOString())
    .eq("created_by", user.id);

  // Hot deals: opps in won/last-stage-before-won territory (probability >= 60)
  const { data: hotOppsRaw } = await supabase
    .from("opportunities")
    .select(`
      id, name, value_estimate, probability, expected_close_date,
      stage:pipeline_stages!stage_id(name, color),
      primary_contact:contacts!primary_contact_id(id, first_name, last_name)
    `)
    .eq("owner_id", user.id)
    .eq("status", "open")
    .gte("probability", 60)
    .order("probability", { ascending: false })
    .order("value_estimate", { ascending: false })
    .limit(5);

  const hotOpps = (hotOppsRaw ?? []) as any[];

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="CRM"
        subtitle={`${greeting}, ${firstName}`}
        backHref="/dashboard"
      />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* KPI strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">My pipeline</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{formatCurrency(myPipelineValue)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{myOpps.length} open deals</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hot deals</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{hotOpps.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">≥60% probability</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">7d activity</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{recentActivities ?? 0}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Calls, notes, emails</p>
          </div>
          <Link
            href="/crm/pipeline?mine=1"
            className="bg-[#00929C] rounded-xl p-3 text-white hover:bg-[#007a82] transition-colors group"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Open my pipeline</p>
            <p className="text-xl font-bold mt-1">→ Kanban</p>
            <p className="text-[11px] text-white/80 mt-0.5">View only my deals</p>
          </Link>
        </section>

        {/* Today's Plays + Hot deals side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TaskList
              assigneeId={user.id}
              title="Today's Plays"
              emptyDescription={'No open tasks. Add one above — or click a contact/opportunity and add tasks there. Press "+ Add" or hit enter to fire.'}
            />

            {/* Team activity — what everyone in the org did in the last 24h */}
            <TeamActivityFeed hours={24} limit={30} />
          </div>

          <div className="lg:col-span-1 space-y-4">
            {/* Hot deals */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Hot deals</h3>
                <p className="text-[11px] text-slate-500">Probability ≥ 60%</p>
              </div>
              {hotOpps.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-400 italic">
                  No hot deals yet. Move opps to Quote Sent or Send to Method to see them here.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {hotOpps.map((o) => {
                    const contactName = o.primary_contact
                      ? [o.primary_contact.first_name, o.primary_contact.last_name].filter(Boolean).join(" ")
                      : null;
                    return (
                      <li key={o.id}>
                        <Link
                          href={`/crm/opportunities/${o.id}`}
                          className="block px-4 py-3 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-slate-900 group-hover:text-[#00929C] truncate">
                                {o.name}
                              </p>
                              {contactName && (
                                <p className="text-[11px] text-slate-500 truncate">{contactName}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {o.stage?.color && (
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: o.stage.color }} />
                                )}
                                <p className="text-[10px] text-slate-500">
                                  {o.stage?.name ?? "—"} · {o.probability}%
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">
                              {formatCurrency(o.value_estimate ?? 0)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Section cards */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Jump to</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {SECTIONS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: s.accent }}
                    >
                      {s.icon}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-[#00929C]">{s.title}</p>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </section>

            {/* Cmd-K hint */}
            <div className="text-center text-[11px] text-slate-400">
              Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] text-slate-600">⌘ K</kbd> to search or jump anywhere
            </div>
          </div>
        </div>
      </main>

      {/* Live updates: tasks for "Today's Plays", opportunities for the
          KPI strip + Hot deals, activities for the team feed. */}
      <RealtimeRefresher tables={["tasks", "opportunities", "activities"]} />
    </AppShell>
  );
}
